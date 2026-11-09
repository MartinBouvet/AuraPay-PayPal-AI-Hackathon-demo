import { respondToDispute } from "@/lib/domain/dispute-flow";
import { disputeRespondSchema, parseBody, paypalResourceIdSchema, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(paypalResourceIdSchema, id);
    const body = parseBody(disputeRespondSchema, await readJson(request));
    const result = await respondToDispute({ disputeId: id, ...body });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
