import { draftBuyerInquiry } from "@/lib/domain/dispute-draft";
import { presentQuote } from "@/lib/domain/present";
import { disputeDraftSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = parseBody(disputeDraftSchema, await readJson(request));
    const quote = presentQuote(await draftBuyerInquiry(body.quoteId));
    return json({
      quote,
      draft: quote.demoInquiry ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
