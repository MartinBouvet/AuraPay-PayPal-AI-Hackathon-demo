export type ApiFailure = Error & { issue?: string; debugId?: string | null };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; issue?: string; debugId?: string | null };
  };

  if (!response.ok) {
    const error = new Error(data.error?.message ?? "The request was rejected.") as ApiFailure;
    error.issue = data.error?.issue;
    error.debugId = data.error?.debugId;
    throw error;
  }

  return data as T;
}
