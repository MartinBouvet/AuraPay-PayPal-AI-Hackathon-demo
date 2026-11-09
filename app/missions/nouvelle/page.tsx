import { QuoteForm } from "@/components/quote-form";
import { CATALOG } from "@/lib/domain/catalog";
import { convertFromEurCents, formatMoney, PLATFORM_FEE_PERCENT, TAX_PERCENT } from "@/lib/domain/money";

export default function NewMissionPage() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">New file</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Describe the work, not the price.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-mist">
          The agent picks a catalog service, then negotiates between the list rate and the floor. {TAX_PERCENT}% tax
          and the {PLATFORM_FEE_PERCENT}% fee are calculated here, on the server.
        </p>
        <div className="mt-8">
          <QuoteForm defaultProviderEmail={process.env.PAYPAL_SAMPLE_PAYOUT_RECIPIENT?.trim() ?? ""} />
        </div>
      </div>
      <aside className="space-y-4">
        {CATALOG.map((service) => (
          <article key={service.id} className="border border-line bg-foam px-4 py-4 shadow-sheet">
            <h2 className="font-display text-2xl">{service.title}</h2>
            <p className="mt-2 text-sm leading-6 text-mist">{service.summary}</p>
            <p className="mt-3 font-mono text-xs leading-5">
              {formatMoney(service.listPriceEurCents, "EUR")} before tax
              <br />
              floor {formatMoney(service.minPriceEurCents, "EUR")}
              <br />
              {formatMoney(convertFromEurCents(service.listPriceEurCents, "USD"), "USD")} at the server rate 1.08
            </p>
            <ul className="mt-3 text-xs text-mist">
              {service.milestones.map((milestone) => (
                <li key={milestone.label}>
                  {milestone.percent} % · {milestone.label}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </aside>
    </div>
  );
}
