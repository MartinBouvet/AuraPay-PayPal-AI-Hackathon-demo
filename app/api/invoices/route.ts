import { issueInvoice } from "@/lib/domain/invoice-flow";
import { presentQuote } from "@/lib/domain/present";
import { invoiceCreateSchema, parseBody, readJson } from "@/lib/domain/schemas";
import { errorResponse, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = parseBody(invoiceCreateSchema, await readJson(request));
    const quote = presentQuote(await issueInvoice(body.quoteId, body.mockApplicationCode));
    return json({ quote }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
