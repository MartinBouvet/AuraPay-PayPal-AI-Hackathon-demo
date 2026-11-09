import { DomainError } from "@/lib/domain/errors";
import { requireQuote, updateStore } from "@/lib/domain/store";
import type { Milestone, Quote } from "@/lib/domain/types";

export const BRAND_IDENTITY_DEMO_ID = "4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c";

function freshInvoiceNumber(): string {
  return `AUR${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
}

function lockMilestone(milestone: Milestone): void {
  milestone.status = "locked";
  milestone.payoutRequestId = undefined;
  milestone.senderBatchId = undefined;
  milestone.payoutBatchId = undefined;
  milestone.payoutBatchStatus = undefined;
  milestone.payoutItemStatus = undefined;
  milestone.payoutRecipient = undefined;
  milestone.releasingAt = undefined;
  milestone.releasedAt = undefined;
  milestone.payoutError = undefined;
}

/** Return a mission to a locked quote with no PayPal invoice, order, capture, or payout. */
export async function resetDemoMission(quoteId = BRAND_IDENTITY_DEMO_ID): Promise<Quote> {
  if (process.env.NODE_ENV !== "development") {
    throw new DomainError("Not found.", 404, "NOT_FOUND");
  }

  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    if (quote.status !== "negotiating") quote.status = "accepted";
    quote.invoiceNumber = freshInvoiceNumber();
    quote.invoiceRequestId = undefined;
    quote.paypalInvoiceId = undefined;
    quote.payerViewUrl = undefined;
    quote.qrDataUrl = undefined;
    quote.invoiceDue = undefined;
    quote.orderRequestId = undefined;
    quote.captureRequestId = undefined;
    quote.paypalOrderId = undefined;
    quote.paypalOrderStatus = undefined;
    quote.captureId = undefined;
    quote.paidAt = undefined;
    quote.demoInquiry = undefined;
    for (const milestone of quote.milestones) lockMilestone(milestone);
    return structuredClone(quote);
  });
}
