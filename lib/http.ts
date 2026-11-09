import { DomainError } from "@/lib/domain/errors";
import { PayPalApiError, PayPalConfigError } from "@/lib/paypal/errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof PayPalConfigError || error instanceof DomainError) {
    return json(
      { error: { message: error.message, issue: error.issue, debugId: null } },
      error.status,
    );
  }

  if (error instanceof PayPalApiError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
    return json(
      {
        error: {
          message: error.message,
          issue: error.issue ?? "PAYPAL_ERROR",
          debugId: error.debugId ?? null,
        },
      },
      status,
    );
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return json({ error: { message: "PayPal did not respond in time.", issue: "TIMEOUT", debugId: null } }, 504);
  }

  console.error(JSON.stringify({ source: "aurapay", message: error instanceof Error ? error.message : "error" }));
  return json({ error: { message: "AuraPay hit an internal error.", issue: "INTERNAL", debugId: null } }, 500);
}
