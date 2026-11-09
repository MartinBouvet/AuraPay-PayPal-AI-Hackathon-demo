import { paypalJson } from "@/lib/paypal/client";

export type PayoutBatch = {
  batch_header?: {
    payout_batch_id?: string;
    batch_status?: string;
    sender_batch_header?: { sender_batch_id?: string };
  };
  items?: Array<{
    payout_item_id?: string;
    transaction_status?: string;
    errors?: { name?: string; message?: string };
    payout_item?: { sender_item_id?: string; receiver?: string };
  }>;
};

export type PayoutRecipient = {
  recipientType: "EMAIL" | "PAYPAL_ID";
  receiver: string;
};

export async function createPayoutBatch(input: {
  requestId: string;
  senderBatchId: string;
  senderItemId: string;
  currency: string;
  value: string;
  recipient: PayoutRecipient;
  note: string;
}): Promise<PayoutBatch> {
  return paypalJson<PayoutBatch>({
    method: "POST",
    path: "/v1/payments/payouts",
    requestId: input.requestId,
    json: {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        recipient_type: input.recipient.recipientType,
        email_subject: "AuraPay — a milestone has been released",
        email_message: "The payment was captured. This transfer is the approved milestone.",
      },
      items: [
        {
          recipient_type: input.recipient.recipientType,
          receiver: input.recipient.receiver,
          sender_item_id: input.senderItemId,
          note: input.note.slice(0, 1000),
          amount: {
            value: input.value,
            currency: input.currency,
          },
        },
      ],
    },
  });
}

export async function getPayoutBatch(batchId: string): Promise<PayoutBatch> {
  return paypalJson<PayoutBatch>({
    method: "GET",
    path: `/v1/payments/payouts/${encodeURIComponent(batchId)}`,
  });
}
