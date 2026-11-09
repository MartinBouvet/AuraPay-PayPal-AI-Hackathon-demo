import { DomainError } from "@/lib/domain/errors";
import { centsToPayPal, milestoneIndex, previousMilestoneReleased } from "@/lib/domain/pricing";
import { getQuote, requireQuote, updateStore } from "@/lib/domain/store";
import type { Milestone, Quote } from "@/lib/domain/types";
import { PayPalApiError } from "@/lib/paypal/errors";
import { createPayoutBatch, getPayoutBatch } from "@/lib/paypal/payouts";

const RELEASE_STALE_MS = 120_000;

function sandboxPayPalEmail(email: string): boolean {
  return /@(?:personal|business)\.example\.com$/i.test(email.trim());
}

/** Placeholder addresses such as studio.north@example.com cannot receive a sandbox payout. */
export function payoutReceiver(quote: Quote): { recipientType: "EMAIL" | "PAYPAL_ID"; receiver: string } {
  if (quote.provider.paypalId) {
    return { recipientType: "PAYPAL_ID", receiver: quote.provider.paypalId };
  }
  const email = quote.provider.email.trim();
  const sample = process.env.PAYPAL_SAMPLE_PAYOUT_RECIPIENT?.trim() ?? "";
  if (sample && !sandboxPayPalEmail(email)) {
    return { recipientType: "EMAIL", receiver: sample };
  }
  return { recipientType: "EMAIL", receiver: email };
}

function recipient(quote: Quote): { recipientType: "EMAIL" | "PAYPAL_ID"; receiver: string } {
  const target = payoutReceiver(quote);
  if (target.recipientType === "EMAIL" && !sandboxPayPalEmail(target.receiver)) {
    throw new DomainError(
      "Set PAYPAL_SAMPLE_PAYOUT_RECIPIENT to a Personal sandbox email (sb-…@personal.example.com). Placeholder addresses cannot receive a payout.",
      409,
      "PAYOUT_RECIPIENT",
    );
  }
  return target;
}

function rememberFailure(milestone: Milestone, error: unknown): void {
  milestone.status = "failed";
  if (error instanceof PayPalApiError) {
    milestone.payoutError = {
      message: error.message,
      issue: error.issue,
      debugId: error.debugId,
    };
    return;
  }
  milestone.payoutError = {
    message: error instanceof Error ? error.message : "The payout failed.",
  };
}

export async function releaseMilestone(quoteId: string, milestoneId: string): Promise<Quote> {
  const prepared = await updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    if (quote.status !== "paid") {
      throw new DomainError("Funds are released after the payment is captured.", 409, "NOT_PAID");
    }
    const index = milestoneIndex(quote, milestoneId);
    const milestone = quote.milestones[index];
    if (!milestone) throw new DomainError("Milestone not found.", 404, "MILESTONE_NOT_FOUND");
    if (milestone.status === "released") return { action: "done" as const };
    if (!previousMilestoneReleased(quote.milestones, index)) {
      throw new DomainError("The previous milestone has not been released.", 409, "MILESTONE_ORDER");
    }
    if (milestone.status === "releasing" && milestone.releasingAt) {
      const age = Date.now() - Date.parse(milestone.releasingAt);
      if (age < RELEASE_STALE_MS) return { action: "busy" as const };
    }
    if (milestone.status === "failed") {
      milestone.payoutRequestId = crypto.randomUUID();
      milestone.senderBatchId = `aurapay-${milestone.id}-${crypto.randomUUID().slice(0, 8)}`;
      milestone.payoutBatchId = undefined;
      milestone.releasedAt = undefined;
    }
    if (!milestone.payoutRequestId) milestone.payoutRequestId = crypto.randomUUID();
    if (!milestone.senderBatchId) milestone.senderBatchId = `aurapay-${milestone.id}`;
    milestone.status = "releasing";
    milestone.releasingAt = new Date().toISOString();
    milestone.payoutError = undefined;
    return {
      action: "go" as const,
      requestId: milestone.payoutRequestId,
      senderBatchId: milestone.senderBatchId,
      amount: centsToPayPal(milestone.amountCents),
      currency: quote.currency,
      note: `${quote.title} — ${milestone.label}`,
      recipient: recipient(quote),
    };
  });

  if (prepared.action === "busy") {
    throw new DomainError("A payout is already in progress for this milestone.", 409, "PAYOUT_IN_PROGRESS");
  }
  if (prepared.action === "done") return getQuote(quoteId);

  try {
    const batch = await createPayoutBatch({
      requestId: prepared.requestId,
      senderBatchId: prepared.senderBatchId,
      senderItemId: milestoneId,
      currency: prepared.currency,
      value: prepared.amount,
      recipient: prepared.recipient,
      note: prepared.note,
    });

    return updateStore((store) => {
      const quote = requireQuote(store, quoteId);
      const milestone = quote.milestones.find((item) => item.id === milestoneId);
      if (!milestone) return structuredClone(quote);
      milestone.status = "released";
      milestone.payoutBatchId = batch.batch_header?.payout_batch_id;
      milestone.payoutBatchStatus = batch.batch_header?.batch_status;
      milestone.payoutRecipient = prepared.recipient.receiver;
      milestone.releasedAt = new Date().toISOString();
      milestone.payoutError = undefined;
      return structuredClone(quote);
    });
  } catch (error) {
    await updateStore((store) => {
      const quote = requireQuote(store, quoteId);
      const milestone = quote.milestones.find((item) => item.id === milestoneId);
      if (milestone) rememberFailure(milestone, error);
    });
    throw error;
  }
}

export async function refreshMilestone(quoteId: string, milestoneId: string): Promise<Quote> {
  const quote = await getQuote(quoteId);
  const milestone = quote.milestones.find((item) => item.id === milestoneId);
  if (!milestone?.payoutBatchId) {
    throw new DomainError("This milestone does not have a PayPal batch yet.", 409, "PAYOUT_MISSING");
  }

  const batch = await getPayoutBatch(milestone.payoutBatchId);
  const item = batch.items?.find((entry) => entry.payout_item?.sender_item_id === milestoneId);
  const status = item?.transaction_status ?? batch.batch_header?.batch_status;

  return updateStore((store) => {
    const current = requireQuote(store, quoteId);
    const target = current.milestones.find((entry) => entry.id === milestoneId);
    if (!target) return structuredClone(current);
    target.payoutBatchStatus = batch.batch_header?.batch_status;
    target.payoutItemStatus = item?.transaction_status;
    const receiver = item?.payout_item?.receiver;
    if (receiver) target.payoutRecipient = receiver;
    if (status === "SUCCESS" || status === "SUCCEEDED") {
      target.status = "released";
      target.releasedAt = target.releasedAt ?? new Date().toISOString();
      target.payoutError = undefined;
    } else if (
      status === "FAILED" ||
      status === "RETURNED" ||
      status === "BLOCKED" ||
      status === "REFUNDED" ||
      status === "UNCLAIMED"
    ) {
      target.status = "failed";
      target.payoutError = {
        message:
          status === "UNCLAIMED"
            ? "PayPal could not deliver this payout. Use a Personal sandbox email in PAYPAL_SAMPLE_PAYOUT_RECIPIENT."
            : `PayPal status: ${status}`,
        issue: item?.errors?.name,
      };
    }
    return structuredClone(current);
  });
}

export async function markPayoutItem(senderItemId: string, status: string): Promise<void> {
  await updateStore((store) => {
    for (const quote of store.quotes) {
      const milestone = quote.milestones.find((item) => item.id === senderItemId);
      if (!milestone) continue;
      if (status === "SUCCESS" || status === "SUCCEEDED") {
        milestone.status = "released";
        milestone.releasedAt = milestone.releasedAt ?? new Date().toISOString();
        milestone.payoutError = undefined;
      } else if (status === "FAILED" || status === "BLOCKED" || status === "RETURNED" || status === "UNCLAIMED") {
        milestone.status = "failed";
        milestone.payoutError = {
          message:
            status === "UNCLAIMED"
              ? "PayPal could not deliver this payout. Use a Personal sandbox email in PAYPAL_SAMPLE_PAYOUT_RECIPIENT."
              : `PayPal status: ${status}`,
        };
      }
    }
  });
}
