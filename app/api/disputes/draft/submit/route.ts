import { submitBuyerInquiry } from "@/lib/domain/dispute-draft";
import { presentQuote } from "@/lib/domain/present";
import { disputeDraftSubmitSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = parseBody(disputeDraftSubmitSchema, await readJson(request));
    const quote = presentQuote(await submitBuyerInquiry(body.quoteId, body.disputeId));
    return json({
      quote,
      draft: quote.demoInquiry ?? null,
      paypalSent: Boolean(quote.demoInquiry?.paypalDisputeId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
