import { getPayPalConfig } from "@/lib/paypal/config";
import { PayPalApiError, isRecord, readPayPalError } from "@/lib/paypal/errors";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const SKEW_MS = 60_000;

let merchantToken: CacheEntry | null = null;
let browserToken: CacheEntry | null = null;

function basicAuthorization(): string {
  const { clientId, clientSecret } = getPayPalConfig();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const { apiBase } = getPayPalConfig();
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: basicAuthorization(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  const parsed: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw readPayPalError(response.status, parsed);
  }

  if (!isRecord(parsed) || typeof parsed.access_token !== "string" || typeof parsed.expires_in !== "number") {
    throw new PayPalApiError("Incomplete OAuth2 response.", { status: 502, issue: "OAUTH_RESPONSE" });
  }

  return {
    access_token: parsed.access_token,
    expires_in: parsed.expires_in,
    token_type: typeof parsed.token_type === "string" ? parsed.token_type : "Bearer",
  };
}

export function clearTokenCache(): void {
  merchantToken = null;
  browserToken = null;
}

/** Jeton marchand pour les API serveur. Ne jamais le renvoyer au navigateur. */
export async function getMerchantAccessToken(): Promise<string> {
  if (merchantToken && merchantToken.expiresAt > Date.now()) {
    return merchantToken.value;
  }

  const token = await requestToken(new URLSearchParams({ grant_type: "client_credentials" }));
  merchantToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000 - SKEW_MS,
  };
  return merchantToken.value;
}

/**
 * Browser token for `paypal.createInstance({ clientToken })`.
 * Émis par /v1/oauth2/token avec response_type=client_token.
 * En sandbox, `domains[]` est omis : PayPal refuse localhost.
 * PayPal still names the browser client token field access_token.
 */
export async function getBrowserClientToken(): Promise<{ clientToken: string; expiresIn: number }> {
  if (browserToken && browserToken.expiresAt > Date.now()) {
    const expiresIn = Math.max(1, Math.floor((browserToken.expiresAt - Date.now()) / 1000));
    return { clientToken: browserToken.value, expiresIn };
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    response_type: "client_token",
    intent: "sdk_init",
  });

  const { sandbox } = getPayPalConfig();
  const domain = process.env.PAYPAL_CLIENT_TOKEN_DOMAIN?.trim();
  if (!sandbox && domain) {
    params.append("domains[]", domain);
  }

  const token = await requestToken(params);
  browserToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000 - SKEW_MS,
  };

  return { clientToken: token.access_token, expiresIn: token.expires_in };
}
