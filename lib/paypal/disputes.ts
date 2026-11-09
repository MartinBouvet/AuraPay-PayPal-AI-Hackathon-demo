import { paypalForm, paypalJson } from "@/lib/paypal/client";

export type PayPalDispute = {
  dispute_id?: string;
  reason?: string;
  status?: string;
  dispute_state?: string;
  dispute_life_cycle_stage?: string;
  dispute_amount?: { currency_code?: string; value?: string };
  create_time?: string;
  update_time?: string;
  messages?: Array<{ posted_by?: string; content?: string; time_posted?: string }>;
  evidences?: Array<{ evidence_type?: string; source?: string; notes?: string }>;
  links?: Array<{ href?: string; rel?: string }>;
};

export type DisputeList = {
  items?: PayPalDispute[];
};

export async function listDisputes(): Promise<DisputeList> {
  return paypalJson<DisputeList>({
    method: "GET",
    path: "/v1/customer/disputes?page_size=10&page=1",
  });
}

export async function getDispute(disputeId: string): Promise<PayPalDispute> {
  return paypalJson<PayPalDispute>({
    method: "GET",
    path: `/v1/customer/disputes/${encodeURIComponent(disputeId)}`,
  });
}

export async function sendDisputeMessage(disputeId: string, message: string, requestId: string): Promise<unknown> {
  return paypalJson({
    method: "POST",
    path: `/v1/customer/disputes/${encodeURIComponent(disputeId)}/send-message`,
    requestId,
    json: { message },
  });
}

export async function provideDisputeEvidence(input: {
  disputeId: string;
  requestId: string;
  evidenceType: string;
  notes: string;
}): Promise<unknown> {
  const form = new FormData();
  const payload = {
    evidences: [
      {
        evidence_type: input.evidenceType,
        notes: input.notes,
      },
    ],
  };
  form.append("input", new Blob([JSON.stringify(payload)], { type: "application/json" }));

  return paypalForm(
    `/v1/customer/disputes/${encodeURIComponent(input.disputeId)}/provide-evidence`,
    form,
    input.requestId,
  );
}
