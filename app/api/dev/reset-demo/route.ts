import { BRAND_IDENTITY_DEMO_ID, resetDemoMission } from "@/lib/domain/demo-reset";
import { presentQuote } from "@/lib/domain/present";
import { idSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    quoteId: idSchema.optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return json({ error: { message: "Not found.", issue: "NOT_FOUND", debugId: null } }, 404);
  }

  try {
    const body = parseBody(bodySchema, await readJson(request));
    const quote = presentQuote(await resetDemoMission(body.quoteId ?? BRAND_IDENTITY_DEMO_ID));
    return json({ quote });
  } catch (error) {
    return errorResponse(error);
  }
}
