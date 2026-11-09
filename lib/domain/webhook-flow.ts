import { isRecord } from "@/lib/paypal/errors";
import { verifyWebhookSignature } from "@/lib/paypal/webhooks";
import { completeQuoteInDevelopment, settleFromWebhook } from "@/lib/domain/checkout-flow";
import { DomainError } from "@/lib/domain/errors";
import { markPayoutItem } from "@/lib/domain/payout-flow";
import { getQuote, updateStore } from "@/lib/domain/store";

export type WebhookSnapshot = {
  rawBody: string;
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pushEvent(input: {
  id: string;
  type: string;
  status: "processed" | "ignored" | "failed";
  summary: string;
}): Promise<void> {
  return updateStore((store) => {
    store.events.unshift({
      id: input.id,
      at: new Date().toISOString(),
      type: input.type,
      status: input.status,
      summary: input.summary,
    });
    store.events = store.events.slice(0, 50);
  }).then(() => undefined);
}

export async function processPayPalWebhook(snapshot: WebhookSnapshot): Promise<void> {
  let event: unknown;
  try {
    event = JSON.parse(snapshot.rawBody) as unknown;
  } catch {
    await pushEvent({
      id: crypto.randomUUID(),
      type: "INVALID",
      status: "failed",
      summary: "Webhook body could not be read.",
    });
    return;
  }

  if (!isRecord(event) || typeof event.id !== "string" || typeof event.event_type !== "string") {
    await pushEvent({
      id: crypto.randomUUID(),
      type: "INVALID",
      status: "failed",
      summary: "PayPal event is incomplete.",
    });
    return;
  }

  const eventId = event.id;
  const eventType = event.event_type;
  if (typeof eventId !== "string" || typeof eventType !== "string") return;

  const already = await updateStore((store) => store.processedWebhookIds.includes(eventId));
  if (already) return;

  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() ?? "";
  const development = process.env.NODE_ENV === "development";
  let verification: "verified" | "simulator" | "development-unsigned" = "verified";

  if (!webhookId && !development) {
    await pushEvent({
      id: eventId,
      type: eventType,
      status: "ignored",
      summary: "PAYPAL_WEBHOOK_ID is empty outside development, so the event was not processed.",
    });
    return;
  }

  if (!webhookId && development) {
    verification = "development-unsigned";
    console.warn(
      "[aurapay] PAYPAL_WEBHOOK_ID is empty. Development mode is accepting this webhook without signature verification.",
    );
  }

  const simulator = webhookId === "WEBHOOK_ID";
  if (simulator) verification = "simulator";

  if (verification === "verified") {
    if (!snapshot.transmissionId || !snapshot.transmissionSig || !snapshot.certUrl || !snapshot.authAlgo) {
      await pushEvent({
        id: eventId,
        type: eventType,
        status: "failed",
        summary: "Signature headers are missing.",
      });
      return;
    }

    let verified = false;
    try {
      verified = await verifyWebhookSignature({
        authAlgo: snapshot.authAlgo,
        certUrl: snapshot.certUrl,
        transmissionId: snapshot.transmissionId,
        transmissionSig: snapshot.transmissionSig,
        transmissionTime: snapshot.transmissionTime,
        webhookId,
        webhookEvent: event,
      });
    } catch (error) {
      await pushEvent({
        id: eventId,
        type: eventType,
        status: "failed",
        summary: error instanceof Error ? error.message : "Signature verification failed.",
      });
      return;
    }

    if (!verified) {
      await pushEvent({
        id: eventId,
        type: eventType,
        status: "failed",
        summary: "PayPal rejected the webhook signature.",
      });
      return;
    }
  }

  const resource = isRecord(event.resource) ? event.resource : {};

  try {
    if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId =
        eventType === "CHECKOUT.ORDER.APPROVED"
          ? asString(resource.id)
          : (asString(
              isRecord(resource.supplementary_data) && isRecord(resource.supplementary_data.related_ids)
                ? resource.supplementary_data.related_ids.order_id
                : undefined,
            ) ?? asString(resource.custom_id));
      const captureId = eventType === "PAYMENT.CAPTURE.COMPLETED" ? asString(resource.id) : undefined;
      if (orderId) await settleFromWebhook(orderId, captureId);
    } else if (
      eventType === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.FAILED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.BLOCKED"
    ) {
      const payoutItem = isRecord(resource.payout_item) ? resource.payout_item : {};
      const senderItemId = asString(payoutItem.sender_item_id);
      const transactionStatus = asString(resource.transaction_status) ?? "FAILED";
      if (senderItemId) await markPayoutItem(senderItemId, transactionStatus);
    }

    await updateStore((store) => {
      store.processedWebhookIds.unshift(eventId);
      store.processedWebhookIds = store.processedWebhookIds.slice(0, 200);
    });
    await pushEvent({
      id: eventId,
      type: eventType,
      status: "processed",
      summary:
        verification === "development-unsigned"
          ? "Development event processed without signature verification."
          : verification === "simulator"
            ? "Simulator event processed without a postback verification."
            : "Event verified and processed.",
    });
  } catch (error) {
    await pushEvent({
      id: eventId,
      type: eventType,
      status: "failed",
      summary: error instanceof Error ? error.message : "The event could not be processed.",
    });
  }
}

/** Local stand-in for an inbound PayPal webhook. Development only. */
export async function emitDevelopmentCapture(quoteId: string) {
  if (process.env.NODE_ENV !== "development") {
    throw new DomainError("The local webhook emitter is available in development only.", 404, "NOT_FOUND");
  }

  console.warn(
    "[aurapay] Emitting a local PAYMENT.CAPTURE.COMPLETED. Signature verification is skipped in development when PAYPAL_WEBHOOK_ID is empty.",
  );

  const quote = await getQuote(quoteId);
  const captureId = quote.captureId ?? `DEVCAP${quote.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const event = {
    id: `DEV-${crypto.randomUUID()}`,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: captureId,
      status: "COMPLETED",
      custom_id: quote.id,
      supplementary_data: quote.paypalOrderId
        ? { related_ids: { order_id: quote.paypalOrderId } }
        : undefined,
    },
  };

  await processPayPalWebhook({
    rawBody: JSON.stringify(event),
    authAlgo: "",
    certUrl: "",
    transmissionId: "",
    transmissionSig: "",
    transmissionTime: "",
  });

  const after = await getQuote(quoteId);
  if (after.status === "paid") return after;
  return completeQuoteInDevelopment(quoteId, captureId);
}
