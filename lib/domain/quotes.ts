import { openNegotiation, replyToClient } from "@/lib/domain/agent";
import { serviceBounds } from "@/lib/domain/catalog";
import { DomainError } from "@/lib/domain/errors";
import { reprice } from "@/lib/domain/pricing";
import { requireQuote, updateStore } from "@/lib/domain/store";
import type { Quote } from "@/lib/domain/types";
import type { createQuoteSchema, negotiateSchema } from "@/lib/domain/schemas";
import type { z } from "zod";

type CreateInput = z.infer<typeof createQuoteSchema>;
type NegotiateInput = z.infer<typeof negotiateSchema>;

function invoiceNumber(): string {
  return `AUR${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
}

export async function createQuote(input: CreateInput): Promise<Quote> {
  const paypalId = input.provider.paypalId?.trim();
  if (paypalId && !/^[A-Za-z0-9]{5,50}$/.test(paypalId)) {
    throw new DomainError("The provider PayPal ID is invalid.", 400, "PAYPAL_ID");
  }

  const opened = openNegotiation(input.brief, input.currency);
  const now = new Date().toISOString();

  return updateStore((store) => {
    const quote: Quote = {
      id: crypto.randomUUID(),
      createdAt: now,
      brief: input.brief,
      serviceId: opened.service.id,
      title: opened.service.title,
      currency: input.currency,
      taxPercent: serviceBounds(opened.service, input.currency).taxPercent,
      platformFeePercent: serviceBounds(opened.service, input.currency).platformFeePercent,
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
      platformFeeCents: 0,
      providerPoolCents: 0,
      status: "negotiating",
      rounds: [],
      buyer: input.buyer,
      provider: {
        name: input.provider.name,
        email: input.provider.email,
        paypalId: paypalId || undefined,
      },
      milestones: [],
      invoiceNumber: invoiceNumber(),
    };

    reprice(quote, opened.subtotalCents, opened.service.id);
    quote.rounds.push({
      id: crypto.randomUUID(),
      role: "agent",
      message: opened.message,
      subtotalCents: quote.subtotalCents,
      at: now,
    });
    store.quotes.unshift(quote);
    return structuredClone(quote);
  });
}

export async function negotiateQuote(quoteId: string, input: NegotiateInput): Promise<Quote> {
  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    if (quote.status !== "negotiating") {
      throw new DomainError("This quote is already locked.", 409, "QUOTE_LOCKED");
    }

    const now = new Date().toISOString();
    const reply = replyToClient(quote, input.message);
    quote.rounds.push({
      id: crypto.randomUUID(),
      role: "client",
      message: input.message,
      subtotalCents: quote.subtotalCents,
      at: now,
    });
    reprice(quote, reply.subtotalCents, reply.service.id);
    if (reply.accepted) quote.status = "accepted";
    quote.rounds.push({
      id: crypto.randomUUID(),
      role: "agent",
      message: reply.agentMessage,
      subtotalCents: quote.subtotalCents,
      at: new Date().toISOString(),
    });

    return structuredClone(quote);
  });
}

export async function acceptCurrentOffer(quoteId: string): Promise<Quote> {
  return updateStore((store) => {
    const quote = requireQuote(store, quoteId);
    if (quote.status !== "negotiating") {
      throw new DomainError("This quote is already locked.", 409, "QUOTE_LOCKED");
    }
    quote.status = "accepted";
    quote.rounds.push({
      id: crypto.randomUUID(),
      role: "agent",
      message: "Offer accepted as it stands. Amounts are locked for the invoice and checkout.",
      subtotalCents: quote.subtotalCents,
      at: new Date().toISOString(),
    });
    return structuredClone(quote);
  });
}
