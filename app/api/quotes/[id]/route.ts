import { buildExecutionDossier } from "@/lib/domain/dossier";
import { presentQuote } from "@/lib/domain/present";
import { idSchema, parseBody } from "@/lib/domain/schemas";
import { getQuote } from "@/lib/domain/store";
import { errorResponse, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    parseBody(idSchema, id);
    const quote = presentQuote(await getQuote(id));
    return json({ quote, dossier: buildExecutionDossier(quote) });
  } catch (error) {
    return errorResponse(error);
  }
}
