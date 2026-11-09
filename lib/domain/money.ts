export type Currency = "EUR" | "USD";

export const TAX_PERCENT = 20;
export const PLATFORM_FEE_PERCENT = 8;
export const EUR_USD_RATE_NUMERATOR = 108;
export const EUR_USD_RATE_DENOMINATOR = 100;

const formatters: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

export function formatMoney(cents: number, currency: Currency): string {
  return formatters[currency].format(cents / 100);
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const major = Math.floor(absolute / 100);
  const minor = absolute % 100;
  return `${negative ? "-" : ""}${major}.${minor.toString().padStart(2, "0")}`;
}

export function taxCents(netCents: number, percent = TAX_PERCENT): number {
  return Math.round((netCents * percent) / 100);
}

export function platformFeeCents(totalCents: number, percent = PLATFORM_FEE_PERCENT): number {
  return Math.round((totalCents * percent) / 100);
}

export function convertFromEurCents(eurCents: number, currency: Currency): number {
  if (currency === "EUR") return eurCents;
  return Math.round((eurCents * EUR_USD_RATE_NUMERATOR) / EUR_USD_RATE_DENOMINATOR);
}

export function splitByPercent(totalCents: number, percents: number[]): number[] {
  if (percents.length === 0) return [];
  const amounts: number[] = [];
  let allocated = 0;
  percents.forEach((percent, index) => {
    if (index === percents.length - 1) {
      amounts.push(totalCents - allocated);
      return;
    }
    const share = Math.floor((totalCents * percent) / 100);
    amounts.push(share);
    allocated += share;
  });
  return amounts;
}

export function parseOfferToCents(text: string): number | null {
  const pattern = /\d[\d\s\u00a0.,]*/g;
  let best: number | null = null;

  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const next = text.slice(match.index + raw.length, match.index + raw.length + 1);
    if (next === "%") continue;

    const cents = normalizeAmount(raw);
    if (cents === null || cents < 1_000) continue;
    if (best === null || cents > best) best = cents;
  }

  return best;
}

function normalizeAmount(raw: string): number | null {
  let value = raw.replace(/[\s\u00a0]/g, "").replace(/[^\d.,]/g, "");
  if (!value) return null;

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    value = lastDot > lastComma ? value.replace(/,/g, "") : value.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    const parts = value.split(",");
    const tail = parts[parts.length - 1] ?? "";
    value = tail.length === 3 ? parts.join("") : value.replace(",", ".");
  } else if (hasDot) {
    const parts = value.split(".");
    const tail = parts[parts.length - 1] ?? "";
    if (parts.length === 2 && tail.length === 3) value = parts.join("");
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}
