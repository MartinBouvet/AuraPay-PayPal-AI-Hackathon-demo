import { captureOrderForQuote } from "@/lib/domain/checkout-flow";
import { DomainError } from "@/lib/domain/errors";
import { presentQuote } from "@/lib/domain/present";
import { captureSchema, parseBody, paypalResourceIdSchema, readJson } from "@/lib/domain/schemas";
import { readStore } from "@/lib/domain/store";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(paypalResourceIdSchema, id);
    const body = parseBody(captureSchema, await readJson(request));
    const quote = readStore().quotes.find((item) => item.paypalOrderId === id);
    if (!quote) {
      throw new DomainError("No AuraPay order matches this id.", 404, "ORDER_NOT_FOUND");
    }
    const paid = await captureOrderForQuote(quote.id, id, body.mockApplicationCode);
    return json({ quote: presentQuote(paid) });
  } catch (error) {
    return errorResponse(error);
  }
}
