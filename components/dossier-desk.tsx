"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import type { PublicQuote } from "@/lib/domain/present";
import { DisputeSimulator } from "@/components/dispute-simulator";
import { Issue } from "@/components/issue";

const statusLabel = {
  negotiating: "Negotiating",
  accepted: "Quote locked",
  invoiced: "Invoiced",
  paid: "Paid",
} as const;

const milestoneLabel = {
  locked: "Waiting",
  releasing: "Releasing",
  released: "Paid out",
  failed: "Failed",
} as const;

export function DossierDesk({ quoteId, devTools = false }: { quoteId: string; devTools?: boolean }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [dossier, setDossier] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  const reload = useCallback(async () => {
    const result = await api<{ quote: PublicQuote; dossier: string }>(`/api/quotes/${quoteId}`);
    setQuote(result.quote);
    setDossier(result.dossier);
  }, [quoteId]);

  useEffect(() => {
    let alive = true;
    void reload().catch((caught: ApiFailure) => {
      if (alive) setError(caught);
    });
    const timer = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [reload]);

  async function run(task: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await task();
      await reload();
    } catch (caught) {
      setError(caught as ApiFailure);
    } finally {
      setPending(false);
    }
  }

  if (!quote && error) return <Issue message={error.message} issue={error.issue} debugId={error.debugId} />;
  if (!quote) return <p className="text-sm text-mist">Opening the file…</p>;

  return (
    <div>
      {error ? (
        <div className="mb-6">
          <Issue message={error.message} issue={error.issue} debugId={error.debugId} />
        </div>
      ) : null}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{statusLabel[quote.status]}</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">{quote.title}</h1>
        <p className="mt-3 text-sm leading-6 text-mist">{quote.brief}</p>
        <ol className="mt-8 space-y-4">
          {quote.rounds.map((round) => (
            <li key={round.id} className={round.role === "agent" ? "border-l-2 border-gold pl-4" : "pl-4"}>
              <p className="text-xs uppercase tracking-wide text-mist">
                {round.role === "agent" ? "Agent" : "Client"} · {round.subtotal} before tax
              </p>
              <p className="mt-1 text-sm leading-6">{round.message}</p>
            </li>
          ))}
        </ol>
        {quote.status === "negotiating" ? (
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const text = message.trim();
              if (!text) return;
              void run(async () => {
                await api(`/api/quotes/${quote.id}/negotiate`, {
                  method: "POST",
                  body: JSON.stringify({ message: text }),
                });
                setMessage("");
              });
            }}
          >
            <label className="block text-sm">
              Reply
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Example: I can do 1,600 before tax, or I accept"
                className="mt-2 min-h-24 w-full border border-line bg-foam px-3 py-2 outline-none focus:border-gold"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={pending} className="bg-ink px-4 py-2 text-sm text-foam disabled:opacity-50">
                Send to the agent
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => api(`/api/quotes/${quote.id}/accept`, { method: "POST" }).then(() => undefined))}
                className="border border-ink px-4 py-2 text-sm disabled:opacity-50"
              >
                Accept the current offer
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <aside className="space-y-6">
        <section className="border border-line bg-foam px-4 py-4 shadow-sheet">
          <h2 className="font-display text-2xl">Server pricing</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Before tax" value={quote.subtotal} />
            <Row label={`Tax ${quote.taxPercent}%`} value={quote.tax} />
            <Row label="Total" value={quote.total} />
            <Row label={`Fee ${quote.platformFeePercent}%`} value={quote.platformFee} />
            <Row label="Provider net" value={quote.providerPool} />
          </dl>
          <p className="mt-4 text-xs leading-5 text-mist">
            Payout to {quote.provider.payoutDestination}. Checkout accepts only a file id.
          </p>
          {quote.status !== "negotiating" ? (
            <Link href={`/missions/${quote.id}/checkout`} className="mt-4 inline-block text-sm text-gold">
              Check out {quote.total}
            </Link>
          ) : null}
        </section>

        <section className="border border-line bg-foam px-4 py-4">
          <h2 className="font-display text-2xl">Invoice v2</h2>
          <p className="mt-2 font-mono text-xs">{quote.invoiceNumber}</p>
          {quote.paypalInvoiceId ? <p className="mt-1 font-mono text-xs text-mist">{quote.paypalInvoiceId}</p> : null}
          {quote.invoiceDue ? <p className="mt-2 text-sm">PayPal amount due: {quote.invoiceDue} {quote.currency}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {!quote.paypalInvoiceId ? (
              <button
                type="button"
                disabled={pending || quote.status === "negotiating"}
                onClick={() =>
                  void run(() =>
                    api("/api/invoices", { method: "POST", body: JSON.stringify({ quoteId: quote.id }) }).then(() => undefined),
                  )
                }
                className="bg-ink px-3 py-2 text-sm text-foam disabled:opacity-40"
              >
                Issue invoice
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => api(`/api/invoices/${quote.id}/send`, { method: "POST" }).then(() => undefined))}
                className="bg-ink px-3 py-2 text-sm text-foam disabled:opacity-40"
              >
                Send and generate QR
              </button>
            )}
            {quote.payerViewUrl ? (
              <a href={quote.payerViewUrl} className="px-3 py-2 text-sm text-gold" target="_blank" rel="noreferrer">
                Hosted page
              </a>
            ) : null}
          </div>
          {quote.qrDataUrl ? (
            // data URL produced by our server from the PayPal QR response
            // eslint-disable-next-line @next/next/no-img-element
            <img src={quote.qrDataUrl} alt="PayPal payment QR code" className="mt-4 w-40 border border-line" />
          ) : null}
        </section>

        <section>
          <h2 className="font-display text-2xl">Escrow timeline</h2>
          <p className="mt-2 text-xs leading-5 text-mist">
            Approve a milestone to send its payout. The next share stays held until you release it.
          </p>
          <ol className="mt-3 space-y-3">
            {quote.milestones.map((milestone, index) => {
              const previousReleased = index === 0 || quote.milestones[index - 1]?.status === "released";
              const canRelease =
                quote.status === "paid" &&
                previousReleased &&
                milestone.status !== "released" &&
                milestone.status !== "releasing";
              const recipient = milestone.payoutRecipient ?? quote.provider.payoutDestination;
              return (
                <li key={milestone.id} className="border border-line bg-foam px-3 py-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <p>
                      {index + 1}. {milestone.label}
                    </p>
                    <p className="font-mono tabular-nums">{milestone.amount}</p>
                  </div>
                  <p className="mt-1 text-xs text-mist">
                    {milestone.percent}% · {milestoneLabel[milestone.status]}
                    {milestone.payoutBatchStatus ? ` · batch ${milestone.payoutBatchStatus}` : ""}
                    {milestone.payoutItemStatus ? ` · item ${milestone.payoutItemStatus}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-mist">
                    {milestone.amount}
                    {milestone.payoutBatchId ? ` · ${milestone.payoutBatchId}` : ""}
                    {recipient ? ` · ${recipient}` : ""}
                  </p>
                  {milestone.payoutError ? (
                    <p className="mt-1 text-xs text-clay">
                      {milestone.payoutError.message}
                      {milestone.payoutError.issue ? ` · ${milestone.payoutError.issue}` : ""}
                      {milestone.payoutError.debugId ? ` · debug_id ${milestone.payoutError.debugId}` : ""}
                    </p>
                  ) : null}
                  {canRelease ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void run(async () => {
                          await api(`/api/milestones/${milestone.id}/release`, { method: "POST" });
                          await api(`/api/milestones/${milestone.id}/refresh`, { method: "POST" });
                        })
                      }
                      className="mt-3 bg-ink px-3 py-2 text-xs text-foam disabled:opacity-40"
                    >
                      Approve and release
                    </button>
                  ) : null}
                  {quote.status === "paid" && !previousReleased && milestone.status === "locked" ? (
                    <p className="mt-2 text-xs text-mist">Waiting for the previous milestone.</p>
                  ) : null}
                  {milestone.payoutBatchId ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void run(() => api(`/api/milestones/${milestone.id}/refresh`, { method: "POST" }).then(() => undefined))
                      }
                      className="mt-2 block text-xs text-mist"
                    >
                      Refresh batch status
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        {quote.status === "paid" || quote.status === "invoiced" ? (
          <DisputeSimulator quoteId={quote.id} initialDraft={quote.demoInquiry} />
        ) : null}

        {devTools && quote.status !== "negotiating" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(() =>
                api("/api/dev/webhooks/emit", {
                  method: "POST",
                  body: JSON.stringify({ quoteId: quote.id }),
                }).then(() => undefined),
              )
            }
            className="border border-ink px-3 py-2 text-sm disabled:opacity-40"
          >
            Simulate capture webhook
          </button>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer text-mist">Evidence the agent would file in a dispute</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-ink">{dossier}</pre>
        </details>
      </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-mist">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
