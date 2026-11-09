import { processPayPalWebhook } from "@/lib/domain/webhook-flow";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ listener: "aurapay", method: "POST" });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const snapshot = {
    rawBody,
    authAlgo: request.headers.get("paypal-auth-algo") ?? "",
    certUrl: request.headers.get("paypal-cert-url") ?? "",
    transmissionId: request.headers.get("paypal-transmission-id") ?? "",
    transmissionSig: request.headers.get("paypal-transmission-sig") ?? "",
    transmissionTime: request.headers.get("paypal-transmission-time") ?? "",
  };

  void processPayPalWebhook(snapshot).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        source: "aurapay-webhook",
        message: error instanceof Error ? error.message : "error",
      }),
    );
  });

  return new Response(null, { status: 204 });
}
