import { createOrderForQuote } from "@/lib/domain/checkout-flow";
import { presentQuote } from "@/lib/domain/present";
import { orderCreateSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = parseBody(orderCreateSchema, await readJson(request));
    const created = await createOrderForQuote(body.quoteId, body.mockApplicationCode);
    return json({ orderId: created.orderId, quote: presentQuote(created.quote) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
