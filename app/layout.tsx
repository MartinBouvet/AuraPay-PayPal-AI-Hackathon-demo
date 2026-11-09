import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import Link from "next/link";
import { DemoGuide } from "@/components/demo-guide";
import { integrationStatus } from "@/lib/paypal/config";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AuraPay",
  description: "Quote negotiation, PayPal invoicing, checkout, and milestone payouts.",
  robots: { index: false, follow: false },
};

const links = [
  { href: "/", label: "Files" },
  { href: "/missions/nouvelle", label: "New" },
  { href: "/litiges", label: "Disputes" },
  { href: "/journal", label: "Journal" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const status = integrationStatus();

  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans text-ink antialiased`}>
        <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[220px_1fr]">
          <aside className="flex flex-col gap-8 self-start border-b border-line px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:justify-between lg:self-stretch lg:border-b-0 lg:border-r lg:py-8">
            <div>
              <Link href="/" className="font-display text-3xl leading-none tracking-tight">
                AuraPay
              </Link>
              <p className="mt-3 text-sm leading-5 text-mist">Quotes, invoices, and milestone payouts on the PayPal sandbox.</p>
              <nav className="mt-8 flex gap-4 lg:flex-col lg:gap-2">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-sm hover:text-gold">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
              <p className="text-xs leading-5 text-mist">
              {status.sandbox ? "Sandbox" : "Live"} ·{" "}
              {status.paypalConfigured ? "credentials loaded" : "credentials missing"}
            </p>
          </aside>
          <main className="px-6 py-8 pb-24 lg:px-10">{children}</main>
        </div>
        <DemoGuide />
      </body>
    </html>
  );
}
