import { DomainError } from "@/lib/domain/errors";
import { refreshMilestone } from "@/lib/domain/payout-flow";
import { presentQuote } from "@/lib/domain/present";
import { idSchema, parseBody } from "@/lib/domain/schemas";
import { readStore } from "@/lib/domain/store";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(idSchema, id);
    const quote = readStore().quotes.find((item) => item.milestones.some((milestone) => milestone.id === id));
    if (!quote) throw new DomainError("Milestone not found.", 404, "MILESTONE_NOT_FOUND");
    return json({ quote: presentQuote(await refreshMilestone(quote.id, id)) });
  } catch (error) {
    return errorResponse(error);
  }
}
