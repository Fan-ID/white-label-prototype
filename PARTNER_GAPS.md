# White-label (Groover): Public API gaps for partners

Investigation based on the prototype that uses **only the Public API**, with a single org API key. Scope: wallet, billing, renewal, events, and partner-user mapping.

## TL;DR

- **Blocker:** every wallet campaign created via the Public API is born with **auto-renew on**, and the partner has no way to turn it off. Spend has no ceiling: at the end of each cycle the backend debits another cycle from the org wallet.
- **No balance endpoint.** The partner only learns the wallet is empty when create returns `402 insufficient_credit`.
- **No Spotify lookup.** The partner cannot validate track/playlist (existence, metadata, eligibility) before create — they only find out on `POST /v1/campaigns` (after the end-customer flow may already have progressed).
- **Charge card on campaign create:** does not exist today, not even in the product UI. **Not recommended** for white-label: the partner bills the artist; Soundlink bills the partner (B2B).
- The internal wallet is already mature (ledger, reservations, auto-recharge, cards). The gap is **exposing it on the Public API**, not building it from scratch.

## What already exists on the Public API

| Capability             | Detail                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Create wallet campaign | Reserves `dailyBudget × durationDays` upfront. Insufficient balance → `402 insufficient_credit` with `details: { available, required }` |
| Increase budget        | Debits the wallet and returns `walletBalance` (only place balance appears in the API)                                                   |
| Decrease budget        | Async refund to the wallet (min $10/day, more than 3 days remaining)                                                                    |
| Stop                   | Refunds unspent amount to the wallet. Terminal: no restart                                                                              |
| Metrics                | `spend_media`, `spend_total`, `fees`, CPL/CPF, breakdown and daily export                                                               |
| Idempotency            | Required on create/stop/budget; 24h TTL; `409` if the same key is reused with a different body                                          |
| Rate limit             | 60/min and 600/hour per key; video import 20/hour                                                                                       |

## Gaps

### P0: before shipping to the partner

1. **Auto-renew control**
   - Today: `campaigns.repository.ts` sets `auto_renew_enabled: true` for every wallet campaign. The toggle exists (`PUT /api/v1/campaigns/:id/wallet/auto-renew`) but only with a Firebase token.
   - Impact: the partner’s per-user spend cap (e.g. $10/day × 7 days = $70) does not hold. Renewal can also cost **more** than create because it includes Ad fees.
   - Proposal: `autoRenew: boolean` on `POST /v1/campaigns` (default `false` for partners, or org-configurable) and/or `PUT /v1/campaigns/{id}/auto-renew`.

2. **`CampaignStatus` enum out of date in OpenAPI**
   - OpenAPI documents `creating|active|paused|stopped|completed|failed|ended`, but the backend returns the internal status as-is, including `renewing`, `renew_failed`, and `inactive`.
   - Proposal: document the real enum and lifecycle (which statuses are terminal, which allow stop).

3. **`GET /v1/wallet`**
   - Today: does not exist. The internal endpoint `GET /organizations/:id/credits` returns only `{ balance, updatedAt }` without subtracting active reservations, so exposing it as-is would be misleading.
   - Proposal: `{ balance, available, reserved, currency: "USD", updatedAt }`, with scope `wallet:read`. Reuse `CreditService.getAvailableBalance` (the agent already does this in `WalletToolsService.getWalletBalance`).

4. **`wallet_not_enabled` gate**
   - `PublicApiWalletNotEnabledError` is defined and documented, but **never thrown**. An org without wallet enabled is not blocked on create.

### P1: to operate at scale

5. **Spotify lookup / validation before create**
   - Today: there is **no** endpoint like `GET /v1/spotify/lookup` (or equivalent) on the Public API. OpenAPI only mentions an internal lookup when creating a soundlink (“resource must currently exist on Spotify”).
   - Impact: the partner **cannot validate** URL, type (track vs playlist), Spotify existence, name/artwork/artist, or eligibility rules **before** charging the customer or calling `POST /v1/campaigns`. Poor UX and late create failures (and, if the partner already charged the artist, refunds on their side).
   - The product UI has this (resolve + preview before submit). The white-label prototype can only paste a URL and hope.
   - Proposal: `GET /v1/spotify/lookup?url=...` (or `POST` with body) → `{ type, spotifyId, name, artists, imageUrl, eligible, reason? }` plus clear errors (`invalid_spotify_url`, `spotify_not_found`, `not_eligible`). Suggested scope: `campaigns:read` or `spotify:read`.

6. **External reference on create**
   - Today: only `campaignName`, which becomes the smartlink name and **does not round-trip** on `GET /v1/campaigns`. The partner must keep its own `campaignId → user` mapping table.
   - Proposal: `externalReference` (string) or small `metadata` object, returned on GET and filterable.

7. **List filters**
   - Today `GET /v1/campaigns` accepts only `page`, `pageSize`, `sortBy`, and `sortOrder`.
   - Proposal: filter by `status`, `externalReference`, and created date.

8. **Webhooks**
   - Today: none. Low balance and renew failure send **email** to the org primary user; the partner only learns via polling (within the 60 req/min limit).
   - Minimum events: `campaign.status_changed`, `campaign.renew_failed`, `wallet.low_balance`, `wallet.topup_credited`.

9. **Wallet history** (`GET /v1/wallet/transactions`)
   - So the partner can reconcile what they charged artists with what Soundlink debited. Reuse `listOrgLedger`, without exposing `debug_payload`.

### P2

10. Receipts and invoices via API (today only the internal route `.../credits/topups/:id/invoice`).
11. Threshold auto-recharge and API top-up with the partner’s corporate card (see section below).
12. Restart a `stopped` campaign (today the path is to create another).
13. Per-sub-account balance isolation. Today all partner users share the same org wallet; per-user caps stay on the partner side.

## Charge card on campaign create

**How it works today:**

- No path charges a card on create, including the UI. Create stays disabled until the wallet covers the cycle; the user tops up first (Stripe Checkout or saved card, min $50).
- Org-level auto-recharge exists (Primary card + monthly cap), but it **only fires on renewal** and charges only the shortfall. `threshold_amount` and `recharge_amount` are stored but do not drive the charge.
- There is no “balance below X → top up” job.

**Recommendation for white-label:**

- **V0:** invoice + CSM admin-topup, as already decided.
- **Phase 2:** threshold auto-recharge on the partner’s corporate card (e.g. “if `available` < $500, recharge $2,000”). Requires `threshold_amount` to actually drive charges and the trigger to extend beyond renewal. Off-session charging in `wallet-auto-recharge.writer.ts` can be reused.
- **Do not:** charge the end artist’s card through Soundlink. That mixes end-user billing with org funding and pulls chargebacks, fraud, refunds, and PCI into Soundlink.

## Risks for Groover V0 if nothing changes

- Campaigns renew on their own and debit cycles the partner did not plan for.
- `renew_failed` is silent for the partner (email goes to the org).
- Shared wallet: one artist can consume credit meant for others.
- Without a visible balance, the partner only learns funds are gone when create fails with 402.
- Without lookup, an invalid or ineligible URL only surfaces on create — after the customer (and billing) flow has already moved forward.
