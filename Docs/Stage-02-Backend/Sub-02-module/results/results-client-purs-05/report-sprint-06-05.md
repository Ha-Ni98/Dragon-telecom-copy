# Clients+Purchasing — Sprint 6 Report: Purchasing — Logic (service + listener)

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 6 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/purchasing/purchasing.service.ts` — `PurchasingService implements IPurchasingService`
Constructor DI: `(prisma, sequence: ISequenceService, inventory: IInventoryService, catalogReprice: ICatalogRepricePort)`.

- **Suppliers**: `listSuppliers`/`supplierStats`/`getSupplier` (the `SupplierDetailDto` aggregate:
  supplier + invoices + payments + `productHistory`, the last grouped from `SupplierInvoiceLine`
  rows on **CONFIRMED** invoices only, keyed by `productNameSnapshot` — no join to `Product`
  needed); `createSupplier` (`code` via `DocType.SUPPLIER`, inside the same tx as the sequence
  allocation — the connection-rule pattern inventory's `createAdjustment` established);
  `updateSupplier` (P2025 → 404).
- **Invoices**: `createInvoice`/`updateInvoice` compute the **landed cost**
  (`unitCost + shippingCost × (lineTotal/Σ lineTotals) / quantity`) via a shared
  `buildInvoiceLines` helper, resolving `productNameSnapshot` through
  `catalogReprice.getCostBasis` (400s on an unknown `productId` — confirmed absent from the
  returned cost-basis set, rather than waiting for a raw `P2003` FK error). `updateInvoice` 409s
  when not `DRAFT`; supports switching between the `amountOnly`/`lines` branches mid-edit (an
  explicit patch field wins; absent either, keeps whichever branch the existing row is already
  on) since "DRAFT freely editable" is the spec's own wording, and re-validates/recomputes
  totals whenever `lines`, `amountOnly`, or `shippingCost` changes (shipping alone still shifts
  every line's landed cost). DRAFT reads (`getInvoice`/`listInvoices`) attach
  `projectedNewAverageCost` per line via `catalogReprice.getCostBasis`; CONFIRMED/CANCELLED
  invoices never project (the average is already real).
- **Confirm** — one transaction, `Supplier` row locked (`SELECT ... FOR UPDATE`, same precedent
  as inventory's `lockProduct`/platform's `SequenceService`): per line, injected
  `inventory.addLayer(tx, ..., MovementType.SUPPLIER_INVOICE, {referenceType:'SUPPLIER_INVOICE', referenceId: invoiceId, staffId})`;
  credit snapshot `previous→new`; `reference` via `DocType.SUPPLIER_INVOICE` (allocated **inside**
  the same tx, replacing the DRAFT placeholder — see the schema-tension note below); status
  `CONFIRMED`; commit → `inventory.flushEvents(capturedTx)` → emit `supplierInvoice.confirmed`.
  `getRepriceCandidates` runs **inside** the same tx (captured via the exact `capturedTx`-closure
  pattern `inventory-engine.integration.spec.ts` already established for cross-module
  transaction proofs) so it sees each line's post-`addLayer` `averageCost` before returning.
  Double-confirm is a no-op: adds no layers, emits nothing, just recomputes `repriceCandidates`
  fresh off the current average. Zero-line (`amountOnly`) confirm raises credit with zero
  `addLayer` calls.
- **Cancel**: sets `CANCELLED` unconditionally (idempotent no-op if already cancelled), but
  **only emits `supplierInvoice.cancelled` when the invoice was previously `CONFIRMED`** — a
  genuine correctness point, not in the plan's literal wording: a `DRAFT→CANCELLED` transition
  never touched credit/stock, so if the listener blindly reversed on every cancel it would wrongly
  decrement credit that was never added for a DRAFT cancel. Stock reversal is deliberately **not**
  automatic (spec BL#4) — the admin issues a manual `ADJUSTMENT_OUT` through inventory.
- **Payments**: `createPayment` locks the `Supplier` row, snapshots `previousCredit→newCredit`
  (`newCredit = previousCredit − amount` — **overpayment is permitted**, going negative; "flagged"
  per the spec has no dedicated DTO field, so a negative `newCredit` **is** the flag, read
  directly off the response), validates a given `supplierInvoiceReference` belongs to the same
  supplier (400 otherwise), allocates `reference` via `DocType.SUPPLIER_PAYMENT` inside the same
  tx, emits `payment.supplierRecorded`.
- **Listener-invoked methods** (Sprint 5's per-event interface): `applySupplierInvoiceConfirmed`
  sets `credit` from the event's own snapshot (idempotent — a replay sets the same value) +
  increments `totalInvoiced`; `applySupplierInvoiceCancelled` reverses using the invoice's own
  stored `totalAmount` (no snapshot in this payload — only ever emitted for a previously-
  `CONFIRMED` invoice, per the cancel guard above, so it can never double-reverse a DRAFT cancel);
  `applyPaymentSupplierRecorded` sets `credit` from the snapshot + increments `totalPaid` +
  increments the linked invoice's `paidAmount` (spec: "invoice paidAmount/status" — interpreted as
  just the `paidAmount` column; there is no dedicated payment-status enum value to set,
  `SupplierInvoiceStatus` only has `DRAFT`/`CONFIRMED`/`CANCELLED`, so "status" here reads as the
  frontend's own derived paid/partial/unpaid label off `paidAmount` vs `totalAmount`, not a
  stored column).

### Schema/spec tension discovered and resolved: DRAFT invoices need *some* `reference` before confirm
`SupplierInvoice.reference` is `String @unique`, **not nullable** — but the spec explicitly places
`SequenceService('SUPPLIER_INVOICE')` at **confirm** time only ("Confirm ... → SequenceService
('SUPPLIER_INVOICE') → CONFIRMED"), not at create. A DRAFT row therefore needs a placeholder
before any real sequence number exists. Resolved with a temporary, unique `DRAFT-${randomUUID()...}`
reference at create time, overwritten by the real sequence-allocated reference inside confirm's
own transaction. No schema change needed — the column's NOT NULL/unique constraints are satisfied
throughout, and the DTO's `reference: z.string()` (always required) is honoured at every stage.

### `Apps/api/src/modules/purchasing/purchasing.listener.ts`
`PurchasingListener(service: IPurchasingService).setup()` subscribes to purchasing's own
`supplierInvoice.confirmed`/`.cancelled`/`payment.supplierRecorded` (not `supplier.creditChanged`
— that's an audit-only signal purchasing emits, never listens to, for `createSupplier`'s
`initialCredit`). Same `safeRun` guard as `clients.listener.ts`/`ObservabilityListener`.

### Tests
- `test/unit/modules/purchasing/purchasing.service.spec.ts` (18 tests, written before the
  implementation): landed-cost math against a hand calc (two lines + shipping, `toBeCloseTo`
  for the repeating-decimal apportionment); `amountOnly` invoices skip lines entirely; unknown
  `productId` → 400; `updateInvoice` 409 when not DRAFT; confirm adds one layer per line at
  landed cost + snapshots credit + emits once; **double-confirm no-op** (zero `addLayer` calls,
  no re-emit); 409 confirming a `CANCELLED` invoice; zero-line confirm raises credit with zero
  movements; cancel emits only when previously `CONFIRMED` (both the DRAFT-cancel and
  already-cancelled-idempotent branches covered); payment snapshot math + overpayment negative
  credit + unknown-supplier 400; all three listener-invoked methods directly; `updateSupplier`'s
  P2025→404 mapping.
- `test/unit/modules/purchasing/purchasing.listener.spec.ts` (5 tests, real `PurchasingService` +
  mocked Prisma + `eventBus.emit`, mirroring `clients.listener.spec.ts`'s pattern): each of the
  three handlers applies its exact expected delta; a replayed `supplierInvoice.confirmed` sets
  the identical final `credit` value both times (genuinely idempotent by construction, since
  credit is always a snapshot `set`); a handler rejection is swallowed.

**Testing-infrastructure fix made along the way**: the service spec's `beforeEach` originally used
`vi.clearAllMocks()`, which clears call history but **not** queued `mockResolvedValueOnce`
implementations — a test that throws before draining its own queue leaks stale values into the
next test. This caused ~11 confusing cascading failures on the first run (wrong Supplier rows,
`undefined` ids, `tx.supplier.findUniqueOrThrow is not a function` from a missing mock method).
Fixed by switching to `vi.resetAllMocks()` (clears implementations too) plus adding the missing
`supplier.findUniqueOrThrow` mock (needed by `lockSupplier`'s two-step lock-then-fetch, the same
pattern `inventory.service.ts`'s `lockProduct` uses) — all 18 tests then passed without any
further service-code changes, confirming the service logic itself was correct from the first
draft.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean (one real fix needed: Prisma's nested-create type for `SupplierInvoiceLine` requires the "Unchecked" variant — `SupplierInvoiceLineUncheckedCreateWithoutSupplierInvoiceInput` — to accept a plain `productId` scalar instead of `product: {connect}}`) |
| `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 398/398 (28 files, 23 new — 18 service + 5 listener) |
| `npm run lint` | ✅ clean (two `no-unused-vars` findings, both fixed — an unused mapper-type import, and the test's `prismaKnownError` helper now exercised by a new `updateSupplier` P2025 test) |
| Engine reused via injected `IInventoryService` (no re-implementation) — confirm's `addLayer`/`flushEvents` calls go through the port, never a local re-derivation of FIFO logic | ✅ |
| Events emitted post-commit; listener idempotent (credit) / relies on single-emission (totalInvoiced/totalPaid — documented, same as clients' Sprint 3 precedent) | ✅ |

No route/controller/wiring in this sprint — `purchasing.routes.ts` does not exist yet, so
`npm run test:int` is not applicable (first relevant in Sprint 7, and even then subject to the
same Docker/Postgres access limitation flagged in Sprint 4's report).

---

## Notes for later sprints

- **Sprint 7** (API/wiring) injects the real `inventoryService` (`IInventoryService`, from
  `inventory.routes.ts`), `sequenceService` (from `platform.routes.ts`), and the real
  `catalogProductService` (as `ICatalogRepricePort` — already satisfies both `getRepriceCandidates`/
  `getCostBasis` structurally, confirmed by this sprint's clean `tsc`) directly into
  `purchasing.routes.ts`'s composition root — the same direct-sibling-import pattern
  `clients.routes.ts` established in Sprint 4 (no adapter needed; purchasing→inventory/catalog/
  platform is one-directional).
- `SUPPLIER_STATS` (`/admin/suppliers/stats`) must be registered **before** `SUPPLIER_BY_ID`
  (`/admin/suppliers/:id`) in `purchasing.routes.ts`, exactly like `CLIENT_ROUTES.ADMIN_STATS`
  before `ADMIN_DETAIL` in Sprint 4 — same route-ordering hazard.

---

## Commit

`git add .` then `git commit -m "purchasing: sprint 6 — logic (service + listener)"`.
