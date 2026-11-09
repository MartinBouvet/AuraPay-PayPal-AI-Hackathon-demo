"use client";

import Link from "next/link";
import { useState } from "react";

const steps = [
  {
    title: "AI negotiation and quote pricing",
    detail: "The agent prices from the catalog. Tax and the platform fee are computed only on the server.",
    href: "/missions/432a928f-afec-48ff-a629-c22652cd07e2",
  },
  {
    title: "Invoicing v2 and QR code",
    detail: "A locked quote becomes a PayPal invoice, with a hosted page and a QR code.",
    href: "/missions/9529a7bc-16f6-41f9-8a7e-61ca34d6c91b",
  },
  {
    title: "Checkout SDK v6",
    detail: "PayPal and Pay Later render after findEligibleMethods. Capture stays on the server.",
    href: "/missions/9529a7bc-16f6-41f9-8a7e-61ca34d6c91b/checkout",
  },
  {
    title: "Batch payouts and escrow",
    detail: "Each approved milestone sends its own payout batch. The rest stays held.",
    href: "/missions/4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c",
  },
  {
    title: "AI-assisted dispute resolution",
    detail: "Simulate a buyer inquiry. The agent drafts a reply from the audit log before anything is sent.",
    href: "/litiges",
  },
];

export function DemoGuide() {
  const [resetNote, setResetNote] = useState("");

  async function resetDemo() {
    setResetNote("Resetting…");
    try {
      const response = await fetch("/api/dev/reset-demo", { method: "POST", body: "{}" });
      if (!response.ok) {
        setResetNote("Reset is available in development only.");
        return;
      }
      setResetNote("Brand identity is back to a locked quote. Refresh that file.");
    } catch {
      setResetNote("Reset failed.");
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-foam/95 backdrop-blur">
      <details className="mx-auto max-w-6xl px-6 py-2">
        <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-mist">
          Demo walkthrough for judges
        </summary>
        <ol className="grid gap-3 py-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <li key={step.href + step.title} className="text-sm">
              <Link href={step.href} className="font-medium hover:text-gold">
                {index + 1}. {step.title}
              </Link>
              <p className="mt-1 text-xs leading-5 text-mist">{step.detail}</p>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => void resetDemo()} className="mb-2 text-xs text-gold">
          Reset Brand identity demo
        </button>
        {resetNote ? <p className="mb-2 text-xs text-mist">{resetNote}</p> : null}
      </details>
    </div>
  );
}
