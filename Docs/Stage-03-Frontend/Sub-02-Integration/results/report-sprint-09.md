# Sprint 9 Report — Sales, Repairs & Billing (final sprint)

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/hooks`,
`/src/lib/query-keys.ts`, `/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/sales.service.ts`** (new file) — 6 functions: `createDraft`/`updateDraft`/`confirmSale`
  (→`ReceiptDto`)/`listSales`(paginated, scope-parameterized)/`getSale`(reference-keyed, scope-parameterized)/
  `createReturn` (admin-only, single route).
- **`src/services/repairs.service.ts`** (new file) — 6 functions, every one genuinely `STAFF_*`/`ADMIN_*`
  scope-parameterized (unlike sales, where only list/detail are actually paired): `listRepairs`(bare array)/
  `createRepair`/`updateRepair`/`addRepairPart`/`removeRepairPart`/`updateRepairStatus`.
- **`src/services/billing.service.ts`** (new file) — 9 functions covering client (`getMyInvoices`/`getMyInvoice`/
  `getMyInvoicePdf`), staff/admin (`listInvoices`/`getInvoice`/`getInvoicePdf`), and shared
  (`cancelInvoice`/`createClientPayment`/`listClientPayments`) reads/mutations.
- **3 new hook files**: `useSales.ts` (6 hooks), `useRepairs.ts` (6), `useBilling.ts` (7) — all reading from the
  `qk.sales.*`/`qk.repairs.*`/`qk.billing.*` families already scaffolded since Sprint 1.
- **One registry fix**: `qk.billing.mine` was scaffolded keyless — updated to embed the query object (see
  below).
- **`tests/fixtures/data/{sales,repairs,billing}.mock.ts`** (new) + **`msw/{sales,repairs,billing}.handlers.ts`**
  (new), registered in `server.ts`.
- **46 new tests**: `sales.service.test.ts` (9) + `repairs.service.test.ts` (7) + `billing.service.test.ts` (10)
  + `sales.test.tsx` (5) + `repairs.test.tsx` (5) + `billing.test.tsx` (6).

## Tier 5, zero page/component consumer checks — same pattern as Sprint 6

All three domains have no MVP UI, so there was nothing to check for stub-hook collisions from a consumer
standpoint. Still ran the `use-admin-settings.ts` pass per the standing rule (zero hits) and grepped every hook
file for sale/repair/invoice/billing/payment-shaped names — the one near-miss, `use-supplier-information.ts`'s
`useSupplierInvoices`/`useDeleteInvoice`, is purchasing's supplier-invoice domain (already real since Sprint 6),
not billing's client invoices — different domain, no actual collision.

## Five genuine plan.md `*(confirm)*` corrections found by reading the real backend

1. **`createReturn` returns `SaleDto`** — confirmed against `sales.routes.ts` + `ISalesService.createReturn`.
2. **`removeRepairPart` returns the updated `RepairDto` (200), not `void`** — confirmed against
   `repairs.controller.ts`'s `removePart` handler.
3. **`STAFF_STATUS`/`ADMIN_STATUS` are mounted with `router.post`, not `router.patch`** as plan.md's own table
   said — a genuine plan-vs-reality discrepancy, only visible by reading `repairs.routes.ts` directly (the
   interface signature alone wouldn't have shown the HTTP verb).
4. **`getMyInvoices` is `PaginatedResult<InvoiceDto>`, not a bare array** as plan.md's placeholder guessed —
   confirmed against `billing.interface.ts`'s `getMyInvoices(query, clientId)` signature, which genuinely accepts
   an `InvoiceListQuery`.
5. **`cancelInvoice` returns `InvoiceDto` (200)** — confirmed against `billing.controller.ts`.

## Caught a `qk.billing.mine` registry gap before any consumer existed

Because `getMyInvoices` turned out to accept a real filter query (finding #4 above), the Sprint-1-scaffolded
`qk.billing.mine: () => ["billing", "mine"]` (no query param) would have silently collided every filter variant
onto one cache entry — the same invalidation-key bug class Sprint 5 found for `qk.orders.mine`. Fixed at
registry-design time, in `query-keys.ts`, before `useMyInvoices` was ever written (grepped for existing
`qk.billing.mine()` callers first — there were none, so the signature change was safe to make directly rather
than needing a compatibility shim).

## Full cross-domain invalidation matrix (plan §3) applied and verified

Every cross-domain row relevant to this sprint's mutations is wired and asserted in tests:
- `useConfirmSale` / `useCreateReturn` → `qk.sales.all()` + `qk.inventory.all()` + `qk.billing.all()` +
  `qk.clients.all()` + `qk.posClients.all()` + `qk.stats.all()`.
- `useAddRepairPart` / `useRemoveRepairPart` → `qk.repairs.all()` + `qk.inventory.all()`.
- `useUpdateRepairStatus` → `qk.repairs.all()` + `qk.inventory.all()` + `qk.billing.all()`.
- `useCreateClientPayment` → `qk.billing.all()` (no `.all()` sibling on `payments` — same fix class as Sprint
  6's `qk.purchasing.payments`) + `qk.clients.all()` + `qk.posClients.all()`.

Verified via `isInvalidated` where no observer is actively mounted on the swept key in that test, and via
handler-call-count for the one actively-mounted case (`useClientPayments`/`useCreateClientPayment`), per the
Sprint 6 rule for when each assertion style is valid.

## Validation

```
npm run check
```
Clean, whole project, zero errors (`tsc --noEmit` on both `/src` and `/src`+`/tests`).

```
npx vitest run
```
**35/35 files, 299/299 tests passing** (up from 257/257 at Sprint 8 close — 46 new).

Lint: `eslint --fix` scoped to the 16 new files plus the one touched pre-existing file (`query-keys.ts`).
Confirmed zero errors afterward.

## Commit

`fe: integration sprint 9 — sales, repairs & billing` on `stage-03-sub-02-integration`.

## Sub-02 (Integration Engine) is complete

All 9 sprints are done. Every one of the 115 contract routes now has a real service function (unwrapped DTO /
`void` / `Blob`), a hook with correct `qk` keys and cross-domain invalidations, an MSW 2xx handler plus at least
one explicit 4xx/5xx handler, and a schema-validated envelope-shaped fixture. The stale auth harness from Sub-01
was rebuilt in Sprint 2. `tsc --noEmit` is clean and the full `vitest` suite is green (299 tests, 200s + 4xx/5xx
coverage throughout) at every commit on this branch. No test files exist under `/src`; no UI was touched —
`/src/components` and `/src/pages` are exactly as Sub-01 left them. The data layer is ready to be plugged into
the UI in **Sub-03**.
