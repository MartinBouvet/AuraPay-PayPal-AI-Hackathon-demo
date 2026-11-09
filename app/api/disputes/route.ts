import { listDisputeCases } from "@/lib/domain/dispute-flow";
import { errorResponse, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const disputes = await listDisputeCases();
    return json({ disputes });
  } catch (error) {
    return errorResponse(error);
  }
}
