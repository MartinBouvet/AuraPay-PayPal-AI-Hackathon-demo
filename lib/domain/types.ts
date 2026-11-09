import type { Currency } from "@/lib/domain/money";

export type QuoteStatus = "negotiating" | "accepted" | "invoiced" | "paid";

export type MilestoneStatus = "locked" | "releasing" | "released" | "failed";

export type Party = {
  givenName: string;
  surname: string;
  email: string;
};

export type Provider = {
  name: string;
  email: string;
  paypalId?: string;
};

export type Round = {
  id: string;
  role: "client" | "agent";
  message: string;
  subtotalCents: number;
  at: string;
};

export type Milestone = {
  id: string;
  label: string;
  percent: number;
  amountCents: number;
  status: MilestoneStatus;
  payoutRequestId?: string;
  senderBatchId?: string;
  payoutBatchId?: string;
  payoutBatchStatus?: string;
  payoutItemStatus?: string;
  payoutRecipient?: string;
  releasingAt?: string;
  releasedAt?: string;
  payoutError?: { message: string; issue?: string; debugId?: string };
};

export type DemoInquiry = {
  draftedAt: string;
  message: string;
  submittedAt?: string;
  paypalDisputeId?: string;
};

export type Quote = {
  id: string;
  createdAt: string;
  brief: string;
  serviceId: string;
  title: string;
  currency: Currency;
  taxPercent: number;
  platformFeePercent: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  platformFeeCents: number;
  providerPoolCents: number;
  status: QuoteStatus;
  rounds: Round[];
  buyer: Party;
  provider: Provider;
  milestones: Milestone[];
  invoiceNumber: string;
  invoiceRequestId?: string;
  paypalInvoiceId?: string;
  payerViewUrl?: string;
  qrDataUrl?: string;
  invoiceDue?: string;
  orderRequestId?: string;
  captureRequestId?: string;
  paypalOrderId?: string;
  paypalOrderStatus?: string;
  captureId?: string;
  paidAt?: string;
  demoInquiry?: DemoInquiry;
};

export type ActivityEvent = {
  id: string;
  at: string;
  type: string;
  status: "processed" | "ignored" | "failed";
  summary: string;
  debugId?: string;
};

export type StoreData = {
  quotes: Quote[];
  events: ActivityEvent[];
  processedWebhookIds: string[];
};
