import Link from "next/link";
import { presentQuote } from "@/lib/domain/present";
import { readStore } from "@/lib/domain/store";

export const dynamic = "force-dynamic";

const labels = {
  negotiating: "Negotiating",
  accepted: "Quote locked",
  invoiced: "Invoiced",
  paid: "Paid",
} as const;

export default function HomePage() {
  const quotes = readStore().quotes.map(presentQuote);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Hackathon PayPal</p>
      <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] tracking-tight">
        The agent prices. PayPal collects. Milestones release.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-mist">
        The browser sends no amount, tax, or secret. The server locks the quote, issues the v2 invoice, creates the
        order, and pays the provider only after capture.
      </p>
      <Link
        href="/missions/nouvelle"
        className="mt-8 inline-flex bg-ink px-4 py-2 text-sm text-foam hover:bg-gold"
      >
        Open a file
      </Link>

      <section className="mt-14">
        <h2 className="font-display text-2xl">Open files</h2>
        {quotes.length === 0 ? (
          <p className="mt-4 text-sm text-mist">No files yet. The first quote starts from a brief.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {quotes.map((quote) => (
              <li key={quote.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-baseline">
                <div>
                  <Link href={`/missions/${quote.id}`} className="font-medium hover:text-gold">
                    {quote.title}
                  </Link>
                  <p className="text-sm text-mist">{quote.buyer.givenName} {quote.buyer.surname}</p>
                </div>
                <p className="font-mono text-sm tabular-nums">{quote.total}</p>
                <p className="text-sm text-pine">{labels[quote.status]}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
