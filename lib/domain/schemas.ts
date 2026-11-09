import { z } from "zod";
import { MOCK_APPLICATION_CODES } from "@/lib/paypal/config";
import { DomainError } from "@/lib/domain/errors";

const email = z.string().trim().email().max(127);
const name = z.string().trim().min(1).max(80);

export const createQuoteSchema = z
  .object({
    brief: z.string().trim().min(12).max(2000),
    currency: z.enum(["EUR", "USD"]),
    buyer: z
      .object({
        givenName: name,
        surname: name,
        email,
      })
      .strict(),
    provider: z
      .object({
        name: name,
        email,
        paypalId: z
          .string()
          .trim()
          .max(50)
          .optional(),
      })
      .strict(),
  })
  .strict();

export const negotiateSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export const orderCreateSchema = z
  .object({
    quoteId: z.string().uuid(),
    mockApplicationCode: z.enum(MOCK_APPLICATION_CODES).optional(),
  })
  .strict();

export const captureSchema = z
  .object({
    mockApplicationCode: z.enum(MOCK_APPLICATION_CODES).optional(),
  })
  .strict();

export const invoiceCreateSchema = z
  .object({
    quoteId: z.string().uuid(),
    mockApplicationCode: z.enum(MOCK_APPLICATION_CODES).optional(),
  })
  .strict();

export const disputeDraftSchema = z
  .object({
    quoteId: z.string().uuid(),
  })
  .strict();

export const disputeDraftSubmitSchema = z
  .object({
    quoteId: z.string().uuid(),
    disputeId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const disputeRespondSchema = z
  .object({
    quoteId: z.string().uuid(),
    note: z.string().trim().max(500).optional(),
    action: z.enum(["message", "evidence"]),
  })
  .strict();

export const idSchema = z.string().uuid();
export const paypalResourceIdSchema = z.string().regex(/^[A-Za-z0-9-]+$/).max(64);

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new DomainError("The request body is not JSON.", 400, "INVALID_JSON");
  }
}

export function parseBody<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "body";
        return `${path}: ${issue.message}`;
      })
      .join(" ");
    throw new DomainError(message, 400, "VALIDATION");
  }
  return parsed.data;
}
