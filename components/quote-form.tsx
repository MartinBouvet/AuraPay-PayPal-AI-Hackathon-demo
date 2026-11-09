"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiFailure } from "@/lib/client/api";
import type { PublicQuote } from "@/lib/domain/present";
import { Issue } from "@/components/issue";

const sample =
  "A brand identity for a tea house: logotype, palette, and a short brand guide.";

export function QuoteForm({ defaultProviderEmail = "" }: { defaultProviderEmail?: string }) {
  const router = useRouter();
  const [brief, setBrief] = useState(sample);
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [buyerGiven, setBuyerGiven] = useState("");
  const [buyerSurname, setBuyerSurname] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerEmail, setProviderEmail] = useState(defaultProviderEmail);
  const [paypalId, setPaypalId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api<{ quote: PublicQuote }>("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          brief,
          currency,
          buyer: { givenName: buyerGiven, surname: buyerSurname, email: buyerEmail },
          provider: {
            name: providerName,
            email: providerEmail,
            ...(paypalId.trim() ? { paypalId: paypalId.trim() } : {}),
          },
        }),
      });
      router.push(`/missions/${result.quote.id}`);
    } catch (caught) {
      setError(caught as ApiFailure);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block text-sm">
        Brief
        <textarea
          required
          minLength={12}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          className="mt-2 min-h-36 w-full border border-line bg-foam px-3 py-2 outline-none focus:border-gold"
        />
      </label>
      <fieldset>
        <legend className="text-sm">Quote currency</legend>
        <div className="mt-2 flex gap-4 text-sm">
          {(["EUR", "USD"] as const).map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input
                type="radio"
                name="currency"
                checked={currency === code}
                onChange={() => setCurrency(code)}
              />
              {code}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client given name" value={buyerGiven} onChange={setBuyerGiven} />
        <Field label="Client surname" value={buyerSurname} onChange={setBuyerSurname} />
        <Field label="Client email" type="email" value={buyerEmail} onChange={setBuyerEmail} />
        <Field label="Provider name" value={providerName} onChange={setProviderName} />
        <Field label="Provider PayPal email" type="email" value={providerEmail} onChange={setProviderEmail} />
        <Field label="Provider PayPal ID" value={paypalId} onChange={setPaypalId} required={false} />
      </div>
      {error ? <Issue message={error.message} issue={error.issue} debugId={error.debugId} /> : null}
      <button type="submit" disabled={pending} className="bg-ink px-4 py-2 text-sm text-foam disabled:opacity-50">
        {pending ? "The agent is pricing…" : "Request a quote"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-line bg-foam px-3 py-2 outline-none focus:border-gold"
      />
    </label>
  );
}
