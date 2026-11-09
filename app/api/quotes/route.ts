import { presentQuote } from "@/lib/domain/present";
import { createQuote } from "@/lib/domain/quotes";
import { createQuoteSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { readStore } from "@/lib/domain/store";
import { errorResponse, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const quotes = readStore().quotes.map(presentQuote);
  return json({ quotes });
}

export async function POST(request: Request) {
  try {
    const body = parseBody(createQuoteSchema, await readJson(request));
    const quote = presentQuote(await createQuote(body));
    return json({ quote }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
