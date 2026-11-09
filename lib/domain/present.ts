import { formatMoney } from "@/lib/domain/money";
import { payoutReceiver } from "@/lib/domain/payout-flow";
import { centsToPayPal } from "@/lib/domain/pricing";
import type { ActivityEvent, Milestone, Quote, Round } from "@/lib/domain/types";

export type PublicMilestone = {
  id: string;
  label: string;
  percent: number;
  amount: string;
  amountDecimal: string;
  status: Milestone["status"];
  payoutBatchId?: string;
  payoutBatchStatus?: string;
  payoutItemStatus?: string;
  payoutRecipient?: string;
  releasedAt?: string;
  payoutError?: Milestone["payoutError"];
};

export type PublicRound = {
  id: string;
  role: Round["role"];
  message: string;
  subtotal: string;
  at: string;
};

export type PublicQuote = {
  id: string;
  createdAt: string;
  brief: string;
  serviceId: string;
  title: string;
  currency: Quote["currency"];
  taxPercent: number;
  platformFeePercent: number;
  status: Quote["status"];
  subtotal: string;
  tax: string;
  total: string;
  platformFee: string;
  providerPool: string;
  totalDecimal: string;
  subtotalDecimal: string;
  taxDecimal: string;
  buyer: Quote["buyer"];
  provider: { name: string; email: string; payoutDestination: string };
  rounds: PublicRound[];
  milestones: PublicMilestone[];
  invoiceNumber: string;
  paypalInvoiceId?: string;
  payerViewUrl?: string;
  qrDataUrl?: string;
  invoiceDue?: string;
  paypalOrderId?: string;
  paypalOrderStatus?: string;
  captureId?: string;
  paidAt?: string;
  demoInquiry?: Quote["demoInquiry"];
};

function presentMilestone(milestone: Milestone, currency: Quote["currency"]): PublicMilestone {
  return {
    id: milestone.id,
    label: milestone.label,
    percent: milestone.percent,
    amount: formatMoney(milestone.amountCents, currency),
    amountDecimal: centsToPayPal(milestone.amountCents),
    status: milestone.status,
    payoutBatchId: milestone.payoutBatchId,
    payoutBatchStatus: milestone.payoutBatchStatus,
    payoutItemStatus: milestone.payoutItemStatus,
    payoutRecipient: milestone.payoutRecipient,
    releasedAt: milestone.releasedAt,
    payoutError: milestone.payoutError,
  };
}

export function presentQuote(quote: Quote): PublicQuote {
  return {
    id: quote.id,
    createdAt: quote.createdAt,
    brief: quote.brief,
    serviceId: quote.serviceId,
    title: quote.title,
    currency: quote.currency,
    taxPercent: quote.taxPercent,
    platformFeePercent: quote.platformFeePercent,
    status: quote.status,
    subtotal: formatMoney(quote.subtotalCents, quote.currency),
    tax: formatMoney(quote.taxCents, quote.currency),
    total: formatMoney(quote.totalCents, quote.currency),
    platformFee: formatMoney(quote.platformFeeCents, quote.currency),
    providerPool: formatMoney(quote.providerPoolCents, quote.currency),
    totalDecimal: centsToPayPal(quote.totalCents),
    subtotalDecimal: centsToPayPal(quote.subtotalCents),
    taxDecimal: centsToPayPal(quote.taxCents),
    buyer: quote.buyer,
    provider: {
      name: quote.provider.name,
      email: quote.provider.email,
      payoutDestination: payoutReceiver(quote).receiver,
    },
    rounds: quote.rounds.map((round) => ({
      id: round.id,
      role: round.role,
      message: round.message,
      subtotal: formatMoney(round.subtotalCents, quote.currency),
      at: round.at,
    })),
    milestones: quote.milestones.map((milestone) => presentMilestone(milestone, quote.currency)),
    invoiceNumber: quote.invoiceNumber,
    paypalInvoiceId: quote.paypalInvoiceId,
    payerViewUrl: quote.payerViewUrl,
    qrDataUrl: quote.qrDataUrl,
    invoiceDue: quote.invoiceDue,
    paypalOrderId: quote.paypalOrderId,
    paypalOrderStatus: quote.paypalOrderStatus,
    captureId: quote.captureId,
    paidAt: quote.paidAt,
    demoInquiry: quote.demoInquiry,
  };
}

export function presentEvent(event: ActivityEvent) {
  return event;
}
