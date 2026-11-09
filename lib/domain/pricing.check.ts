import assert from "node:assert/strict";
import { replyToClient } from "@/lib/domain/agent";
import { matchService } from "@/lib/domain/catalog";
import {
  convertFromEurCents,
  formatMoney,
  parseOfferToCents,
  platformFeeCents,
  splitByPercent,
  taxCents,
} from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/types";

assert.equal(parseOfferToCents("I propose 1,800"), 180_000);
assert.equal(parseOfferToCents("je propose 1 800"), 180_000);
assert.equal(parseOfferToCents("1.500,50 euros"), 150_050);
assert.equal(parseOfferToCents("1500.50"), 150_050);
assert.equal(parseOfferToCents("TVA 20% et budget 2400"), 240_000);
assert.equal(taxCents(180_000), 36_000);
assert.equal(platformFeeCents(216_000), 17_280);
assert.deepEqual(splitByPercent(100, [30, 40, 30]), [30, 40, 30]);
assert.deepEqual(splitByPercent(101, [30, 40, 30]), [30, 40, 31]);
assert.equal(convertFromEurCents(180_000, "USD"), 194_400);
assert.equal(matchService("un logo pour la marque").id, "identite");
assert.equal(matchService("landing page").id, "site");

const quote = {
  serviceId: "identite",
  currency: "EUR",
  subtotalCents: 180_000,
  rounds: [],
} as unknown as Quote;

const accepted = replyToClient(quote, "I accept");
assert.equal(accepted.accepted, true);
assert.equal(accepted.subtotalCents, 180_000);

const tooLow = replyToClient(quote, "I propose 900");
assert.equal(tooLow.accepted, false);
assert.equal(tooLow.subtotalCents, 180_000);

const counter = replyToClient(quote, "1500");
assert.equal(counter.accepted, false);
assert.ok(counter.subtotalCents > 150_000);
assert.ok(counter.subtotalCents < 180_000);

assert.match(formatMoney(180_000, "EUR"), /1,800\.00/);

console.log("pricing.check ok");
