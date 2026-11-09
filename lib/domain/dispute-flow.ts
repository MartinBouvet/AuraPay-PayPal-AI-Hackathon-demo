import { buildExecutionDossier } from "@/lib/domain/dossier";
import { DomainError } from "@/lib/domain/errors";
import { presentQuote } from "@/lib/domain/present";
import { getQuote } from "@/lib/domain/store";
import {
  getDispute,
  listDisputes,
  provideDisputeEvidence,
  sendDisputeMessage,
  type PayPalDispute,
} from "@/lib/paypal/disputes";

function requestedEvidence(dispute: PayPalDispute): string {
  const requested = dispute.evidences?.find((evidence) => evidence.source === "REQUESTED_FROM_SELLER");
  return requested?.evidence_type || "OTHER";
}

export async function listDisputeCases(): Promise<PayPalDispute[]> {
  const list = await listDisputes();
  return list.items ?? [];
}

export async function respondToDispute(input: {
  disputeId: string;
  quoteId: string;
  note?: string;
  action: "message" | "evidence";
}): Promise<{ dispute: PayPalDispute; dossier: string }> {
  const quote = presentQuote(await getQuote(input.quoteId));
  const dossier = buildExecutionDossier(quote, input.note);
  const dispute = await getDispute(input.disputeId);
  const stage = dispute.dispute_life_cycle_stage;
  const action = input.action === "message" || stage === "INQUIRY" ? "message" : "evidence";

  if (action === "message" && stage && stage !== "INQUIRY") {
    throw new DomainError(
      "PayPal accepts a direct message only during the inquiry stage. Submit evidence instead.",
      409,
      "DISPUTE_STAGE",
    );
  }

  if (action === "message") {
    await sendDisputeMessage(input.disputeId, dossier, crypto.randomUUID());
  } else {
    await provideDisputeEvidence({
      disputeId: input.disputeId,
      requestId: crypto.randomUUID(),
      evidenceType: requestedEvidence(dispute),
      notes: dossier,
    });
  }

  return { dispute: await getDispute(input.disputeId), dossier };
}
