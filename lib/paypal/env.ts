import { z } from "zod";

export const paypalEnvSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().trim().min(1, "Set PAYPAL_CLIENT_ID in .env.local."),
  PAYPAL_CLIENT_SECRET: z.string().trim().min(1, "Set PAYPAL_CLIENT_SECRET in .env.local. It stays on the server."),
  PAYPAL_WEBHOOK_ID: z.string().trim().optional().default(""),
  PAYPAL_API_BASE: z.union([z.literal(""), z.string().trim().url("PAYPAL_API_BASE must be a valid URL.")]).optional(),
  PAYPAL_MERCHANT_EMAIL: z
    .union([z.literal(""), z.string().trim().email("PAYPAL_MERCHANT_EMAIL must be an email address.")])
    .optional()
    .default(""),
  PAYPAL_SAMPLE_PAYOUT_RECIPIENT: z
    .union([
      z.literal(""),
      z.string().trim().email("PAYPAL_SAMPLE_PAYOUT_RECIPIENT must be an email address."),
    ])
    .optional()
    .default(""),
});

export type PayPalEnv = z.infer<typeof paypalEnvSchema>;
