# Stage 02 · Sub-02 — Sales + Billing Module Sprint Plan (set 06)

Decomposes [`plan-sale-bill.md`](./plan-sale-bill.md) into dependency-ordered sprints.
Order obeys the phase rule **foundation (mapper/interface) → logic (service/listener) → API
(controller/wiring)**, per module, behind one shared **prerequisites** sprint that lands the
cross-module enablers the plan §C flags. **No code in this document.**

Standing rules carried through: contract governs WHICH (nothing re-declared that already exists —
plan §0), rules govern HOW, phase file WHAT/WHEN. The user has **accepted the §C/§D resolutions**
(C-1 add two `DocType` values, C-2 catalog POS-price port, C-3 billing reads persisted `SaleLine`,
C-4 dormant order path reading source rows, C-5 `BadRequestError` for `CREDIT_REQUIRES_CLIENT`).
Commit style: `git add .` + short `scope: sprint N — topic`, no `Co-Authored-By`. Commit each
sprint **on green**.

---

## Sprint sequence & rationale

| # | Sprint | Layer | Why separate |
|---|---|---|---|
| 1 | Shared prerequisites & contract | enabling | The plan §C-1/§C-2 gaps touch the **contract** package (`DocType` + seed) and the **catalog** module (POS-price read method). Landing them first, independently tested, unblocks `sales` and keeps the contract/catalog build green in one atomic change. Neither `sales/` nor `billing/` exists yet. |
| 2 | Sales — Foundation | foundation | Factories, pure `sales.mapper.ts`, `ISalesService` + consumer-side `ICatalogPosPricingPort`, mapper unit tests. No DB writes. |
| 3 | Sales — Logic | logic | `SalesService` + `SalesListener`; draft / confirm (in-tx FIFO + credit + sequence) / return / repair-pickup; emits + handles events; service & listener unit tests (mock Prisma + fake ports + spy bus). |
| 4 | Sales — API | api | Controller, `sales.routes.ts` composition root, wiring into `modules/index.ts`, integration + conformance. |
| 5 | Billing — Foundation | foundation | Factories, pure `billing.mapper.ts`, `IBillingService` + local `PdfResult`, mapper unit tests. |
| 6 | Billing — Logic | logic | `BillingService` + `BillingListener`; issue-from-event / cancel / client-payment / PDF render; emits + handles events; unit tests. |
| 7 | Billing — API | api | Controller, `billing.routes.ts`, wiring, integration (incl. end-to-end sale→invoice, now that sales exists) + conformance. |

**Prisma:** no schema migration — every model (`Sale`, `SaleLine`, `Return`, `ReturnLine`,
`Invoice`, `InvoiceLine`, `ClientPayment`) already exists (plan §0). Sprint 1 changes the
**contract** (`DocType`) and **seed defaults**, not `schema.prisma`.

**Build order note:** `billing` (Sprints 5-7) follows `sales` (2-4) deliberately — billing's
`issueFromSale` reads persisted `Sale`/`SaleLine` rows (plan §C-3), so its Sprint 7 integration
test can drive a real POS confirm end-to-end into an issued invoice rather than only a synthetic
event.

**Cross-module reuse (do not re-implement):** confirm/return reuse the inventory injected engine
(`consumeFifo`/`returnIn`/`flushEvents`, `MovementRef`, post-commit flush seam) exactly as the
inventory module documented; both modules take `sequenceService` for reference/number allocation —
same direct-sibling-import DI as set 05 (`clients`/`purchasing`).

---

### Sprint 1: Shared prerequisites & contract   — Status: ✅ Done

**Goals**
- Land the two §C-1 `DocType` values (+ seed prefixes) and the §C-2 catalog POS-price read
  method so `sales` can be built against real, tested seams. No `sales/`/`billing/` code yet.

**Tasks**
- [x] Contract: add `RETURN` and `CLIENT_PAYMENT` to `DocType` (`modules/platform/platform.enums.ts`); extend the `Record<DocType,string>` prefix seed (`settings-defaults.ts`) with `RETURN → 'RET'` and `CLIENT_PAYMENT → 'REG'` — **distinct from existing prefixes** (`FAC`=INVOICE, `FRN`=SUPPLIER, `PAY`=SUPPLIER_PAYMENT; avoid collisions). `DEFAULT_NEXT_SEQUENCES` picks them up automatically (`Object.values(DocType)`). (plan §C-1)
- [x] Catalog: add a read method to `CatalogProductService` (additive, no schema change): `resolvePosPrices(productIds: string[], categoryId: string | null): Promise<{ productId; productName; resolvedPrice? }[]>` — resolves each product's price as `ProductPrice[productId, categoryId]` else `Product.defaultSalePrice`, and returns the `productNameSnapshot` source. **Named `resolvePosPrices` (not `getPosPrices`)** to match the plan §C-2 port name exactly (structural typing needs the name); **`resolvedPrice` is optional**, following the non-throwing `getRepriceCandidates`/`getCostBasis` precedent since `defaultSalePrice` is genuinely nullable — see report. **Consumer-side port interface (`ICatalogPosPricingPort`) is declared in Sprint 2**, matching the `ICatalogPricingPort`-in-`inventory.interface.ts` precedent (provider satisfies it structurally, no `implements`). (plan §C-2, §D-2)
- [x] Test: `catalog.service.spec.ts` — `resolvePosPrices` returns category price when a `ProductPrice` row exists, falls back to `defaultSalePrice` when it doesn't and when `categoryId` is `null`, omits `resolvedPrice` when neither exists, and surfaces `productName`; parses against the documented shape.
- [x] Test: platform sequence/settings specs still green with the two new `DocType` keys (seed exhaustiveness); `SequenceService.nextNumber(tx, DocType.RETURN)` yields `RET-YYYY-0001` and `DocType.CLIENT_PAYMENT` yields `REG-YYYY-0001`.
- [x] Test: contract package conformance/`tsc` green with the added enum values.

**Validation**
- [x] `tsc --noEmit` clean across `contract`, `api`.
- [x] `npm run test:unit` green (catalog + platform + contract conformance — 405/405, 28 files).
- [x] No route/DTO/enum re-declared that already existed — only the two `DocType` values are new (genuinely missing per plan §C-1); `CREDIT_REQUIRES_CLIENT` adds **no** `ErrorCode` (uses `BadRequestError`, §C-5).
- [x] Committed on green (`catalog/contract: sprint 1 — sales+billing prerequisites`).

---

### Sprint 2: Sales — Foundation (mapper, interface, factories)   — Status: ✅ Done

**Goals**
- Pure `sales.mapper.ts`, `ISalesService` + consumer-side `ICatalogPosPricingPort`, factories,
  with mapper unit tests. No service logic.

**Tasks**
- [x] Impl: `src/modules/sales/sales.mapper.ts` — `toSaleDto(sale, ctx, { includeMargins })` (**margin-gated**: omit `totalCost`/`totalProfit` + line `costOfGoods`/`profit` when `includeMargins===false`; surface both `resolvedPrice` and `unitPrice`; `posClientName`/`staffName` from joins; `soldAt` ISO or omitted while DRAFT), `toReceiptDto(sale)` (customer-facing figures only — `total`/`previousCredit`/`grandTotal`/`totalPaid`/`newCredit`, never cost/profit), `toPersistenceDraft(cmd, ctx)` (DRAFT create-input; `productNameSnapshot` per line; money/margin fields defaulted). **Deviation:** `lines` folded into a joined `SaleRow` type (one param) rather than a separate `lines` arg — matches purchasing's `SupplierInvoiceRow` precedent; `DraftMapContext` gained a `reference` placeholder field (`Sale.reference` has no `@default`, unlike what the plan's literal `{staffId; productNames}` assumed) — see report. Each ends `XxxResponseSchema.parse(dto)`; field-listing (never spreads); private `toMoney` (`Decimal→number`); `Date→ISO`; Prisma enum → contract enum cast. Also added comma-join/split `serializeSerials`/`parseSerials` — `SaleLine.serialNumbers` is free-text but the contract wants an array (first module needing this conversion). (plan §I.1)
- [x] Impl: `src/modules/sales/sales.interface.ts` — `ISalesService` (all methods from plan §I.2, returning contract DTOs; `confirm` returns `ReceiptDto` per §D-3; listener-only `recordRepairSale(payload: RepairsEvents['repair.pickedUp'])`) + consumer-side `ICatalogPosPricingPort` (`resolvePosPrices(productIds, categoryId|null)`, matching catalog's Sprint-1 method structurally). Actor threaded as the contract's own `JWTPayload` directly (already carries `type`/`staffId`) rather than a hand-rolled subset. (plan §I.2)
- [x] Impl: factories `test/data/sale-draft.factory.ts` (+ `seedSale` DB helper for later integration sprints), `confirm-sale.factory.ts`, `create-return.factory.ts`, `repair-picked-up.factory.ts` (event payload, not schema-validated). (plan §I.4)
- [x] Test: `test/unit/modules/sales/sales.mapper.spec.ts` (17 tests) — staff mapping omits `costOfGoods`/`profit`/`totalCost`/`totalProfit`, admin keeps them; receipt carries figures but no cost/profit ("staff mapping hides profit"); `Decimal→number`, `soldAt` ISO-or-omitted, override surfaced (`unitPrice≠resolvedPrice`); serialNumbers comma-string↔array both directions; `.parse` never throws on valid input.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (mapper + conformance — 422/422, 29 files).
- [x] Mapper pure/field-listing, excludes margins when gated; returns contract DTOs only.
- [x] Committed on green (`sales: sprint 2 — foundation (mapper, interface, factories)`).

---

### Sprint 3: Sales — Logic (service + listener)   — Status: ✅ Done

**Goals**
- `SalesService implements ISalesService` + `SalesListener`; all §I.3 business logic; emits/handles
  events; unit tests with mock Prisma + fake ports + spy bus.

**Tasks**
- [x] Impl: `src/modules/sales/sales.service.ts` — constructor DI `(prisma, sequence: ISequenceService, inventory: IInventoryService, catalogPricing: ICatalogPosPricingPort)`:
  - `createDraft` — `status=DRAFT`, no stock/money; owner = acting `staffId`. `updateDraft` — DRAFT-only guard (`409`/`ForbiddenError` otherwise) + owner-or-admin.
  - **`confirm`** — one `prisma.$transaction`, idempotent: reload + `status===DRAFT` guard (already-COMPLETED → `409`, §D-5); resolve prices via `catalogPricing.resolvePosPrices(productIds, posClient?.categoryId ?? null)` keeping `resolvedPrice` **and** charged `unitPrice`; per line `inventory.consumeFifo(tx, productId, qty, unitPrice×qty, MovementType.SALE, ref{referenceType:'SALE', referenceId: sale.id, staffId})` → `costOfGoods`/`profit` (stock exhaustion throws → whole tx rolls back, sale stays DRAFT → `409`); totals (`subtotal`/`totalAmount`/`totalCost`/`totalProfit`); credit `newCredit = previousCredit + (totalAmount − paidAmount)`, **underpayment without `posClientId` → `BadRequestError` `'CREDIT_REQUIRES_CLIENT'`** (§C-5) thrown pre-commit (and pre-transaction — fail fast before any catalog/inventory work); `reference = sequence.nextNumber(tx, DocType.SALE)`; `COMPLETED`/`soldAt`; commit → `inventory.flushEvents(tx)` → `eventBus.emit('sale.confirmed', {origin:'POS', …})`; return `ReceiptDto` from the committed snapshot. **Correction:** `MovementType.SALE`, not `SALE_OUT` as the plan text guessed — the contract enum has no `SALE_OUT` member.
  - **`createReturn`** (admin) — per line `quantity ≤ sold − alreadyReturned` (else 400); `restock:true` ⇒ `inventory.returnIn(tx, originalConsumptions, qty, ref{referenceType:'RETURN'})` at consumed cost, `restock:false` ⇒ no movement; `refundAmount` default = charged, reducible; flip `RETURNED`/`PARTIALLY_RETURNED`; `reference = nextNumber(tx, DocType.RETURN)`; commit → flush → emit `return.created` with signed `creditEffect` (**= −refundAmount**, a genuine sign-convention decision — see report). **`originalConsumptions` is reconstructed** from `StockMovement`/`StockMovementConsumption` (no column on `SaleLine` stores it) — see report's "Reconstructing original consumptions".
  - `listStaffSales` (scope `staffId=me`, in the **service**), `listAdminSales` (all sellers, DRAFTs incl.), `getSale(reference, actor)` (owner-or-admin guard; margins per `actor.type`). Price override measured, never written back (BL#4).
- [x] Impl: `src/modules/sales/sales.listener.ts` — injects `ISalesService`, `setup()` subscribes **`repair.pickedUp`** → `recordRepairSale`: create COMPLETED `origin:REPAIR` sale copying repair `totalAmount`/`paidAmount`/`totalCost`/`totalProfit` + `snapshotParts` into `SaleLine`s (**no FIFO re-consumption**), compute `previous/newCredit` from `PosClient`, **emit `sale.confirmed` with `origin:REPAIR`** (clients applies credit; billing skips ⇒ no invoice). **Idempotent by `repairId`** via the `Repair.saleId @unique` latch: create sale then `repair.updateMany({where:{id, saleId:null}, data:{saleId}})` — 0 rows ⇒ roll back. `safeRun` guard (a throw never re-enters `eventBus.emit`). **Genuine gap found and resolved:** the frozen `repair.pickedUp` payload carries no `staffId`, but `Sale.staffId` is `NOT NULL` — resolved by reading the repair's most recent `RepairStatusHistory.staffId`; flagged as a cross-module integration risk to re-verify once the repairs module is built (see report). (plan §I.2)
- [x] Test: `test/unit/modules/sales/sales.service.spec.ts` (22 tests) — exhausted-stock confirm → 409, sale stays DRAFT, **no event**; credit math + receipt figures; underpaid anonymous → `CREDIT_REQUIRES_CLIENT` 400; **double confirm → one `consumeFifo`, one `sale.confirmed`** (second call 409s with no additional calls); return restock calls `returnIn` with the reconstructed at-cost consumption, non-restock doesn't; return qty over sold → 400; `recordRepairSale` core logic + no-FIFO-reconsumption.
- [x] Test: `test/unit/modules/sales/sales.listener.spec.ts` (3 tests) — `repair.pickedUp` → one COMPLETED REPAIR sale + one `sale.confirmed(origin:REPAIR)`, no invoice; **replay ⇒ exactly one sale** (idempotency latch, genuinely tested via two sequential `eventBus.emit` calls); a handler throw is swallowed.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (service + listener + conformance — 447/447, 31 files).
- [x] Events emitted **post-commit**; engine reused via injected `IInventoryService` (no re-implementation); `flushEvents(tx)` called after each `$transaction`; repair listener genuinely idempotent; no cross-module folder import (only `ISequenceService`/`IInventoryService`/`ConsumptionLine` + the locally-declared `ICatalogPosPricingPort`).
- [x] Committed on green (`sales: sprint 3 — logic (service + listener)`).

---

### Sprint 4: Sales — API (controller, routes, wiring, integration)   — Status: ✅ Done

**Goals**
- HTTP surface + composition root + aggregator wiring; integration & conformance green.

**Tasks**
- [x] Impl: `src/modules/sales/sales.controller.ts` — thin (`try/catch → next`, reads `req.validated`, `sendSuccess` `201` create-draft / `200` update/confirm/list/detail/return); arrow-method fields. Reads `req.user!` for `staffId`/`type`; `getSale` serves both `STAFF_DETAIL`/`ADMIN_DETAIL`, margin-gating decided in the service off the same actor. (plan §I.2, rules §4)
- [x] Impl: `src/modules/sales/sales.routes.ts` — composition root: `new SalesService(prisma, sequenceService, inventoryService, catalogProductService)` (catalog satisfies `ICatalogPosPricingPort` structurally, confirmed by a clean `tsc` — direct sibling import, set-05 pattern); `new SalesController(service)`; `new SalesListener(service).setup()`. Routes use `SALE_ROUTES` constants only, per-segment `validateRequest`, guards per plan §I.2 table (`CREATE/UPDATE/CONFIRM → types:[STAFF,ADMIN], pages:[STAFF_POS]`, `STAFF_LIST → types:[STAFF,ADMIN], pages:[STAFF_SALES]`, `STAFF_DETAIL → types:[STAFF,ADMIN]`+service owner-guard, `ADMIN_*`/`RETURN → types:[ADMIN], checkDB`). No route-ordering conflict to resolve (every path is a distinct segment-count or method). (plan §I.2, §D-1)
- [x] Impl: wire into `src/modules/index.ts` — direct sibling import of `salesRouter`; `apiRouter.use(salesRouter)` at the `EXTENSION POINT (modules)`. No aggregator adapter needed. (plan cross-cutting §)
- [x] Test: `test/integration/sales.integration.spec.ts` (real test DB, `ApiResponse` envelope, **7 tests, genuinely run — a real Postgres was reachable in this environment, contrary to prior sprints' note, see report**) — draft create → confirm end-to-end (real FIFO stock drops via a seeded `StockMovement` layer, `sale.confirmed` fires, receipt figures correct); exhausted-stock confirm → 409 + sale stays DRAFT; underpaid anonymous → 400; staff A reads staff B's sale → 403 (both DRAFT and post-confirm), admin OK; `STAFF_LIST` scoped to me; RETURN admin-only (staff holding both pages still → 403) + real restock movement (`quantityOnHand` 7→9, `RETURN_IN` row confirmed).
- [x] Test: `test/contract/routes.conformance.spec.ts` — new `sales route resolution` block, every `SALE_ROUTES` path resolves DB-free (10/10 conformance tests, up from 9).

**Genuine gap found (not blocking, flagged for follow-up):** `SaleResponseSchema.lines[]` has no `id` field — a real admin returns UI has no documented way to discover a `saleLineId`, which `CreateReturnCommand` requires. The integration test's own `createReturn` case can only supply one via a direct `prisma.saleLine` query (test-only). See report.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (unit + conformance — 448/448, 31 files). `npm run test:int` run for real: 98/100 (10 files) — 2 pre-existing purchasing concurrency failures, reproduced identically in isolation, unrelated to this sprint.
- [x] Routes use contract constants only; responses via `sendSuccess` (PDF n/a here); mapper excludes margins when gated.
- [x] Committed on green (`sales: sprint 4 — api and wiring`).

---

### Sprint 5: Billing — Foundation (mapper, interface, factories)   — Status: ✅ Done

**Goals**
- Pure `billing.mapper.ts`, `IBillingService` + local `PdfResult`, factories, mapper unit tests.

**Tasks**
- [x] Impl: `src/modules/billing/billing.mapper.ts` — `toInvoiceDto(invoice, ctx)` (**audience-gated**: `client`/`staff` omit `totalCost`/`totalProfit` + line `costSnapshot`/`profit`/`currentAverageCost`; `admin` keeps them and injects `currentAverageCost` from `ctx.currentAverageCostByLineId`), `toClientPaymentDto(payment)` (`invoiceNumber?` via join, money `Decimal→number`, `paidAt` ISO), `toInvoicePersistence(input: InvoiceIssueInput)` (immutable snapshot create-input, never spreads). Each ends `XxxResponseSchema.parse(dto)`. **Two significant schema gaps found and resolved via ctx (no migration)** — see report: `Invoice` has **no `sourceReference` column at all** (required on every audience, not just admin — resolved live in Sprint 6 by joining `sourceId` → `Sale.reference`/`Order.reference`); `InvoiceLine` has **no `productId`** (no FK path to `Product.averageCost` for `currentAverageCost` — Sprint 6 will correlate by `label`/`quantity`/`unitPrice` back to the source document's own lines). `toInvoicePersistence` takes one normalized `InvoiceIssueInput` (not the plan's literal `(source, event, lines)`) since `sale.confirmed`/`order.confirmed` share too little shape for the mapper to reconcile itself. (plan §II.1)
- [x] Impl: `src/modules/billing/billing.interface.ts` — `IBillingService` (all methods from plan §II.2, returning contract DTOs; PDF getters return the local `PdfResult = { filename; mime:'application/pdf'; body: Buffer }`; listener-only `issueFromSale`/`issueFromOrder`/`applyClientPaymentRecorded` typed off the contract event payloads). `PdfResult` mirrors platform/inventory's `ExportResult` (not a contract DTO — PDFs bypass the envelope, §D-6). (plan §II.2)
- [x] Impl: factories `test/data/create-client-payment.factory.ts` + `test/data/billing-events.factory.ts` (`buildSaleConfirmedEvent`/`buildOrderConfirmedEvent`, plain builders, not schema-validated). (plan §II.4)
- [x] Test: `test/unit/modules/billing/billing.mapper.spec.ts` (12 tests) — client/staff audience strips `costSnapshot`/`profit`/`currentAverageCost`/`totalCost`/`totalProfit`; admin keeps + injects `currentAverageCost` (omitted gracefully when absent from ctx); `sourceReference` always from ctx; `Decimal→number`, `Date→ISO`/date-only, `serialNumbers` passthrough (plain string, no array conversion — unlike sales); `.parse` never throws across all 3 audiences.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (mapper + conformance — 460/460, 32 files).
- [x] Mapper pure/field-listing, audience-gated; returns contract DTOs only.
- [x] Committed on green (`billing: sprint 5 — foundation (mapper, interface, factories)`).

---

### Sprint 6: Billing — Logic (service + listener)   — Status: ✅ Done

**Goals**
- `BillingService implements IBillingService` + `BillingListener`; all §II.3 logic; PDF render;
  emits/handles events; unit tests with mock Prisma + spy bus.

**Tasks**
- [x] Impl: `src/modules/billing/billing.service.ts` — constructor DI `(prisma, sequence: ISequenceService, settings: IStoreSettingsPort)`:
  - **`issueFromSale`** (listener-invoked) — skip `payload.origin===REPAIR`; else read the persisted `Sale`/`SaleLine` rows for `sourceReference` + per-line `costSnapshot`/`profit` the event omits (§C-3), resolve client name/address snapshot, issue via shared `issueInvoice`. **Idempotent** via `Invoice @@unique(sourceType, sourceId)` — P2002 caught **after** the transaction rejects (not inside it), so the sequence bump rolls back atomically with the failed insert.
  - **`issueFromOrder`** (listener-invoked, dormant until orders emits) — `sourceType ORDER`; reads `Order` (no `Sale` touched at all), `totalCost/totalProfit` default 0 (§C-4).
  - **`cancelInvoice`** (admin) — `status → CANCELLED` only, skipped entirely (no re-emit) when already cancelled; sequence counter never touched.
  - **`createClientPayment`** (staff/admin) — locks the `PosClient` row, snapshot `previousCredit`, `newCredit = previous − amount` (**overpayment allowed** ⇒ negative), validates a supplied `invoiceNumber` belongs to the same `posClientId`, persists via `DocType.CLIENT_PAYMENT`, emits `payment.clientRecorded`.
  - Reads: `getMyInvoice` (404 on foreign posClientId), `getStaffInvoice` (403 on non-owner staff), `listAdminInvoices` (filters), `listClientPayments` — all resolve the two Sprint-5-flagged gaps first (see report): `resolveSourceReferences` (batch-joins `sourceId`→`Sale.reference`/`Order.reference`, grouped by `sourceType`) and `resolveCurrentAverageCosts` (admin-only, SALE-origin only — correlates `InvoiceLine`↔`SaleLine` by label/quantity/unitPrice; ORDER-origin left dormant, orders unbuilt).
  - **PDF** — new `@common/utils/pdf.utils.ts` (`renderInvoicePdf`) + real `pdfkit`/`@types/pdfkit` dependencies (installed, network confirmed reachable); reads the store header via a new narrow `IStoreSettingsPort` (platform.routes.ts exports no `platformService` singleton — Sprint 7 constructs a second stateless `PlatformService(prisma)` locally instead of modifying the already-complete platform module).
- [x] Impl: `src/modules/billing/billing.listener.ts` — injects `IBillingService`, `setup()` subscribes `sale.confirmed`→`issueFromSale`, `order.confirmed`→`issueFromOrder`, own `payment.clientRecorded`→`applyClientPaymentRecorded`. `safeRun` guard throughout.
- [x] Test: `test/unit/modules/billing/billing.service.spec.ts` (17 tests) — REPAIR skip (no sequence call); POS issue reads real cost/profit off SaleLine; replay swallowed as no-op; ORDER issue touches no Sale row; cancel status-only + idempotent; payment snapshot math + overpayment + on-account + unknown-invoice 400; ledger-recompute flips status + never revives CANCELLED; 404/403 read scoping; real `%PDF`-prefixed Buffer returned.
- [x] Test: `test/unit/modules/billing/billing.listener.spec.ts` (4 tests) — `sale.confirmed(POS)` → one invoice/one emit; `sale.confirmed(REPAIR)` ignored entirely; `payment.clientRecorded` genuinely idempotent across two real `eventBus.emit` calls; a handler throw is swallowed.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (service + listener + conformance — 481/481, 34 files).
- [x] Events emitted **post-commit**; issue idempotent by `@@unique(sourceType, sourceId)`; invoice `paidAmount` recomputed from the ledger (not incremented); no cross-module folder import (billing reads `Sale`/`Order`/`Client`/`Product` rows via the shared `prisma` singleton — a pure read, §D-4).
- [x] Committed on green (`billing: sprint 6 — logic (service + listener)`).

---

### Sprint 7: Billing — API (controller, routes, wiring, integration)   — Status: ✅ Done

**Goals**
- HTTP surface + composition root + aggregator wiring; integration (incl. end-to-end
  sale→invoice) & conformance green.

**Tasks**
- [x] Impl: `src/modules/billing/billing.controller.ts` — thin; `sendSuccess` (`201` `createClientPayment`, `200` reads/cancel); **PDF handlers stream the `Buffer`** with explicit `Content-Type: application/pdf` + `Content-Disposition` (not `sendSuccess`, §D-6). `createClientPayment` serves both `STAFF_CLIENT_PAYMENTS`/`ADMIN_CLIENT_PAYMENTS`.
- [x] Impl: `src/modules/billing/billing.routes.ts` — composition root: `new BillingService(prisma, sequenceService, settingsPort)` where `settingsPort = new PlatformService(prisma)` (a second, stateless instance — `platform.routes.ts` exports no singleton); `new BillingController(service)`; `new BillingListener(service).setup()`. Routes use `BILLING_ROUTES` constants only, per-segment `validateRequest`, guards per plan §II.2 table. No genuine route-ordering collision exists (every literal-suffix path has a different segment count than its bare-`:number` sibling) — registered specific-suffix-first anyway, matching convention. **Interface refinement:** `getMyInvoices`/`getMyInvoice`/`getMyInvoicePdf` take `clientId` (not `posClientId` — `JWTPayload` never carries the latter directly); the service resolves `Client.posClientId` internally, same precedent as `clients.service.ts`'s own `getMe`. (plan §II.2)
- [x] Impl: wire into `src/modules/index.ts` — direct import of `billingRouter`; `apiRouter.use(billingRouter)`. No listener registration here. `clients`/`observability` dormant handlers wake automatically. (plan cross-cutting §)
- [x] Test: `test/integration/billing.integration.spec.ts` (real test DB, envelope, **9 tests, genuinely run**) — **end-to-end**: POS sale confirm (Sprint 4) → `sale.confirmed` → invoice issued (polled via `waitFor`, `sourceReference` matches the real sale's own reference); **replay ⇒ one invoice** (a real `@@unique` constraint hit); REPAIR-origin sale ⇒ **no invoice** (no Sale row even required); synthetic `order.confirmed` ⇒ ORDER invoice with **zero** Sale rows in the DB; cancel leaves a sequence gap (a second real sale's invoice never reuses the cancelled number); client-payment flips invoice status to PAID; **client A cannot fetch client B's invoice → 404**; staff list issued-by-me; concurrent payments serialize (passed on this run — see report's flakiness note, matches a pre-existing environment pattern also seen in purchasing); PDF endpoint returns real `application/pdf` bytes.
- [x] Test: `test/contract/routes.conformance.spec.ts` — billing guarded routes resolve DB-free (11/11 conformance tests, up from 10); every route uses a `BILLING_ROUTES` constant.

**Validation**
- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green (unit + conformance — 484/484, 34 files). `npm run test:int` run for real: 106/109 (11 files) — 3 pre-existing purchasing concurrency/property failures, reproduced independent of this sprint (re-confirmed in isolation); `billing`'s own 9/9 pass both in isolation and within the full suite.
- [x] Routes use contract constants only; JSON responses via `sendSuccess`, PDFs stream a `Buffer`; mapper excludes cost/profit for client/staff audiences.
- [x] Committed on green (`billing: sprint 7 — api and wiring`).

---

## Definition of done (set 06) — ✅ complete

- **7 sprints** complete; 12 module files (6 sales + 6 billing) created; both routers mounted at
  the `modules/index.ts` extension point with ports injected (direct sibling import, set-05 pattern).
- Prerequisites (Sprint 1) landed before any dependent endpoint: `DocType.RETURN` +
  `DocType.CLIENT_PAYMENT` (+ seed prefixes `RET`/`REG`), catalog `resolvePosPrices` read method.
- Every service method returns a DTO that `.parse`es against its contract schema; every route uses
  a `*_ROUTES` constant; every JSON response goes through `sendSuccess`; PDFs stream a `Buffer`.
- Unit (484/484, 34 files) + integration (106/109, 11 files — see below) + conformance (11/11)
  green, including the plan §I.4/§II.4 scenarios: exhausted-stock confirm → 409 + stays DRAFT,
  credit math + receipt figures, underpaid anonymous → 400 `CREDIT_REQUIRES_CLIENT`,
  double-confirm → one consumption/one event, return restock vs not, `repair.pickedUp` replay ⇒
  one sale + no invoice, staff mapping hides profit; billing `sale.confirmed` replay ⇒ one
  invoice, REPAIR ⇒ none, order invoice without a sale row, sequence gap survives cancel, payment
  flips statuses idempotently, client A cannot read client B's invoice, concurrent payments
  serialize (see Sprint 7 report's flakiness note — matches a pre-existing, environment-level
  `FOR UPDATE`-lock characteristic also seen in purchasing, not a logic defect either module owns).
- **A real Postgres test DB is reachable in this environment** — every integration claim above was
  genuinely executed against it (7 `sales` + 9 `billing` tests), not left as "could not verify."
  The 3 remaining `test:int` failures are all pre-existing purchasing concurrency/property tests,
  unrelated to set 06.
- No `schema.prisma` migration (all models pre-exist); the only contract change is Sprint 1's two
  `DocType` values; `CREDIT_REQUIRES_CLIENT` adds no `ErrorCode`.
- **Genuine gaps discovered and resolved along the way** (none blocked completion): sales'
  repair-pickup listener resolves its required `staffId` from `RepairStatusHistory` (the event
  carries none — Sprint 3); billing's `Invoice.sourceReference`/`InvoiceLine`-to-`Product`
  correlation have no direct schema columns, resolved via live joins/best-effort matching
  (Sprints 5-6); billing's `getMy*` methods take `clientId` not `posClientId` (Sprint 7).
  **One gap flagged, not fixed** (out of scope for this set): `SaleResponseSchema.lines[]` exposes
  no `id`, so a future admin-returns UI has no documented way to discover a `saleLineId`.
