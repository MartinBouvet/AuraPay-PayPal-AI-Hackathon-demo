"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import type { PublicQuote } from "@/lib/domain/present";
import { Issue } from "@/components/issue";

const MOCKS = [
  "",
  "INSTRUMENT_DECLINED",
  "TRANSACTION_REFUSED",
  "PAYER_CANNOT_PAY",
  "INTERNAL_SERVER_ERROR",
  "DUPLICATE_INVOICE_ID",
  "DUPLICATE_INVOICE_NUMBER",
] as const;

type Phase = "loading" | "ready" | "paying" | "paid" | "cancelled" | "blocked";

export function PaypalCheckout({ quoteId, sdkUrl }: { quoteId: string; sdkUrl: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mockRef = useRef({ code: "", target: "capture" as "create" | "capture" });
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<ApiFailure | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [mockCode, setMockCode] = useState<(typeof MOCKS)[number]>("");
  const [mockTarget, setMockTarget] = useState<"create" | "capture">("capture");

  mockRef.current = { code: mockCode, target: mockTarget };

  useEffect(() => {
    const ac = new AbortController();
    const cleanups: Array<() => void> = [];

    async function createOrder() {
      const mock = mockRef.current;
      const created = await api<{ orderId: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          quoteId,
          ...(mock.target === "create" && mock.code ? { mockApplicationCode: mock.code } : {}),
        }),
      });
      return { orderId: created.orderId };
    }

    async function capture(orderId: string) {
      const mock = mockRef.current;
      const result = await api<{ quote: PublicQuote }>(`/api/orders/${orderId}/capture`, {
        method: "POST",
        body: JSON.stringify(mock.target === "capture" && mock.code ? { mockApplicationCode: mock.code } : {}),
      });
      setQuote(result.quote);
      setPhase("paid");
    }

    const handlers = {
      onApprove: async (data: { orderId: string }) => {
        setPhase("paying");
        setError(null);
        try {
          await capture(data.orderId);
        } catch (caught) {
          setError(caught as ApiFailure);
          setPhase("ready");
        }
      },
      onCancel: () => setPhase("cancelled"),
      onError: (sdkError: { message?: string }) => {
        const failure = new Error(sdkError.message ?? "The PayPal SDK reported an error.") as ApiFailure;
        failure.issue = "SDK_ERROR";
        setError(failure);
        setPhase("ready");
      },
    };

    async function boot() {
      const loaded = await api<{ quote: PublicQuote; dossier: string }>(`/api/quotes/${quoteId}`);
      if (ac.signal.aborted) return;
      setQuote(loaded.quote);
      if (loaded.quote.status === "negotiating") {
        setPhase("blocked");
        return;
      }
      if (loaded.quote.status === "paid") {
        setPhase("paid");
        return;
      }

      const token = await api<{ clientToken: string }>("/api/client-token");
      if (ac.signal.aborted) return;
      await loadSdk(sdkUrl);
      if (!window.paypal || ac.signal.aborted) return;

      const sdk = await window.paypal.createInstance({
        clientToken: token.clientToken,
        components: ["paypal-payments"],
        pageType: "checkout",
        locale: "en-US",
        clientMetadataId: crypto.randomUUID(),
      });
      if (ac.signal.aborted) return;

      const eligible = await sdk.findEligibleMethods({
        currencyCode: loaded.quote.currency,
        amount: loaded.quote.totalDecimal,
      });
      if (ac.signal.aborted) return;
      const available: string[] = [];
      const root = rootRef.current;
      if (!root) return;

      if (eligible.isEligible("paypal")) {
        available.push("PayPal");
        const button = root.querySelector<HTMLElement>("paypal-button");
        const session = sdk.createPayPalOneTimePaymentSession(handlers);
        if (button) {
          button.hidden = false;
          const onClick = () => {
            setPhase("paying");
            void session.start({ presentationMode: "auto" }, createOrder()).catch((caught: unknown) => {
              const failure = caught instanceof Error ? (caught as ApiFailure) : new Error("Payment was interrupted.");
              setError(failure as ApiFailure);
              setPhase("ready");
            });
          };
          button.addEventListener("click", onClick);
          cleanups.push(() => button.removeEventListener("click", onClick));
        }
      }

      if (eligible.isEligible("paylater")) {
        available.push("Pay Later");
        const button = root.querySelector<HTMLElement>("paypal-pay-later-button");
        const details = eligible.getDetails("paylater");
        const session = sdk.createPayLaterOneTimePaymentSession(handlers);
        if (button) {
          if (details.productCode) button.dataset.productCode = details.productCode;
          if (details.countryCode) button.dataset.countryCode = details.countryCode;
          const element = button as HTMLElement & { productCode?: string; countryCode?: string };
          if (details.productCode) element.productCode = details.productCode;
          if (details.countryCode) element.countryCode = details.countryCode;
          button.hidden = false;
          const onClick = () => {
            setPhase("paying");
            void session.start({ presentationMode: "auto" }, createOrder()).catch((caught: unknown) => {
              const failure = caught instanceof Error ? caught : new Error("Pay Later was interrupted.");
              setError(failure as ApiFailure);
              setPhase("ready");
            });
          };
          button.addEventListener("click", onClick);
          cleanups.push(() => button.removeEventListener("click", onClick));
        }
      }

      setMethods(available);
      setPhase("ready");
    }

    void boot().catch((caught: unknown) => {
      if (ac.signal.aborted) return;
      setError(caught as ApiFailure);
      setPhase("blocked");
    });

    return () => {
      ac.abort();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [quoteId, sdkUrl]);

  return (
    <div className="max-w-xl">
      <Link href={`/missions/${quoteId}`} className="text-sm text-gold">
        Back to the file
      </Link>
      <h1 className="mt-4 font-display text-4xl tracking-tight">Checkout</h1>
      {quote ? (
        <p className="mt-3 text-sm leading-6 text-mist">
          {quote.title} · <span className="font-mono text-ink">{quote.total}</span> including {quote.tax} tax. This
          amount comes from the locked quote.
        </p>
      ) : (
        <p className="mt-3 text-sm text-mist">Reading the quote…</p>
      )}

      <div ref={rootRef} className="mt-8 space-y-3">
        <paypal-button type="pay" hidden className="paypal-gold" />
        <paypal-pay-later-button hidden />
      </div>

      {phase === "ready" && methods.length === 0 ? (
        <p className="mt-4 text-sm text-mist">
          No eligible method for this currency and amount. Pay Later depends on the sandbox buyer&apos;s country.
        </p>
      ) : null}
      {methods.length > 0 ? <p className="mt-4 text-xs text-mist">Eligible: {methods.join(", ")}</p> : null}
      {phase === "paying" ? <p className="mt-4 text-sm">Payment in progress…</p> : null}
      {phase === "cancelled" ? <p className="mt-4 text-sm">Payment cancelled. The quote is unchanged.</p> : null}
      {phase === "paid" && quote ? (
        <p className="mt-4 text-sm text-pine">
          Payment captured{quote.captureId ? ` · ${quote.captureId}` : ""}. The first milestone is sent to the provider.
        </p>
      ) : null}
      {quote?.status === "negotiating" ? <p className="mt-4 text-sm">Accept the quote before checkout.</p> : null}
      {error ? (
        <div className="mt-4">
          <Issue message={error.message} issue={error.issue} debugId={error.debugId} />
        </div>
      ) : null}

      {quote && quote.status !== "negotiating" && quote.status !== "paid" ? (
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer text-mist">Sandbox negative test</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              Code
              <select
                value={mockCode}
                onChange={(event) => setMockCode(event.target.value as (typeof MOCKS)[number])}
                className="mt-1 w-full border border-line bg-foam px-2 py-2"
              >
                {MOCKS.map((code) => (
                  <option key={code || "none"} value={code}>
                    {code || "None"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Step
              <select
                value={mockTarget}
                onChange={(event) => setMockTarget(event.target.value as "create" | "capture")}
                className="mt-1 w-full border border-line bg-foam px-2 py-2"
              >
                <option value="capture">Capture</option>
                <option value="create">Create</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-mist">
            The code is sent as PayPal-Mock-Response, and only when it is on the allowlist.
          </p>
        </details>
      ) : null}
    </div>
  );
}

function loadSdk(src: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("The PayPal JS SDK v6 failed to load.")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The PayPal JS SDK v6 failed to load."));
    document.head.appendChild(script);
  });
}
