import { presentQuote } from "@/lib/domain/present";
import { idSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { emitDevelopmentCapture } from "@/lib/domain/webhook-flow";
import { errorResponse, json } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ quoteId: idSchema }).strict();

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return json({ error: { message: "Not found.", issue: "NOT_FOUND", debugId: null } }, 404);
  }

  try {
    const body = parseBody(bodySchema, await readJson(request));
    const quote = presentQuote(await emitDevelopmentCapture(body.quoteId));
    return json({ quote });
  } catch (error) {
    return errorResponse(error);
  }
}
