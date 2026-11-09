"use client";

import { useEffect, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import type { PublicQuote } from "@/lib/domain/present";
import { Issue } from "@/components/issue";

export function DisputeSimulator({
  quoteId,
  disputeId,
  initialDraft,
}: {
  quoteId: string;
  disputeId?: string;
  initialDraft?: PublicQuote["demoInquiry"];
}) {
  const [draft, setDraft] = useState<NonNullable<PublicQuote["demoInquiry"]> | null>(initialDraft ?? null);

  useEffect(() => {
    if (initialDraft) setDraft(initialDraft);
  }, [initialDraft]);
  const [paypalSent, setPaypalSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  async function draftInquiry() {
    setPending(true);
    setError(null);
    setPaypalSent(false);
    try {
      const result = await api<{ draft: NonNullable<PublicQuote["demoInquiry"]> }>("/api/disputes/draft", {
        method: "POST",
        body: JSON.stringify({ quoteId }),
      });
      setDraft(result.draft);
    } catch (caught) {
      setError(caught as ApiFailure);
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await api<{
        draft: NonNullable<PublicQuote["demoInquiry"]>;
        paypalSent: boolean;
      }>("/api/disputes/draft/submit", {
        method: "POST",
        body: JSON.stringify({ quoteId, ...(disputeId ? { disputeId } : {}) }),
      });
      setDraft(result.draft);
      setPaypalSent(result.paypalSent);
    } catch (caught) {
      setError(caught as ApiFailure);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border border-line bg-foam px-4 py-4">
      <h2 className="font-display text-2xl">Buyer inquiry</h2>
      <p className="mt-2 text-sm leading-6 text-mist">
        The agent reads the mission audit log and drafts a reply. Nothing is sent until you submit it.
      </p>
      <button
        type="button"
        disabled={pending || !quoteId}
        onClick={() => void draftInquiry()}
        className="mt-4 bg-ink px-3 py-2 text-sm text-foam disabled:opacity-40"
      >
        Simulate Buyer Dispute (Inquiry)
      </button>
      {draft ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-mist">
            {draft.submittedAt ? "Submitted response" : "Proposed response — not sent"}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap border border-line p-3 text-xs leading-5">
            {draft.message}
          </pre>
          {draft.submittedAt ? (
            <p className="mt-3 text-sm text-pine">
              {paypalSent
                ? `Sent to PayPal dispute ${draft.paypalDisputeId}.`
                : "Recorded on this file. PayPal has no open dispute, so the reply stays in the demo log."}
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => void submit()}
              className="mt-3 border border-ink px-3 py-2 text-sm disabled:opacity-40"
            >
              Submit this response
            </button>
          )}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Issue message={error.message} issue={error.issue} debugId={error.debugId} />
        </div>
      ) : null}
    </section>
  );
}
