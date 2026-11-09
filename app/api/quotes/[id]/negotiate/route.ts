import { presentQuote } from "@/lib/domain/present";
import { negotiateQuote } from "@/lib/domain/quotes";
import { idSchema, negotiateSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(idSchema, id);
    const body = parseBody(negotiateSchema, await readJson(request));
    const quote = presentQuote(await negotiateQuote(id, body));
    return json({ quote });
  } catch (error) {
    return errorResponse(error);
  }
}
