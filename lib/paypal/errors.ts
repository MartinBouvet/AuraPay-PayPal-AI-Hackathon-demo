export class PayPalApiError extends Error {
  readonly status: number;
  readonly issue?: string;
  readonly debugId?: string;
  readonly description?: string;

  constructor(
    message: string,
    options: { status: number; issue?: string; debugId?: string; description?: string },
  ) {
    super(message);
    this.name = "PayPalApiError";
    this.status = options.status;
    this.issue = options.issue;
    this.debugId = options.debugId;
    this.description = options.description;
  }
}

export class PayPalConfigError extends Error {
  readonly status = 503;
  readonly issue = "PAYPAL_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FRIENDLY_ISSUES: Record<string, string> = {
  INSTRUMENT_DECLINED: "The payment method was declined. Choose another way to pay.",
  TRANSACTION_REFUSED: "PayPal refused this transaction.",
  PAYER_CANNOT_PAY: "This buyer cannot pay with the selected payment method.",
  INTERNAL_SERVER_ERROR: "PayPal returned an internal error. Retry the same request.",
  DUPLICATE_INVOICE_ID: "PayPal already has an invoice with this identifier.",
  DUPLICATE_INVOICE_NUMBER: "PayPal already has an invoice with this number.",
  ORDER_ALREADY_CAPTURED: "This order is already captured.",
  PERMISSION_DENIED: "This sandbox app is not allowed to call that PayPal API.",
};

export function friendlyPayPalMessage(issue: string | undefined, fallback: string): string {
  if (issue && FRIENDLY_ISSUES[issue]) return FRIENDLY_ISSUES[issue];
  return fallback;
}

export function readPayPalError(status: number, body: unknown): PayPalApiError {
  const record = isRecord(body) ? body : {};
  const details = Array.isArray(record.details) ? record.details : [];
  const first = isRecord(details[0]) ? details[0] : undefined;
  const issue = typeof first?.issue === "string" ? first.issue : undefined;
  const description = typeof first?.description === "string" ? first.description : undefined;
  const debugId = typeof record.debug_id === "string" ? record.debug_id : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;
  const fallback =
    description || (typeof record.message === "string" ? record.message : "PayPal rejected the request.");
  const message = friendlyPayPalMessage(issue, fallback);

  console.error(
    JSON.stringify({
      source: "paypal",
      status,
      name: name ?? null,
      issue: issue ?? null,
      debugId: debugId ?? null,
    }),
  );

  return new PayPalApiError(message, { status, issue, debugId, description });
}
