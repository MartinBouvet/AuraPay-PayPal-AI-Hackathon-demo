import { getService, matchService, serviceBounds, type CatalogService } from "@/lib/domain/catalog";
import { DomainError } from "@/lib/domain/errors";
import { formatMoney, parseOfferToCents, type Currency } from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/types";

const ACCEPTANCE =
  /^(?:i\s+accept|accept|accepted|ok|okay|yes|deal|agreed|agree|let's go|lets go|go)(?:[.!\s].*)?$/i;

export function openNegotiation(brief: string, currency: Currency): {
  service: CatalogService;
  subtotalCents: number;
  message: string;
} {
  const service = matchService(brief);
  const bounds = serviceBounds(service, currency);
  const price = formatMoney(bounds.listCents, currency);
  const floor = formatMoney(bounds.minCents, currency);

  return {
    service,
    subtotalCents: bounds.listCents,
    message: `I am quoting “${service.title}”. The catalog rate is ${price} before tax, with a floor of ${floor} before tax. The server adds ${bounds.taxPercent}% tax and an ${bounds.platformFeePercent}% AuraPay fee. Offer a before-tax amount, or accept this one.`,
  };
}

export function replyToClient(quote: Quote, message: string): {
  subtotalCents: number;
  service: CatalogService;
  agentMessage: string;
  accepted: boolean;
} {
  const currentService = getService(quote.serviceId);
  if (!currentService) {
    throw new DomainError("That service is not in the catalog.", 500, "CATALOG");
  }

  const switched = matchService(`${quote.brief}\n${message}`, currentService);
  const serviceChanged = switched.id !== currentService.id;
  const service = serviceChanged ? switched : currentService;
  const bounds = serviceBounds(service, quote.currency);
  const starting = serviceChanged ? bounds.listCents : quote.subtotalCents;
  const offer = parseOfferToCents(message);
  const clientTurns = quote.rounds.filter((round) => round.role === "client").length + 1;
  const price = (cents: number) => formatMoney(cents, quote.currency);

  if (offer === null && ACCEPTANCE.test(message.trim()) && !serviceChanged) {
    return {
      subtotalCents: quote.subtotalCents,
      service,
      accepted: true,
      agentMessage: `Quote accepted at ${price(quote.subtotalCents)} before tax. Tax, the AuraPay fee, and the three milestones are now locked. Checkout will charge exactly those amounts.`,
    };
  }

  if (offer === null) {
    const switchNote = serviceChanged
      ? `Switching to “${service.title}”, listed at ${price(bounds.listCents)} before tax. `
      : "";
    return {
      subtotalCents: starting,
      service,
      accepted: false,
      agentMessage: `${switchNote}Send a before-tax amount. I will not go below ${price(bounds.minCents)} or above ${price(bounds.listCents)}.`,
    };
  }

  if (offer > bounds.listCents) {
    return {
      subtotalCents: bounds.listCents,
      service,
      accepted: true,
      agentMessage: `That offer is above the catalog rate. I am locking the quote at ${price(bounds.listCents)} before tax.`,
    };
  }

  if (offer < bounds.minCents) {
    return {
      subtotalCents: starting,
      service,
      accepted: false,
      agentMessage: `${price(offer)} before tax is under the ${price(bounds.minCents)} floor. The current amount stays ${price(starting)} before tax.`,
    };
  }

  const band = Math.round(starting * 0.97);
  if (offer >= band || clientTurns >= 4) {
    return {
      subtotalCents: offer,
      service,
      accepted: true,
      agentMessage: `I accept ${price(offer)} before tax. Tax and the milestone split are recalculated now and will not move.`,
    };
  }

  const midpoint = Math.max(bounds.minCents, Math.round((offer + starting) / 2));
  if (midpoint === offer) {
    return {
      subtotalCents: offer,
      service,
      accepted: true,
      agentMessage: `I accept ${price(offer)} before tax.`,
    };
  }

  return {
    subtotalCents: midpoint,
    service,
    accepted: false,
    agentMessage: `I can come down to ${price(midpoint)} before tax, not ${price(offer)}. The floor stays ${price(bounds.minCents)}.`,
  };
}
