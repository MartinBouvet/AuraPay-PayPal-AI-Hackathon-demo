import { getService } from "@/lib/domain/catalog";
import { DomainError } from "@/lib/domain/errors";
import {
  platformFeeCents,
  splitByPercent,
  taxCents,
  type Currency,
} from "@/lib/domain/money";
import type { Milestone, Quote } from "@/lib/domain/types";

export function reprice(quote: Quote, subtotalCents: number, serviceId = quote.serviceId): void {
  const service = getService(serviceId);
  if (!service) {
    throw new DomainError("Service not found.", 500, "CATALOG");
  }

  const tax = taxCents(subtotalCents, quote.taxPercent);
  const total = subtotalCents + tax;
  const fee = platformFeeCents(total, quote.platformFeePercent);
  const pool = total - fee;
  const shares = splitByPercent(
    pool,
    service.milestones.map((milestone) => milestone.percent),
  );

  quote.serviceId = service.id;
  quote.title = service.title;
  quote.subtotalCents = subtotalCents;
  quote.taxCents = tax;
  quote.totalCents = total;
  quote.platformFeeCents = fee;
  quote.providerPoolCents = pool;

  if (quote.milestones.length !== service.milestones.length) {
    quote.milestones = service.milestones.map((milestone, index) => ({
      id: crypto.randomUUID(),
      label: milestone.label,
      percent: milestone.percent,
      amountCents: shares[index] ?? 0,
      status: "locked",
    }));
    return;
  }

  quote.milestones.forEach((milestone, index) => {
    const template = service.milestones[index];
    milestone.label = template?.label ?? milestone.label;
    milestone.percent = template?.percent ?? milestone.percent;
    milestone.amountCents = shares[index] ?? 0;
  });
}

export function assertPayable(quote: Quote): void {
  if (quote.status === "negotiating") {
    throw new DomainError("The quote is still being negotiated.", 409, "QUOTE_OPEN");
  }
  if (quote.status === "paid") {
    throw new DomainError("This file is already paid.", 409, "ALREADY_PAID");
  }
}

export function totalsMatch(quote: Quote, currency: string | undefined, value: string | undefined): boolean {
  return currency === quote.currency && value === centsToPayPal(quote.totalCents);
}

export function centsToPayPal(cents: number): string {
  const absolute = Math.abs(cents);
  return `${Math.floor(absolute / 100)}.${(absolute % 100).toString().padStart(2, "0")}`;
}

export function milestoneIndex(quote: Quote, milestoneId: string): number {
  return quote.milestones.findIndex((milestone) => milestone.id === milestoneId);
}

export function previousMilestoneReleased(milestones: Milestone[], index: number): boolean {
  if (index <= 0) return true;
  return milestones[index - 1]?.status === "released";
}

export function currencyLabel(currency: Currency): string {
  return currency;
}
