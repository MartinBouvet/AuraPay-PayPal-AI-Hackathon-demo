"use client";

import { useEffect, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import type { PublicQuote } from "@/lib/domain/present";
import { DisputeSimulator } from "@/components/dispute-simulator";
import { Issue } from "@/components/issue";

type Dispute = {
  dispute_id?: string;
  reason?: string;
  status?: string;
  dispute_life_cycle_stage?: string;
  dispute_amount?: { currency_code?: string; value?: string };
};

export function DisputeDesk() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [quotes, setQuotes] = useState<PublicQuote[]>([]);
  const [disputeId, setDisputeId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [note, setNote] = useState("");
  const [dossier, setDossier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [sent, setSent] = useState("");

  useEffect(() => {
    void api<{ quotes: PublicQuote[] }>("/api/quotes")
      .then((result) => {
        setQuotes(result.quotes);
        const demo = result.quotes.find((quote) => quote.id === "4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c");
        const first = demo ?? result.quotes[0];
        if (first) setQuoteId(first.id);
      })
      .catch((caught: ApiFailure) => setError(caught));

    void api<{ disputes: Dispute[] }>("/api/disputes")
      .then((result) => {
        setDisputes(result.disputes);
        const first = result.disputes[0];
        if (first?.dispute_id) setDisputeId(first.dispute_id);
      })
      .catch((caught: ApiFailure) => setError(caught));
  }, []);

  useEffect(() => {
    if (!quoteId) return;
    void api<{ dossier: string }>(`/api/quotes/${quoteId}`)
      .then((result) => setDossier(result.dossier))
      .catch(() => setDossier(""));
  }, [quoteId]);

  const selected = disputes.find((dispute) => dispute.dispute_id === disputeId);
  const inquiry = !selected?.dispute_life_cycle_stage || selected.dispute_life_cycle_stage === "INQUIRY";

  async function respond(action: "message" | "evidence") {
    setPending(true);
    setError(null);
    setSent("");
    try {
      const result = await api<{ dossier: string }>(`/api/disputes/${disputeId}/respond`, {
        method: "POST",
        body: JSON.stringify({ quoteId, note, action }),
      });
      setSent(action === "message" ? "Inquiry message sent to PayPal." : "Evidence submitted to PayPal.");
      setDossier(result.dossier);
    } catch (caught) {
      setError(caught as ApiFailure);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h1 className="font-display text-4xl tracking-tight">Mediation</h1>
        <p className="mt-3 text-sm leading-6 text-mist">
          The agent reads the local file and answers during inquiry, before a dispute becomes a claim.
        </p>
        {disputes.length === 0 ? (
          <p className="mt-6 text-sm text-mist">
            {error
              ? "The PayPal dispute list could not be loaded."
              : "PayPal returned no disputes for this sandbox account."}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {disputes.map((dispute) => (
              <li key={dispute.dispute_id}>
                <button
                  type="button"
                  onClick={() => dispute.dispute_id && setDisputeId(dispute.dispute_id)}
                  className="w-full py-3 text-left"
                >
                  <span className="font-mono text-xs">{dispute.dispute_id}</span>
                  <span className="mt-1 block text-sm">
                    {dispute.reason} · {dispute.dispute_life_cycle_stage} · {dispute.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-4">
        <label className="block text-sm">
          File to attach
          <select
            value={quoteId}
            onChange={(event) => setQuoteId(event.target.value)}
            className="mt-2 w-full border border-line bg-foam px-3 py-2"
          >
            {quotes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.title} · {quote.total}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Extra note
          <textarea
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 min-h-20 w-full border border-line bg-foam px-3 py-2"
          />
        </label>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap border border-line bg-foam p-3 text-xs leading-5">
          {dossier || "The evidence pack will appear here."}
        </pre>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending || !disputeId || !quoteId || !inquiry}
            onClick={() => void respond("message")}
            className="bg-ink px-3 py-2 text-sm text-foam disabled:opacity-40"
          >
            Send the inquiry reply
          </button>
          <button
            type="button"
            disabled={pending || !disputeId || !quoteId}
            onClick={() => void respond("evidence")}
            className="border border-ink px-3 py-2 text-sm disabled:opacity-40"
          >
            Submit evidence
          </button>
        </div>
        {sent ? <p className="text-sm text-pine">{sent}</p> : null}
        {error ? <Issue message={error.message} issue={error.issue} debugId={error.debugId} /> : null}
        <DisputeSimulator
          quoteId={quoteId || "4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c"}
          disputeId={disputeId || undefined}
          initialDraft={quotes.find((quote) => quote.id === (quoteId || "4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c"))?.demoInquiry}
        />
      </section>
    </div>
  );
}
