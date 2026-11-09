# AuraPay — Autonomous AI Commercial Agent & Escrow Protocol

AuraPay is a sandbox commercial desk for freelancers and agencies. An agent negotiates a quote, the server locks every amount, and PayPal invoices, checks out, holds the funds, and releases them milestone by milestone.

## Executive summary

Freelancers usually lose the thread between a verbal price, a PDF invoice, and the moment money actually arrives. Clients want Pay Later. Agencies want to pay a provider only after a deliverable is approved. Disputes start when nobody can show what was agreed.

AuraPay keeps that path in one file:

1. The agent prices the work from a catalog. The browser never sends an amount, a tax, or a secret.
2. Once the client accepts, the server freezes the before-tax price, adds 20% tax, and keeps an 8% platform fee. The provider pool is what remains.
3. Invoicing v2 turns that locked quote into a PayPal invoice, a hosted payment page, and a QR code.
4. JavaScript SDK v6 renders PayPal and Pay Later. Capture happens on the server, then the first milestone is paid out.
5. Later milestones stay in escrow until someone on the file presses **Approve and release**.
6. If the buyer opens an inquiry, the agent drafts a reply from the audit log and shows it before anything is sent.

Sandbox only. No live charges.

## PayPal ecosystem integration matrix

| API | What AuraPay uses it for | Where |
| --- | --- | --- |
| OAuth 2.0 | Merchant access token for server calls. Separate browser client token via `grant_type=client_credentials&response_type=client_token&intent=sdk_init`. `domains[]` is omitted so localhost is accepted. | `lib/paypal/auth.ts`, `GET /api/client-token` |
| Invoicing API v2 | Create a draft from the locked quote (`POST /v2/invoicing/invoices`), send it, read the `payer-view` hosted URL, and build a QR code (`POST .../generate-qr-code`). | `lib/paypal/invoices.ts`, `lib/domain/invoice-flow.ts`, `POST /api/invoices`, `POST /api/invoices/[id]/send` |
| JavaScript SDK v6 | `window.paypal.createInstance({ clientToken, components: ["paypal-payments"], locale: "en-US" })`, then `findEligibleMethods()`. Eligible methods show `<paypal-button>` and `<paypal-pay-later-button>`. `session.start` receives the Promise from `createOrder()`, not the function. | `components/paypal-checkout.tsx`, script `https://www.sandbox.paypal.com/web-sdk/v6/core` |
| Orders API v2 | Server creates a `CAPTURE` order whose amount must match the stored quote. Capture re-reads the order before settling. Negative tests send `PayPal-Mock-Response` for an allowlisted code (`INSTRUMENT_DECLINED`, `DUPLICATE_INVOICE_ID`, and the other codes in `lib/paypal/config.ts`). | `lib/paypal/orders.ts`, `lib/domain/checkout-flow.ts`, `POST /api/orders`, `POST /api/orders/[id]/capture` |
| Payouts API v1 | Each approved milestone is one item in `POST /v1/payments/payouts`. A failed retry mints a new sender batch id. Placeholder provider emails are replaced by `PAYPAL_SAMPLE_PAYOUT_RECIPIENT`. Refresh reads `GET /v1/payments/payouts/{id}`. | `lib/paypal/payouts.ts`, `lib/domain/payout-flow.ts`, `POST /api/milestones/[id]/release`, `POST /api/milestones/[id]/refresh` |
| Disputes API v1 | List disputes, send an inquiry message (`send-message`), or upload evidence (`provide-evidence`). The demo drafts the reply locally first. A live PayPal dispute id is contacted only on submit. | `lib/paypal/disputes.ts`, `lib/domain/dispute-flow.ts`, `lib/domain/dispute-draft.ts`, `/litiges` |
| Webhooks | `POST /api/webhooks/paypal` returns `204` before work. With a webhook id, the signature is checked at `/v1/notifications/verify-webhook-signature`. An empty id in development accepts the payload and logs a warning. `POST /api/dev/webhooks/emit` simulates `PAYMENT.CAPTURE.COMPLETED`. | `lib/paypal/webhooks.ts`, `lib/domain/webhook-flow.ts`, `/journal` |

Amounts are integer cents on the server and decimal strings (`"2160.00"`) on the PayPal wire. Currency is EUR or USD. The EUR to USD catalog display uses a fixed server rate of 1.08.

## Security

- `PAYPAL_CLIENT_SECRET` is read only in server modules. It is never prefixed with `NEXT_PUBLIC_`. Client components import quote types only.
- The browser receives a client token from `GET /api/client-token`, not the merchant access token.
- Create, capture, invoice, payout, dispute message, dispute evidence, and webhook verification send `PayPal-Request-Id`. The OAuth token call does not: PayPal treats that endpoint as a fresh client-credentials grant.
- PayPal errors are logged as `issue` and `debug_id` only. The API response to the UI is `{ error: { message, issue, debugId } }`.
- Order create and capture reject a body that tries to supply its own amount. Zod schemas are strict.
- `/api/dev/*` returns 404 when `NODE_ENV` is not `development`.

## Setup and quickstart

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

Fill `.env.local`:

| Variable | Required | Role |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | Yes | Sandbox REST app client id |
| `PAYPAL_CLIENT_SECRET` | Yes | Server only |
| `PAYPAL_API_BASE` | Yes | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_MERCHANT_EMAIL` | For invoices | Business sandbox email, `sb-…@business.example.com` |
| `PAYPAL_SAMPLE_PAYOUT_RECIPIENT` | For milestone payouts | Personal sandbox email, `sb-…@personal.example.com` |
| `PAYPAL_WEBHOOK_ID` | No | Leave empty on localhost. The simulator’s literal id is `WEBHOOK_ID`. |

Restart `npm run dev` after any env change.

Buyer login for the PayPal button is the Personal sandbox account in the Developer Dashboard under **Testing Tools → Sandbox Accounts**. PayPal does not publish one shared password. Card fields are not used here. Published sandbox cards, if a hosted page asks for one: Visa `4005519200000004`, expiry any future date, CVV `123`.

```bash
npm run typecheck
npm run check
```

## Judge walkthrough (about 3 minutes)

The bottom bar **Demo walkthrough for judges** links each step. Use the sandbox Personal account as the buyer and the address in `PAYPAL_SAMPLE_PAYOUT_RECIPIENT` as the provider payout.

**0:00 — Negotiation.** Open [the brochure-site file](http://localhost:3000/missions/432a928f-afec-48ff-a629-c22652cd07e2) or [New](http://localhost:3000/missions/nouvelle). The brief has no price. Reply with an offer such as `I propose 2,600`, or press **Accept the current offer**. Show that the tax and fee lines update only from the server.

**0:40 — Invoice.** Open [Brand identity, invoiced sample](http://localhost:3000/missions/9529a7bc-16f6-41f9-8a7e-61ca34d6c91b). Point at the PayPal invoice id, **Hosted page**, and the QR image. On a fresh file, **Issue invoice** then **Send and generate QR**.

**1:20 — Checkout.** Open [checkout](http://localhost:3000/missions/9529a7bc-16f6-41f9-8a7e-61ca34d6c91b/checkout). Both buttons appear after `findEligibleMethods` (`locale` is `en-US`). Pay Later’s own label follows the EUR market. Optional: open **Sandbox negative test**, choose `INSTRUMENT_DECLINED`, and capture to show `issue` plus `debug_id`.

**2:00 — Escrow.** Open [Brand identity escrow](http://localhost:3000/missions/4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c). If the file is still only accepted, press **Simulate capture webhook** (development only) so it becomes paid and the first tranche is sent. Then press **Approve and release** on **Production & Delivery**. The timeline shows the amount, the Personal sandbox recipient, the batch id, and `SUCCESS` after **Refresh batch status**. **Final Sign-off** stays blocked until that tranche is paid.

**2:40 — Dispute.** On the same file, or on [Disputes](http://localhost:3000/litiges), press **Simulate Buyer Dispute (Inquiry)**. Read the proposed reply. It cites the audit log and is not sent. **Submit this response** stores it locally. It calls PayPal only when a real dispute id is selected.

If a second jury needs a clean Brand identity file, press **Reset Brand identity demo** in the walkthrough bar, or:

```bash
curl -X POST http://localhost:3000/api/dev/reset-demo \
  -H 'content-type: application/json' \
  -d '{}'
```

That sets mission `4bc5f213-cdb6-4cc1-a37f-2d39159e0d7c` back to an accepted quote: new invoice number, milestones locked, PayPal invoice, order, capture, payout, and inquiry draft removed. Negotiation text stays. Pass `{ "quoteId": "<uuid>" }` to reset another file. The route is 404 outside development. PayPal’s own sandbox records are not deleted.

## Project map

```
app/api/orders          Orders v2 create and capture
app/api/invoices        Invoicing v2
app/api/milestones      Payouts v1
app/api/disputes        Disputes v1 and the local inquiry draft
app/api/webhooks/paypal Signature check, then 204
app/api/dev             Local webhook emitter and demo reset
components/paypal-checkout.tsx
lib/paypal              Typed PayPal client
lib/domain              Quote, agent, escrow, dossier
```

Local files live in `.data/aurapay.json` (gitignored).
