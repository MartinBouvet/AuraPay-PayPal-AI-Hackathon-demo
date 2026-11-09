import { paypalJson } from "@/lib/paypal/client";
import { DomainError } from "@/lib/domain/errors";

const CERT_HOSTS = new Set([
  "api.paypal.com",
  "api.sandbox.paypal.com",
  "api-m.paypal.com",
  "api-m.sandbox.paypal.com",
]);

export function assertPayPalCertUrl(certUrl: string): void {
  let url: URL;
  try {
    url = new URL(certUrl);
  } catch {
    throw new DomainError("The paypal-cert-url header is unreadable.", 400, "BAD_CERT_URL");
  }

  if (url.protocol !== "https:" || !CERT_HOSTS.has(url.hostname)) {
    throw new DomainError("The webhook certificate is not hosted by PayPal.", 400, "BAD_CERT_URL");
  }
}

export async function verifyWebhookSignature(input: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: unknown;
}): Promise<boolean> {
  assertPayPalCertUrl(input.certUrl);

  const result = await paypalJson<{ verification_status?: string }>({
    method: "POST",
    path: "/v1/notifications/verify-webhook-signature",
    requestId: crypto.randomUUID(),
    json: {
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSig,
      transmission_time: input.transmissionTime,
      webhook_id: input.webhookId,
      webhook_event: input.webhookEvent,
    },
  });

  return result.verification_status === "SUCCESS";
}
