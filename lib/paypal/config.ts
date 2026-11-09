import { paypalEnvSchema } from "@/lib/paypal/env";
import { PayPalConfigError } from "@/lib/paypal/errors";

export const MOCK_APPLICATION_CODES = [
  "INSTRUMENT_DECLINED",
  "TRANSACTION_REFUSED",
  "PAYER_CANNOT_PAY",
  "INTERNAL_SERVER_ERROR",
  "DUPLICATE_INVOICE_ID",
  "DUPLICATE_INVOICE_NUMBER",
] as const;

export type MockApplicationCode = (typeof MOCK_APPLICATION_CODES)[number];

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  webhookId: string;
  merchantEmail: string;
  samplePayoutRecipient: string;
  sandbox: boolean;
};

export function isPayPalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

export function paypalSdkScriptUrl(): string {
  const base = process.env.PAYPAL_API_BASE ?? "";
  if (base.includes("sandbox") || base.length === 0) {
    return "https://www.sandbox.paypal.com/web-sdk/v6/core";
  }
  return "https://www.paypal.com/web-sdk/v6/core";
}

export function getPayPalConfig(): PayPalConfig {
  const parsedEnv = paypalEnvSchema.safeParse({
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    PAYPAL_API_BASE: process.env.PAYPAL_API_BASE,
    PAYPAL_MERCHANT_EMAIL: process.env.PAYPAL_MERCHANT_EMAIL,
    PAYPAL_SAMPLE_PAYOUT_RECIPIENT: process.env.PAYPAL_SAMPLE_PAYOUT_RECIPIENT,
  });

  if (!parsedEnv.success) {
    const message = parsedEnv.error.issues.map((issue) => issue.message).join(" ");
    throw new PayPalConfigError(message);
  }

  const clientId = parsedEnv.data.PAYPAL_CLIENT_ID;
  const clientSecret = parsedEnv.data.PAYPAL_CLIENT_SECRET;
  const webhookId = parsedEnv.data.PAYPAL_WEBHOOK_ID;
  const merchantEmail = parsedEnv.data.PAYPAL_MERCHANT_EMAIL;
  const samplePayoutRecipient = parsedEnv.data.PAYPAL_SAMPLE_PAYOUT_RECIPIENT;
  const apiBase = (parsedEnv.data.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com").replace(/\/$/, "");

  let parsed: URL;
  try {
    parsed = new URL(apiBase);
  } catch {
    throw new PayPalConfigError("PAYPAL_API_BASE is not a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new PayPalConfigError("PAYPAL_API_BASE must use https.");
  }

  return {
    clientId,
    clientSecret,
    apiBase,
    webhookId,
    merchantEmail,
    samplePayoutRecipient,
    sandbox: apiBase.includes("sandbox"),
  };
}

export function integrationStatus() {
  return {
    paypalConfigured: isPayPalConfigured(),
    webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
    merchantConfigured: Boolean(process.env.PAYPAL_MERCHANT_EMAIL?.trim()),
    sandbox: (process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com").includes("sandbox"),
    sdkScriptUrl: paypalSdkScriptUrl(),
  };
}
