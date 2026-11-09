import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Quote, StoreData } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/errors";

const directory = path.join(process.cwd(), ".data");
const file = path.join(directory, "aurapay.json");

const emptyStore = (): StoreData => ({
  quotes: [],
  events: [],
  processedWebhookIds: [],
});

let chain: Promise<unknown> = Promise.resolve();

function read(): StoreData {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as StoreData;
    return {
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      processedWebhookIds: Array.isArray(parsed.processedWebhookIds) ? parsed.processedWebhookIds : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw error;
  }
}

function write(store: StoreData): void {
  mkdirSync(directory, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(store, null, 2));
  renameSync(temporary, file);
}

export function updateStore<T>(mutate: (store: StoreData) => T): Promise<T> {
  const run = chain.then(() => {
    const store = read();
    const result = mutate(store);
    write(store);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readStore(): StoreData {
  return read();
}

export function requireQuote(store: StoreData, id: string): Quote {
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) {
    throw new DomainError("File not found.", 404, "QUOTE_NOT_FOUND");
  }
  return quote;
}

export async function getQuote(id: string): Promise<Quote> {
  const store = readStore();
  return structuredClone(requireQuote(store, id));
}
