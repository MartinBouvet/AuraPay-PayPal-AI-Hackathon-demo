import { getBrowserClientToken } from "@/lib/paypal/auth";
import { errorResponse, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await getBrowserClientToken();
    return json({ clientToken: token.clientToken, expiresIn: token.expiresIn });
  } catch (error) {
    return errorResponse(error);
  }
}
