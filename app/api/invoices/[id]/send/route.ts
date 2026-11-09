import { deliverInvoice } from "@/lib/domain/invoice-flow";
import { presentQuote } from "@/lib/domain/present";
import { idSchema, parseBody } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(idSchema, id);
    const quote = presentQuote(await deliverInvoice(id));
    return json({ quote });
  } catch (error) {
    return errorResponse(error);
  }
}
