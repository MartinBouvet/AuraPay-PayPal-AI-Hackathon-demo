import type { PublicQuote } from "@/lib/domain/present";

export function buildExecutionDossier(quote: PublicQuote, note?: string): string {
  const released = quote.milestones.filter((milestone) => milestone.status === "released");
  const lines = [
    `AuraPay file ${quote.id}.`,
    `Service: ${quote.title}.`,
    `Accepted quote: ${quote.subtotal} before tax, tax ${quote.tax} (${quote.taxPercent}%), total ${quote.total}.`,
    `Invoice ${quote.invoiceNumber}${quote.paypalInvoiceId ? ` (PayPal ${quote.paypalInvoiceId})` : ""}.`,
    quote.captureId
      ? `Payment captured: ${quote.captureId}, order ${quote.paypalOrderId ?? "n/a"}.`
      : "No capture is recorded in AuraPay yet.",
    released.length
      ? `Milestones already paid: ${released.map((milestone) => `${milestone.label} ${milestone.amount}`).join("; ")}.`
      : "No milestone has been paid yet.",
    "Negotiation log:",
    ...quote.rounds.map((round) => `- ${round.role === "agent" ? "Agent" : "Client"}: ${round.message}`),
  ];

  if (note?.trim()) {
    lines.push(`Mediator note: ${note.trim()}`);
  }

  return lines.join("\n").slice(0, 2000);
}
