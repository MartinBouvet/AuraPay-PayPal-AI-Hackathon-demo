import {
  convertFromEurCents,
  type Currency,
  PLATFORM_FEE_PERCENT,
  TAX_PERCENT,
} from "@/lib/domain/money";

export type CatalogMilestone = {
  label: string;
  percent: number;
};

export type CatalogService = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  listPriceEurCents: number;
  minPriceEurCents: number;
  milestones: CatalogMilestone[];
};

export const CATALOG: CatalogService[] = [
  {
    id: "identite",
    title: "Brand identity",
    summary: "A logotype, a palette, and a short brand guide, delivered in three milestones.",
    keywords: ["logo", "brand", "identity", "identité", "identite", "charte", "logotype", "marque"],
    listPriceEurCents: 180_000,
    minPriceEurCents: 140_000,
    milestones: [
      { label: "Discovery and directions", percent: 30 },
      { label: "Approved system", percent: 40 },
      { label: "Final files", percent: 30 },
    ],
  },
  {
    id: "site",
    title: "Brochure site",
    summary: "A single presentation page, the content, and the launch.",
    keywords: ["site", "landing", "web", "page", "website", "vitrine", "internet"],
    listPriceEurCents: 320_000,
    minPriceEurCents: 240_000,
    milestones: [
      { label: "Structure and mockup", percent: 30 },
      { label: "Build", percent: 40 },
      { label: "Launch", percent: 30 },
    ],
  },
  {
    id: "film",
    title: "Brand film",
    summary: "A short film: script, production or motion, then the master.",
    keywords: ["film", "video", "vidéo", "motion", "shoot", "tournage", "clip"],
    listPriceEurCents: 460_000,
    minPriceEurCents: 360_000,
    milestones: [
      { label: "Script", percent: 30 },
      { label: "Production", percent: 40 },
      { label: "Delivered master", percent: 30 },
    ],
  },
];

export function getService(id: string): CatalogService | undefined {
  return CATALOG.find((service) => service.id === id);
}

export function matchService(text: string, current?: CatalogService): CatalogService {
  const haystack = text.toLowerCase();
  let best = current ?? CATALOG[0];
  let bestScore = 0;

  if (!best) {
    throw new Error("The AuraPay catalog is empty.");
  }

  for (const service of CATALOG) {
    const score = service.keywords.reduce((count, keyword) => {
      return haystack.includes(keyword) ? count + 1 : count;
    }, 0);
    if (score > bestScore) {
      best = service;
      bestScore = score;
    }
  }

  return best;
}

export function serviceBounds(service: CatalogService, currency: Currency) {
  return {
    listCents: convertFromEurCents(service.listPriceEurCents, currency),
    minCents: convertFromEurCents(service.minPriceEurCents, currency),
    taxPercent: TAX_PERCENT,
    platformFeePercent: PLATFORM_FEE_PERCENT,
  };
}
