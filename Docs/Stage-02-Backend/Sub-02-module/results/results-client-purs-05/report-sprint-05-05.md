# Clients+Purchasing — Sprint 5 Report: Purchasing — Foundation (mapper, interface, factories)

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 5 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/purchasing/purchasing.mapper.ts`
Six static methods, each field-listing and ending in a `…ResponseSchema.parse(dto)` guard:
- `toSupplierDto(supplier, extras)` — `Decimal→number`; `extras = { invoiceCount; lastDeliveryAt? }`
  supplied by the caller (see the schema-gap note below — neither is a `Supplier` column).
- `toSupplierInvoiceDto(invoice)` — `invoiceDate`/`dueDate` (`@db.Date` columns) converted via a
  private `toDateOnly` (`.toISOString().slice(0,10)`) to match the contract's `z.iso.date()`
  shape, **not** a full ISO datetime; `previousCredit`/`newCredit` omitted unless non-null
  (present only once `CONFIRMED`); `status` cast (Prisma's own `$Enums.SupplierInvoiceStatus`
  vs. the contract's, same identical-values-distinct-types precedent as `ClientStatus`); per-line
  `projectedNewAverageCost` included only when the caller merged it onto the row (DRAFT reads —
  Sprint 6's job); `staffName` composed from the `staff` relation.
- `toConfirmResultDto(reference, repriceCandidates)` — pure assemble+parse;
  `repriceCandidates` supplied pre-resolved by catalog's reprice read port (Sprint 1), never
  rebuilt here (same precedent as clients' `toCartItemDto`).
- `toSupplierPaymentDto(payment)` — `Decimal→number`; `supplierInvoiceReference` only when the
  payment is linked to an invoice (on-account payments have none); `staffName` composed.
- `toSupplierDetailDto(supplier, invoices, payments, productHistory)` — composes **already-mapped
  DTOs** (the service calls the other four methods first), converting only `productHistory`'s
  `lastPurchaseAt` dates and schema-guarding the aggregate.
- `toSupplierStatsDto(counts)` — straight assemble+parse.

**Schema gap discovered and resolved without a migration.** `SupplierDto.lastDeliveryAt` and the
module spec's own Business Logic ("confirmed → ... `lastDeliveryAt`") require a value that **no
column on the `Supplier` Prisma model provides** — `schema.prisma`'s `Supplier` model has no
`lastDeliveryAt` field at all (double-checked by re-reading the model). Adding one would need a
real migration, and this sandbox has no Postgres access (confirmed unreachable in Sprint 4's
report) — `prisma migrate dev` needs a live DB to diff against, so authoring one blind here would
be unverifiable and risky. Resolved the same way clients' Sprint 3 handled `totalOrders`/
`totalSpent`: **derive it**, not store it — `lastDeliveryAt = MAX(SupplierInvoice.updatedAt)`
for that supplier's `CONFIRMED` invoices (an invoice's `updatedAt` is exactly its confirm
timestamp, since invoices are immutable after confirm — spec's own invariant). The mapper accepts
this as a plain optional `Date` in `extras`; Sprint 6's service computes it via
`supplierInvoice.aggregate({_max:{updatedAt:true}})`. Zero schema/migration risk, fully
derivable from data that already exists.

### `Apps/api/src/modules/purchasing/purchasing.interface.ts`
- `IPurchasingService` — all HTTP-facing methods from plan §II.2, typed against real contract
  DTOs/Commands/Queries.
- **Listener-invoked methods named per-event** (`applySupplierInvoiceConfirmed`,
  `applySupplierInvoiceCancelled`, `applyPaymentSupplierRecorded`, typed directly against
  `PurchasingEvents[...]` payload shapes) **rather than the plan's single
  `recomputeSupplierCaches(supplierId, tx?)`** — mirrors clients' Sprint 3 precedent exactly.
  Purchasing owns **both** the emitting side (confirm/cancel/payment — Sprint 6 — already must
  guard against double-firing, e.g. a double-confirm is a no-op that never re-emits) and the
  listening side, so correctness comes from that single-emission guarantee, the same reasoning
  that led Sprint 3 away from a from-scratch ledger recompute for clients' `PosClient` cache.
  `recomputeSupplierCaches` as a literal named method is dropped; Sprint 6 will implement each
  handler as a plain, literal application of its event's own snapshot/delta (matching the
  spec's own wording — "credit += total", "credit −= amount", "totalPaid += amount").
- `ICatalogRepricePort` — `getRepriceCandidates(tx, productIds)` / `getCostBasis(productIds)`,
  typed to match `CatalogProductService`'s real Sprint 1 method signatures **exactly** (verified
  by a clean `tsc --noEmit`), so Sprint 7's wiring needs zero adapter shim — same
  dependency-inversion + direct-import precedent clients' `ICatalogCartPort` established.

### Factories (`Apps/api/test/data/`)
- `supplier.factory.ts` — `createSupplierPayload` (parses `CreateSupplierSchema`) +
  `seedSupplier` (persistence).
- `supplier-invoice.factory.ts` — `createSupplierInvoicePayload` (parses
  `CreateSupplierInvoiceSchema`, defaults to the `lines` branch unless the caller supplies
  `amountOnly`, respecting the XOR refine) + `seedSupplierInvoice` (persistence, incl. nested
  line creation).
- `supplier-payment.factory.ts` — `createSupplierPaymentPayload` (parses
  `CreateSupplierPaymentSchema`) + `seedSupplierPayment` (persistence; `newCredit` defaults to
  `previousCredit − amount` when not overridden).
- All codes/references are random strings, not sequence-allocated — real allocation is
  `SequenceService`'s own job under test, per plan §A.

### Tests (`Apps/api/test/unit/modules/purchasing/purchasing.mapper.spec.ts`)
13 tests, written before the mapper implementation: `Decimal→number` across all four money-
bearing DTOs; `@db.Date → "YYYY-MM-DD"` (not a full ISO datetime) for `invoiceDate`/`dueDate`;
`previousCredit`/`newCredit` present only once `CONFIRMED`, absent on `DRAFT`;
`projectedNewAverageCost` present only when the caller supplied it per line; `staffName`
composition on both invoice and payment; `supplierInvoiceReference` present only for a
linked (not on-account) payment; `lastDeliveryAt`/contact-field optional include/omit;
`toSupplierDetailDto`'s three-section assembly + `productHistory` date conversion;
`toConfirmResultDto`/`toSupplierStatsDto` passthrough.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 375/375 (26 files, 13 new) |
| `npm run lint` | ✅ clean (one `no-unused-vars` finding on an unused test import, fixed) |
| Mapper pure/field-listing; returns contract DTOs only | ✅ |
| No route/DTO/enum re-declared that already existed; no `schema.prisma` change | ✅ |

No service logic in this sprint — `purchasing.service.ts` does not exist yet.

---

## Notes for later sprints

- **Sprint 6** (`PurchasingService`) owns: the `lastDeliveryAt` aggregate query described above;
  the landed-cost/`projectedNewAverageCost` computation feeding DRAFT reads via
  `ICatalogRepricePort.getCostBasis`; the confirm-transaction's `getRepriceCandidates` call
  (in-tx, post-`addLayer`); and each of the three listener-invoked methods as a **plain, literal**
  application (not a ledger recompute) — `applySupplierInvoiceConfirmed`:
  `Supplier.credit += totalAmount`, `totalInvoiced += totalAmount`, `lastDeliveryAt` refreshed;
  `applySupplierInvoiceCancelled`: reverse; `applyPaymentSupplierRecorded`:
  `credit −= amount`, `totalPaid += amount`, target invoice's `paidAmount`/derived status updated.
- `createSupplier`'s `initialCredit` should emit `supplier.creditChanged` only when truthy (a
  `0→0` create is a no-op event) — the same pattern Sprint 3 established for `PosClient`'s
  `posClient.creditChanged`, since observability already narrates
  confirmed/cancelled/paymentRecorded via their own specific events (checked
  `observability.listener.ts`'s `registerPurchasing()` — all four purchasing events, including
  `supplier.creditChanged`, are already wired there).

---

## Commit

`git add .` then `git commit -m "purchasing: sprint 5 — foundation (mapper, interface, factories)"`.
