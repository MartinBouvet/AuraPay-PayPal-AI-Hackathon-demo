import { readStore } from "@/lib/domain/store";

export const dynamic = "force-dynamic";

export default function JournalPage() {
  const events = readStore().events;

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Webhooks</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Notification journal</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-mist">
        <span className="font-mono">/api/webhooks/paypal</span> answers 204 before any work. With a webhook id, the
        signature is verified with PayPal. In development, an empty <span className="font-mono">PAYPAL_WEBHOOK_ID</span>{" "}
        accepts local payloads and logs a warning. The simulator id is the literal WEBHOOK_ID.
      </p>
      {events.length === 0 ? (
        <p className="mt-10 text-sm text-mist">No notifications yet.</p>
      ) : (
        <ol className="mt-8 space-y-4">
          {events.map((event) => (
            <li key={`${event.id}-${event.at}`} className="border border-line bg-foam px-4 py-3 shadow-sheet">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs">{event.type}</p>
                <p className="text-xs uppercase tracking-wide text-mist">{event.status}</p>
              </div>
              <p className="mt-2 text-sm">{event.summary}</p>
              <p className="mt-2 font-mono text-[11px] text-mist">{event.at}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
