import { clearTokenCache, getMerchantAccessToken } from "@/lib/paypal/auth";
import { getPayPalConfig, type MockApplicationCode } from "@/lib/paypal/config";
import { isRecord, readPayPalError } from "@/lib/paypal/errors";

type JsonMethod = "GET" | "POST" | "DELETE";

export type PayPalCall = {
  method: JsonMethod;
  path: string;
  json?: unknown;
  requestId?: string;
  mockApplicationCode?: MockApplicationCode;
  preferRepresentation?: boolean;
};

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function paypalCall(
  call: PayPalCall,
  allowRetry = true,
): Promise<{ status: number; data: unknown; location: string | null }> {
  const { apiBase } = getPayPalConfig();
  const token = await getMerchantAccessToken();
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });

  if (call.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (call.requestId) {
    headers.set("PayPal-Request-Id", call.requestId);
  }
  if (call.mockApplicationCode) {
    headers.set(
      "PayPal-Mock-Response",
      JSON.stringify({ mock_application_codes: call.mockApplicationCode }),
    );
  }
  if (call.preferRepresentation) {
    headers.set("Prefer", "return=representation");
  }

  const response = await fetch(`${apiBase}${call.path}`, {
    method: call.method,
    cache: "no-store",
    headers,
    body: call.json !== undefined ? JSON.stringify(call.json) : undefined,
    signal: AbortSignal.timeout(25_000),
  });

  if (response.status === 401 && allowRetry) {
    clearTokenCache();
    return paypalCall(call, false);
  }

  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok) throw readPayPalError(response.status, data);

  return { status: response.status, data, location: response.headers.get("location") };
}

export async function paypalJson<T>(call: PayPalCall): Promise<T> {
  const result = await paypalCall(call);
  return result.data as T;
}

export async function paypalForm<T>(path: string, form: FormData, requestId?: string): Promise<T> {
  const { apiBase } = getPayPalConfig();
  const token = await getMerchantAccessToken();
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });
  if (requestId) headers.set("PayPal-Request-Id", requestId);

  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: form,
    signal: AbortSignal.timeout(25_000),
  });

  const text = await response.text();
  const body = parseBody(text);
  if (!response.ok) {
    throw readPayPalError(response.status, body);
  }
  return body as T;
}

export async function paypalPngDataUrl(call: PayPalCall): Promise<string | null> {
  const { apiBase } = getPayPalConfig();
  const token = await getMerchantAccessToken();
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    Accept: "*/*",
    "Content-Type": "application/json",
  });
  if (call.requestId) headers.set("PayPal-Request-Id", call.requestId);

  const response = await fetch(`${apiBase}${call.path}`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify(call.json ?? {}),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const body = parseBody(await response.text());
    const error = readPayPalError(response.status, body);
    console.error(
      JSON.stringify({
        source: "paypal-qr",
        issue: error.issue ?? null,
        debugId: error.debugId ?? null,
      }),
    );
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());
  return pngDataUrl(contentType, bytes);
}

function pngDataUrl(contentType: string, bytes: Buffer): string | null {
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") {
    return `data:image/png;base64,${bytes.toString("base64")}`;
  }

  const embedded = bytes.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (embedded >= 0) {
    return `data:image/png;base64,${bytes.subarray(embedded).toString("base64")}`;
  }

  const text = bytes.toString("utf8");
  const encoded = text.match(/iVBORw0KGgo[A-Za-z0-9+/=]+/);
  if (encoded) return `data:image/png;base64,${encoded[0]}`;

  if (contentType.includes("json")) {
    const body = parseBody(text);
    if (isRecord(body) && typeof body.image === "string" && body.image.startsWith("iVBORw0KGgo")) {
      return `data:image/png;base64,${body.image}`;
    }
  }

  return null;
}
