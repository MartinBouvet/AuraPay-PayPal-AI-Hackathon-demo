import { buildExecutionDossier } from "@/lib/domain/dossier";
import { DomainError } from "@/lib/domain/errors";
import { presentQuote } from "@/lib/domain/present";
import type { PublicQuote } from "@/lib/domain/present";
import { getQuote, requireQuote, updateStore } from "@/lib/domain/store";
import type { Quote } from "@/lib/domain/types";
import { sendDisputeMessage } from "@/lib/paypal/disputes";

export const DEMO_DISPUTE_QUOTE_ID = "4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c";

export function draftInquiryMessage(quote: PublicQuote): string {
  const released = quote.milestones.filter((milestone) => milestone.status === "released");
  const waiting = quote.milestones.filter((milestone) => milestone.status !== "released");
  const paid = released
    .map((milestone) => {
      const batch = milestone.payoutBatchId ? ` (batch ${milestone.payoutBatchId})` : "";
      return `${milestone.label} ${milestone.amount}${batch}`;
    })
    .join("; ");
  const held = waiting.map((milestone) => `${milestone.label} ${milestone.amount}`).join("; ");
  const evidence = buildExecutionDossier(quote);

  const message = [
    "Hello,",
    "",
    `Thank you for the inquiry on “${quote.title}”.`,
    "The accepted quote, tax, and platform fee were locked on the server before checkout. Funds stay in escrow and leave only when a milestone is approved.",
    paid ? `Already released to the provider: ${paid}.` : "No milestone has been released yet.",
    held ? `Still held for approval: ${held}.` : "Every milestone has been released.",
    "We can finish the remaining work and release the matching payouts. If a deliverable is missing, reply on this inquiry and we will attach the execution log.",
    "",
    "Evidence from the AuraPay audit log:",
    evidence,
  ].join("\n");

  return message.slice(0, 2000);
}

export async function draftBuyerInquiry(quoteId: string): Promise<Quote> {
  const current = presentQuote(await getQuote(quoteId));
  const message = draftInquiryMessage(current);

  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    quote.demoInquiry = {
      draftedAt: new Date().toISOString(),
      message,
      submittedAt: undefined,
      paypalDisputeId: undefined,
    };
    return structuredClone(quote);
  });
}

export async function submitBuyerInquiry(quoteId: string, disputeId?: string): Promise<Quote> {
  const existing = await getQuote(quoteId);
  if (!existing.demoInquiry?.message) {
    throw new DomainError("Draft the inquiry response before sending it.", 409, "DRAFT_MISSING");
  }

  let paypalDisputeId: string | undefined;
  if (disputeId?.trim()) {
    await sendDisputeMessage(disputeId.trim(), existing.demoInquiry.message, crypto.randomUUID());
    paypalDisputeId = disputeId.trim();
  }

  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    if (!quote.demoInquiry) return structuredClone(quote);
    quote.demoInquiry.submittedAt = new Date().toISOString();
    quote.demoInquiry.paypalDisputeId = paypalDisputeId;
    return structuredClone(quote);
  });
}
