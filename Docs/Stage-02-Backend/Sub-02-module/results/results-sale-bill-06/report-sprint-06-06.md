# Sales+Billing — Sprint 6 Report: Billing — Logic (service + listener)

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 6 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/billing/billing.service.ts`
`BillingService implements IBillingService`, constructor DI `(prisma, sequence: ISequenceService,
settings: IStoreSettingsPort)`.

- **`issueFromSale`** — skips `origin === 'REPAIR'` outright; else reads the persisted `Sale` +
  `SaleLine[]` rows (cost/profit/reference the event omits, plan §C-3), resolves a client
  name/address snapshot (see below), and issues via a shared `issueInvoice` helper.
- **`issueFromOrder`** — dormant until the (unbuilt) orders module emits; thin payload,
  `totalCost`/`totalProfit` default to `0` (plan §C-4); no `Sale` row touched at all.
- **`issueInvoice`** (private, shared by both) — one `$transaction`: allocate `DocType.INVOICE` →
  `tx.invoice.create`. A `P2002` (the `@@unique(sourceType, sourceId)` hit) is caught **after**
  the transaction rejects (not inside the callback) so the sequence-counter bump rolls back
  atomically with the failed insert — no wasted invoice numbers on a replay race. Emits
  `invoice.issued` only after a successful commit.
- **`cancelInvoice`** — status-only; skips the update+emit entirely when already `CANCELLED`
  (idempotent, no double-emit); numbers/sequence untouched either way.
- **`createClientPayment`** — locks the `PosClient` row (mirrors sales'/purchasing's own
  `lockPosClient`/`lockSupplier`), snapshots `previousCredit`, `newCredit = previous − amount`
  (overpayment permitted, negative = store owes), validates a supplied `invoiceNumber` belongs to
  the same `posClientId`, persists via `DocType.CLIENT_PAYMENT`, emits `payment.clientRecorded`.
- **`applyClientPaymentRecorded`** — recomputes `paidAmount` from `Σ ClientPayment.amount` (not an
  increment — idempotent under replay by construction, plan §D-7), flips
  `ISSUED→PARTIALLY_PAID→PAID`; no-op for on-account payments (no `invoiceNumber`); never revives
  a `CANCELLED` invoice.
- **Reads** — `getMyInvoice`/`getStaffInvoice`/`getAdminInvoice` (+ list variants) all route
  through one `toInvoiceDtos` helper that resolves the two Sprint-5-flagged gaps (below) before
  calling the mapper. List filters (`posClientId`/`status`/`source`/`from`/`to`) are spread
  **before** the route's own scoping (`posClientId`/`staffId`), so a scoped route's identity can
  never be overridden by a query-string value.
- **PDF** (`get*InvoicePdf`) — builds the same audience-gated `InvoiceDto`, reads the store header
  via the new `IStoreSettingsPort`, renders through `@common/utils/pdf.utils.ts`'s
  `renderInvoicePdf` (new — see below), returns `{ filename, mime: 'application/pdf', body }`.

### The two Sprint-5-flagged gaps, resolved here

**1. `sourceReference` (required on every audience) — resolved via `resolveSourceReferences`.**
Batch-groups the invoice rows in a page by `sourceType`, issues one `Sale.findMany`/one
`Order.findMany` (not N+1 queries), builds a `Map<sourceId, reference>`. Called once per read
(list or single), regardless of audience.

**2. `currentAverageCost` (admin-only) — resolved via `resolveCurrentAverageCosts`, SALE-origin
only.** For each admin-viewed `SALE`-sourced invoice, loads that sale's `SaleLine[]` and matches
each `InvoiceLine` to a `SaleLine` by `(label==productNameSnapshot, quantity, unitPrice)`, then
batch-fetches `Product.averageCost` for the resolved `productId`s. **ORDER-origin is intentionally
left unresolved** (returns nothing, gracefully omitted by the mapper) — orders aren't built yet
(plan §C-4), so there's no way to test this path honestly this set; implementing it now would be
speculative. The documented limitation from Sprint 5 stands: two identical lines entered
separately (not one line at a higher quantity) could both match the same `SaleLine` candidate —
an edge case, not the common path.

### New: `@common/utils/pdf.utils.ts` + `pdfkit` dependency
Added `pdfkit` (`^0.19.1`) + `@types/pdfkit` as real dependencies (network access confirmed
available; installed cleanly, Node-version engine warnings only, unrelated). `renderInvoicePdf(data): Promise<Buffer>`
is a small, pure layout function — store header, invoice number/status/date, bill-to
name/address, a line-item list, totals — taking only already-resolved primitives (never touches
Prisma/product/price data itself, matching "never recomputed from live data").

### New: `IStoreSettingsPort` (`billing.interface.ts`, added this sprint)
Narrow port (`getSettings(): Promise<SettingsDto>`) — `platform.routes.ts` doesn't export a
`platformService` singleton (only `sequenceService`/`deliveryFeeService`), so rather than modify
an already-completed module, Sprint 7's composition root will construct a **second**
`PlatformService(prisma)` instance locally (stateless beyond holding `prisma`, so a second
instance is harmless — no shared/duplicated writes, `getSettings` is a pure read).

### `Apps/api/src/modules/billing/billing.listener.ts`
Subscribes `sale.confirmed` → `issueFromSale`, `order.confirmed` → `issueFromOrder`, and its own
`payment.clientRecorded` → `applyClientPaymentRecorded`. Same `safeRun` guard as every other
listener in the codebase.

### Tests
- `test/unit/modules/billing/billing.service.spec.ts` (17 tests): REPAIR-origin skip (no sequence
  call at all); POS issue reads real `costOfGoods`/`profit` off `SaleLine`; **replay swallowed as
  a no-op** (P2002 → resolves cleanly, no emit); ORDER issue touches no `Sale` row, cost/profit
  default `0`; cancel changes status only + leaves the sequence gap (no `sequence.nextNumber`
  call at all) + is idempotent on a second cancel (no double-emit); client-payment snapshot math +
  overpayment negative-credit + on-account (no invoice touched) + unknown-invoiceNumber 400;
  ledger-recompute flips `ISSUED→PARTIALLY_PAID`/`→PAID`, is a no-op with no `invoiceNumber`, and
  never revives a `CANCELLED` invoice; `getMyInvoice` 404 on foreign `posClientId`,
  `getStaffInvoice` 403 on a non-issuing staff member; PDF rendering returns a real
  `%PDF`-prefixed non-empty `Buffer` with the right MIME/filename.
- `test/unit/modules/billing/billing.listener.spec.ts` (4 tests): `sale.confirmed(POS)` → one
  invoice + one `invoice.issued` (asserted via a **plain subscriber on the real eventBus**, same
  trap-avoidance as sales' Sprint 3 listener spec — never re-mock `TypedBus.emit` by object-spread,
  it breaks `on`'s `this` binding); `sale.confirmed(REPAIR)` ignored entirely (no `Sale` read even
  attempted); `payment.clientRecorded` recompute is genuinely idempotent across two sequential
  `eventBus.emit` calls; a handler throw is swallowed (logged, no re-emit).

Two small test-authoring bugs were caught and fixed during this sprint, not service bugs:
`cancelInvoice` (and its already-cancelled variant) internally reload via `getAdminInvoice`, so
each needed a **second** `invoiceFindUnique` mock value queued; the PDF test's mock invoice row
was initially missing a `status` field, which the mapper's `.parse()` guard correctly rejected.

---

## Validation

| Check | Result |
|---|---|
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 481/481 (34 files) |
| `Apps/api`: `npm run lint` | ✅ clean (one unused-import fix) |
| `Apps/contract`: `npx tsc --noEmit` | ✅ clean (unchanged this sprint) |
| Events emitted post-commit; issue idempotent by `@@unique(sourceType, sourceId)`; `paidAmount` recomputed from the ledger, never incremented | ✅ |
| No cross-module folder import beyond `ISequenceService` (shared infra) + the locally-declared `IStoreSettingsPort` — `Sale`/`SaleLine`/`Order`/`Client`/`Product` are read via the shared `prisma` singleton, a pure read (plan §D-4) | ✅ |
| `npm run test:int` | not run — no `billing` route exists yet; first applicable at Sprint 7 |

---

## Notes for later sprints

- **Sprint 7** (billing API): composition root must construct a second `PlatformService(prisma)`
  locally (no export needed from `platform.routes.ts`) to satisfy `IStoreSettingsPort`.
  Integration test should drive a real POS sale confirm (sales module, done in set-06 Sprint 4)
  through to a real issued invoice, end-to-end — sales' own integration spec already proves the
  `sale.confirmed` emit path works against a real DB.
- `resolveCurrentAverageCosts` is SALE-origin only; extending it to ORDER-origin is a one-line
  addition (direct `Order.productId`, no ambiguity) once the orders module actually exists and
  emits a real `order.confirmed` to test against.
- `pdfkit`/`@types/pdfkit` added to `package.json` — a genuine new dependency, not previously
  present; confirmed installable (network reachable in this environment).

---

## Commit

`git add .` then `git commit -m "billing: sprint 6 — logic (service + listener)"`.
