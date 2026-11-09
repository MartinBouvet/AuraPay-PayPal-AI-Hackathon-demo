import { DomainError } from "@/lib/domain/errors";
import { assertPayable, centsToPayPal, totalsMatch } from "@/lib/domain/pricing";
import { getQuote, readStore, requireQuote, updateStore } from "@/lib/domain/store";
import type { Quote } from "@/lib/domain/types";
import type { MockApplicationCode } from "@/lib/paypal/config";
import { PayPalApiError } from "@/lib/paypal/errors";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalOrder,
  readCaptureId,
  type PayPalOrder,
} from "@/lib/paypal/orders";
import { releaseMilestone } from "@/lib/domain/payout-flow";

function reusable(status: string | undefined): boolean {
  return status === "CREATED" || status === "PAYER_ACTION_REQUIRED";
}

async function rememberOrder(quoteId: string, order: PayPalOrder): Promise<Quote> {
  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    quote.paypalOrderId = order.id;
    quote.paypalOrderStatus = order.status;
    return structuredClone(quote);
  });
}

export async function createOrderForQuote(
  quoteId: string,
  mockApplicationCode?: MockApplicationCode,
): Promise<{ orderId: string; quote: Quote }> {
  const quote = await getQuote(quoteId);
  assertPayable(quote);

  if (quote.paypalOrderId && !mockApplicationCode) {
    try {
      const existing = await getPayPalOrder(quote.paypalOrderId);
      if (reusable(existing.status) && totalsMatch(quote, existing.purchase_units?.[0]?.amount?.currency_code, existing.purchase_units?.[0]?.amount?.value)) {
        const saved = await rememberOrder(quoteId, existing);
        return { orderId: existing.id, quote: saved };
      }
    } catch (error) {
      if (!(error instanceof PayPalApiError) || error.status !== 404) throw error;
    }
  }

  const requestId = await updateStore((store) => {
    const current = requireQuote(store, quoteId);
    if (!current.orderRequestId) current.orderRequestId = crypto.randomUUID();
    if (!current.captureRequestId) current.captureRequestId = crypto.randomUUID();
    return mockApplicationCode ? crypto.randomUUID() : current.orderRequestId;
  });

  const fresh = await getQuote(quoteId);
  const order = await createPayPalOrder({
    requestId,
    referenceId: fresh.id,
    customId: fresh.id,
    invoiceNumber: fresh.invoiceNumber,
    description: fresh.title,
    currencyCode: fresh.currency,
    itemTotal: centsToPayPal(fresh.subtotalCents),
    taxTotal: centsToPayPal(fresh.taxCents),
    value: centsToPayPal(fresh.totalCents),
    items: [
      {
        name: fresh.title,
        description: fresh.brief,
        quantity: "1",
        unitAmount: centsToPayPal(fresh.subtotalCents),
        taxAmount: centsToPayPal(fresh.taxCents),
      },
    ],
    mockApplicationCode,
  });

  const unit = order.purchase_units?.[0];
  if (!totalsMatch(fresh, unit?.amount?.currency_code, unit?.amount?.value)) {
    throw new DomainError("PayPal returned an amount that does not match the quote.", 502, "AMOUNT_MISMATCH");
  }

  const saved = await rememberOrder(quoteId, order);
  return { orderId: order.id, quote: saved };
}

async function settle(quoteId: string, order: PayPalOrder): Promise<Quote> {
  const captureId = readCaptureId(order);
  const quote = await updateStore((store) => {
    const current = requireQuote(store, quoteId);
    current.paypalOrderId = order.id;
    current.paypalOrderStatus = order.status;
    if (order.status === "COMPLETED") {
      current.status = "paid";
      current.captureId = captureId ?? current.captureId;
      current.paidAt = current.paidAt ?? new Date().toISOString();
    }
    return structuredClone(current);
  });

  if (quote.status === "paid") {
    const first = quote.milestones[0];
    if (first && (first.status === "locked" || first.status === "failed")) {
      try {
        return await releaseMilestone(quote.id, first.id);
      } catch (error) {
        console.error(
          JSON.stringify({
            source: "aurapay-payout",
            quoteId,
            message: error instanceof Error ? error.message : "the first milestone payout failed",
          }),
        );
        return getQuote(quoteId);
      }
    }
  }

  return quote;
}

export async function captureOrderForQuote(
  quoteId: string,
  orderId: string,
  mockApplicationCode?: MockApplicationCode,
): Promise<Quote> {
  const quote = await getQuote(quoteId);
  if (quote.paypalOrderId && quote.paypalOrderId !== orderId) {
    throw new DomainError("This order does not belong to the file.", 409, "ORDER_MISMATCH");
  }
  if (quote.status === "negotiating") {
    throw new DomainError("The quote has not been accepted.", 409, "QUOTE_OPEN");
  }

  const remote = await getPayPalOrder(orderId);
  const unit = remote.purchase_units?.[0];
  if (unit?.custom_id && unit.custom_id !== quote.id) {
    throw new DomainError("The PayPal order does not match this file.", 409, "ORDER_MISMATCH");
  }
  if (!totalsMatch(quote, unit?.amount?.currency_code, unit?.amount?.value)) {
    throw new DomainError("The order amount does not match the locked quote.", 409, "AMOUNT_MISMATCH");
  }

  if (remote.status === "COMPLETED") {
    return settle(quoteId, remote);
  }

  const requestId = mockApplicationCode
    ? crypto.randomUUID()
    : quote.captureRequestId ??
      (await updateStore((store) => {
        const current = requireQuote(store, quoteId);
        if (!current.captureRequestId) current.captureRequestId = crypto.randomUUID();
        return current.captureRequestId;
      }));

  try {
    const captured = await capturePayPalOrder(orderId, requestId, mockApplicationCode);
    return settle(quoteId, captured);
  } catch (error) {
    if (error instanceof PayPalApiError && error.issue === "ORDER_ALREADY_CAPTURED") {
      const again = await getPayPalOrder(orderId);
      return settle(quoteId, again);
    }
    throw error;
  }
}

export async function settleFromWebhook(orderId?: string, captureId?: string): Promise<void> {
  const quotes = readStore().quotes;
  const quote = quotes.find((item) => {
    if (orderId && (item.paypalOrderId === orderId || item.id === orderId)) return true;
    return Boolean(captureId && item.captureId === captureId);
  });
  if (!quote) return;

  if (quote.status === "paid" && quote.milestones[0]?.status === "released") return;

  const paypalOrderId = quote.paypalOrderId ?? (orderId && orderId !== quote.id ? orderId : undefined);
  if (!paypalOrderId) return;

  try {
    const remote = await getPayPalOrder(paypalOrderId);
    if (remote.status === "APPROVED") {
      await captureOrderForQuote(quote.id, remote.id);
      return;
    }
    if (remote.status === "COMPLETED") {
      await settle(quote.id, remote);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        source: "aurapay-webhook-settle",
        orderId,
        message: error instanceof Error ? error.message : "failed",
        issue: error instanceof PayPalApiError ? error.issue : undefined,
        debugId: error instanceof PayPalApiError ? error.debugId : undefined,
      }),
    );
  }
}

export async function completeQuoteInDevelopment(quoteId: string, captureId: string): Promise<Quote> {
  if (process.env.NODE_ENV !== "development") {
    throw new DomainError("Local capture simulation is available in development only.", 404, "NOT_FOUND");
  }
  const quote = await getQuote(quoteId);
  if (quote.status === "negotiating") {
    throw new DomainError("Accept the quote before simulating a capture.", 409, "QUOTE_OPEN");
  }
  if (quote.status === "paid" && quote.milestones[0]?.status === "released") return quote;

  return settle(quoteId, {
    id: quote.paypalOrderId ?? `DEV${quote.id.replace(/-/g, "").slice(0, 17).toUpperCase()}`,
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: quote.id,
        amount: { currency_code: quote.currency, value: centsToPayPal(quote.totalCents) },
        payments: { captures: [{ id: captureId, status: "COMPLETED" }] },
      },
    ],
  });
}
