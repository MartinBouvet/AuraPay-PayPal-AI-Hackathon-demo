import { DomainError } from "@/lib/domain/errors";
import { centsToPayPal } from "@/lib/domain/pricing";
import { getQuote, requireQuote, updateStore } from "@/lib/domain/store";
import type { Quote } from "@/lib/domain/types";
import { getPayPalConfig, type MockApplicationCode } from "@/lib/paypal/config";
import { PayPalApiError } from "@/lib/paypal/errors";
import {
  createPayPalInvoice,
  generateInvoiceQr,
  getPayPalInvoice,
  payerViewUrl,
  sendPayPalInvoice,
} from "@/lib/paypal/invoices";

function ensureInvoiceRequestId(quote: Quote): string {
  if (!quote.invoiceRequestId) quote.invoiceRequestId = crypto.randomUUID();
  return quote.invoiceRequestId;
}

export async function issueInvoice(quoteId: string, mockApplicationCode?: MockApplicationCode): Promise<Quote> {
  const existing = await getQuote(quoteId);
  if (existing.status === "negotiating") {
    throw new DomainError("Accept the quote before issuing the invoice.", 409, "QUOTE_OPEN");
  }
  if (existing.paypalInvoiceId) return existing;

  const { merchantEmail } = getPayPalConfig();
  if (!merchantEmail) {
    throw new DomainError(
      "Set PAYPAL_MERCHANT_EMAIL to the sandbox Business account email.",
      503,
      "MERCHANT_EMAIL_MISSING",
    );
  }

  const requestId = await updateStore((store) => ensureInvoiceRequestId(requireQuote(store, quoteId)));
  const quote = await getQuote(quoteId);

  const created = await createPayPalInvoice({
    requestId: mockApplicationCode ? crypto.randomUUID() : requestId,
    invoiceNumber: quote.invoiceNumber,
    currencyCode: quote.currency,
    note: `“${quote.title}” negotiated by the AuraPay agent.`,
    merchantEmail,
    recipient: quote.buyer,
    itemName: quote.title,
    itemDescription: quote.brief,
    quantity: "1",
    unitAmount: centsToPayPal(quote.subtotalCents),
    taxPercent: quote.taxPercent.toFixed(2),
    taxAmount: centsToPayPal(quote.taxCents),
    mockApplicationCode,
  });

  const invoiceId = created.id;
  if (!invoiceId) {
    throw new DomainError("PayPal did not return an invoice id.", 502, "INVOICE_ID_MISSING");
  }

  const detailed = created.links ? created : await getPayPalInvoice(invoiceId);

  return updateStore((store) => {
    const current = requireQuote(store, quoteId);
    current.paypalInvoiceId = invoiceId;
    current.payerViewUrl = payerViewUrl(detailed);
    current.invoiceDue = detailed.due_amount?.value;
    if (current.status === "accepted") current.status = "invoiced";
    return structuredClone(current);
  });
}

export async function deliverInvoice(quoteId: string): Promise<Quote> {
  const quote = await getQuote(quoteId);
  if (!quote.paypalInvoiceId) {
    throw new DomainError("Issue the invoice first.", 409, "INVOICE_MISSING");
  }

  try {
    await sendPayPalInvoice(quote.paypalInvoiceId, crypto.randomUUID());
  } catch (error) {
    const issue = error instanceof PayPalApiError ? error.issue : undefined;
    if (!issue || !/SENT|ALREADY/i.test(issue)) throw error;
  }
  const detailed = await getPayPalInvoice(quote.paypalInvoiceId);
  const qrDataUrl = await generateInvoiceQr(quote.paypalInvoiceId, crypto.randomUUID());

  return updateStore((store) => {
    const current = requireQuote(store, quoteId);
    current.payerViewUrl = payerViewUrl(detailed) ?? current.payerViewUrl;
    current.invoiceDue = detailed.due_amount?.value ?? current.invoiceDue;
    if (qrDataUrl) current.qrDataUrl = qrDataUrl;
    if (current.status === "accepted") current.status = "invoiced";
    return structuredClone(current);
  });
}
