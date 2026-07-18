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

### Sprint 1: Shared prerequisites & contract   — Status: ⬜ Pending

**Goals**
- Land the two §C-1 `DocType` values (+ seed prefixes) and the §C-2 catalog POS-price read
  method so `sales` can be built against real, tested seams. No `sales/`/`billing/` code yet.

**Tasks**
- [ ] Contract: add `RETURN` and `CLIENT_PAYMENT` to `DocType` (`modules/platform/platform.enums.ts`); extend the `Record<DocType,string>` prefix seed (`settings-defaults.ts`) with `RETURN → 'RET'` and `CLIENT_PAYMENT → 'REG'` — **distinct from existing prefixes** (`FAC`=INVOICE, `FRN`=SUPPLIER, `PAY`=SUPPLIER_PAYMENT; avoid collisions). `DEFAULT_NEXT_SEQUENCES` picks them up automatically (`Object.values(DocType)`). (plan §C-1)
- [ ] Catalog: add a read method to `CatalogProductService` (additive, no schema change): `getPosPrices(productIds: string[], categoryId: string | null): Promise<{ productId; productName; resolvedPrice }[]>` — resolves each product's price as `ProductPrice[productId, categoryId]` else `Product.defaultSalePrice` (reusing the existing private `loadPriceMap`), and returns the `productNameSnapshot` source. **Consumer-side port interface (`ICatalogPosPricingPort`) is declared in Sprint 2**, matching the `ICatalogPricingPort`-in-`inventory.interface.ts` precedent (provider satisfies it structurally, no `implements`). (plan §C-2, §D-2)
- [ ] Test: `catalog.service.spec.ts` — `getPosPrices` returns category price when a `ProductPrice` row exists, falls back to `defaultSalePrice` when it doesn't and when `categoryId` is `null`, and surfaces `productName`; parses against the documented shape.
- [ ] Test: platform sequence/settings specs still green with the two new `DocType` keys (seed exhaustiveness); `SequenceService.nextNumber(tx, DocType.RETURN)` yields `RET-YYYY-0001` and `DocType.CLIENT_PAYMENT` yields `REG-YYYY-0001`.
- [ ] Test: contract package conformance/`tsc` green with the added enum values.

**Validation**
- [ ] `tsc --noEmit` clean across `contract`, `api`.
- [ ] `npm run test:unit` green (catalog + platform + contract conformance).
- [ ] No route/DTO/enum re-declared that already existed — only the two `DocType` values are new (genuinely missing per plan §C-1); `CREDIT_REQUIRES_CLIENT` adds **no** `ErrorCode` (uses `BadRequestError`, §C-5).
- [ ] Committed on green (`catalog/contract: sprint 1 — sales+billing prerequisites`).

---

### Sprint 2: Sales — Foundation (mapper, interface, factories)   — Status: ⬜ Pending

**Goals**
- Pure `sales.mapper.ts`, `ISalesService` + consumer-side `ICatalogPosPricingPort`, factories,
  with mapper unit tests. No service logic.

**Tasks**
- [ ] Impl: `src/modules/sales/sales.mapper.ts` — `toSaleDto(sale, lines, ctx, { includeMargins })` (**margin-gated**: omit `totalCost`/`totalProfit` + line `costOfGoods`/`profit` when `includeMargins===false`; surface both `resolvedPrice` and `unitPrice`; `posClientName`/`staffName` from joins; `soldAt` ISO or omitted while DRAFT), `toReceiptDto(sale, lines)` (customer-facing figures only — `total`/`previousCredit`/`grandTotal`/`totalPaid`/`newCredit`, never cost/profit), `toPersistenceDraft(cmd, ctx)` (DRAFT create-input; `productNameSnapshot` per line; money/margin fields defaulted). Each ends `XxxResponseSchema.parse(dto)`; field-listing (never spreads); shared `toMoney` (`Decimal→number`); `Date→ISO`; Prisma enum → contract enum. (plan §I.1)
- [ ] Impl: `src/modules/sales/sales.interface.ts` — `ISalesService` (all methods from plan §I.2, returning contract DTOs; `confirm` returns `ReceiptDto` per §D-3; listener-only `recordRepairSale(payload: RepairsEvents['repair.pickedUp'])`) + consumer-side `ICatalogPosPricingPort` (`resolvePosPrices(productIds, categoryId|null)`, matching catalog's Sprint-1 method structurally). Actor threaded as `{ staffId, type }` for ownership/scoping. (plan §I.2)
- [ ] Impl: factories `test/data/sale-draft.factory.ts`, `confirm-sale.factory.ts`, `create-return.factory.ts`, `repair-picked-up.factory.ts` (event payload) — reuse existing `pos-client`/`product`/`staff` factories. (plan §I.4)
- [ ] Test: `test/unit/modules/sales/sales.mapper.spec.ts` — staff mapping omits `costOfGoods`/`profit`/`totalCost`/`totalProfit`, admin keeps them; receipt carries figures but no cost/profit ("staff mapping hides profit"); `Decimal→number`, `Date→ISO`, override surfaced (`unitPrice≠resolvedPrice`); `.parse` never throws on valid input.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper + conformance).
- [ ] Mapper pure/field-listing, excludes margins when gated; returns contract DTOs only.
- [ ] Committed on green (`sales: sprint 2 — foundation (mapper, interface, factories)`).

---

### Sprint 3: Sales — Logic (service + listener)   — Status: ⬜ Pending

**Goals**
- `SalesService implements ISalesService` + `SalesListener`; all §I.3 business logic; emits/handles
  events; unit tests with mock Prisma + fake ports + spy bus.

**Tasks**
- [ ] Impl: `src/modules/sales/sales.service.ts` — constructor DI `(prisma, sequence: ISequenceService, inventory: IInventoryService, catalogPricing: ICatalogPosPricingPort)`:
  - `createDraft` — `status=DRAFT`, no stock/money; owner = acting `staffId`. `updateDraft` — DRAFT-only guard (`409`/`ForbiddenError` otherwise) + owner-or-admin.
  - **`confirm`** — one `prisma.$transaction`, idempotent: reload + `status===DRAFT` guard (already-COMPLETED → `409`, §D-5); resolve prices via `catalogPricing.resolvePosPrices(productIds, posClient?.categoryId ?? null)` keeping `resolvedPrice` **and** charged `unitPrice`; per line `inventory.consumeFifo(tx, productId, qty, unitPrice×qty, MovementType.SALE_OUT, ref{referenceType:'SALE', referenceId: sale.id, staffId})` → `costOfGoods`/`profit` (stock exhaustion throws → whole tx rolls back, sale stays DRAFT → `409`); totals (`subtotal`/`totalAmount`/`totalCost`/`totalProfit`); credit `newCredit = previousCredit + (totalAmount − paidAmount)`, **underpayment without `posClientId` → `BadRequestError` `'CREDIT_REQUIRES_CLIENT'`** (§C-5) thrown pre-commit; `reference = sequence.nextNumber(tx, DocType.SALE)`; `COMPLETED`/`soldAt`; commit → `inventory.flushEvents(tx)` → `eventBus.emit('sale.confirmed', {origin:'POS', …})`; return `ReceiptDto` from the committed snapshot.
  - **`createReturn`** (admin) — per line `quantity ≤ sold − alreadyReturned` (else 400); `restock:true` ⇒ `inventory.returnIn(tx, originalConsumptions, qty, ref{referenceType:'RETURN'})` at consumed cost, `restock:false` ⇒ no movement; `refundAmount` default = charged, reducible; flip `RETURNED`/`PARTIALLY_RETURNED`; `reference = nextNumber(tx, DocType.RETURN)`; commit → flush → emit `return.created` with signed `creditEffect`.
  - `listStaffSales` (scope `staffId=me`, in the **service**), `listAdminSales` (all sellers, DRAFTs incl.), `getSale(reference, actor)` (owner-or-admin guard; margins per `actor.type`). Price override measured, never written back (BL#4).
- [ ] Impl: `src/modules/sales/sales.listener.ts` — injects `ISalesService`, `setup()` subscribes **`repair.pickedUp`** → `recordRepairSale`: create COMPLETED `origin:REPAIR` sale copying repair `totalAmount`/`paidAmount`/`totalCost`/`totalProfit` + `snapshotParts` into `SaleLine`s (**no FIFO re-consumption**), compute `previous/newCredit` from `PosClient`, **emit `sale.confirmed` with `origin:REPAIR`** (clients applies credit; billing skips ⇒ no invoice). **Idempotent by `repairId`** via the `Repair.saleId @unique` latch: create sale then `repair.updateMany({where:{id, saleId:null}, data:{saleId}})` — 0 rows ⇒ roll back. `safeRun` guard (a throw never re-enters `eventBus.emit`). (plan §I.2)
- [ ] Test: `test/unit/modules/sales/sales.service.spec.ts` — exhausted-stock confirm → 409, sale stays DRAFT, **no event**; credit math + receipt figures; underpaid anonymous → `CREDIT_REQUIRES_CLIENT` 400; **double confirm → one `consumeFifo`, one `sale.confirmed`**; return restock calls `returnIn`, non-restock doesn't; return qty over sold → 400.
- [ ] Test: `test/unit/modules/sales/sales.listener.spec.ts` — `repair.pickedUp` → one COMPLETED REPAIR sale + one `sale.confirmed(origin:REPAIR)`, no invoice; **replay ⇒ exactly one sale** (idempotency latch, genuinely tested); a handler throw is swallowed.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (service + listener + conformance).
- [ ] Events emitted **post-commit**; engine reused via injected `IInventoryService` (no re-implementation); `flushEvents(tx)` called after each `$transaction`; repair listener genuinely idempotent; no cross-module folder import (only `ISequenceService`/`IInventoryService` + the locally-declared `ICatalogPosPricingPort`).
- [ ] Committed on green (`sales: sprint 3 — logic (service + listener)`).

---

### Sprint 4: Sales — API (controller, routes, wiring, integration)   — Status: ⬜ Pending

**Goals**
- HTTP surface + composition root + aggregator wiring; integration & conformance green.

**Tasks**
- [ ] Impl: `src/modules/sales/sales.controller.ts` — thin (`try/catch → next`, reads `req.validated`, `sendSuccess` `201` create-draft / `200` update/confirm/list/detail/return); arrow-method fields. Reads `req.user!` for `staffId`/`type`; passes `includeMargins = req.user!.type === UserType.ADMIN` to `getSale`. (plan §I.2, rules §4)
- [ ] Impl: `src/modules/sales/sales.routes.ts` — composition root: `new SalesService(prisma, sequenceService, inventoryService, catalogProductService)` (catalog satisfies `ICatalogPosPricingPort` structurally — direct sibling import, set-05 pattern); `new SalesController(service)`; `new SalesListener(service).setup()`. Routes use `SALE_ROUTES` constants only, per-segment `validateRequest`, guards per plan §I.2 table (`CREATE/UPDATE/CONFIRM → pages:[STAFF_POS]`, `STAFF_LIST → pages:[STAFF_SALES]`, `STAFF_DETAIL → types:[STAFF,ADMIN]`+service owner-guard, `ADMIN_*`/`RETURN → types:[ADMIN], checkDB`). (plan §I.2, §D-1)
- [ ] Impl: wire into `src/modules/index.ts` — direct sibling import of `salesRouter`; `apiRouter.use(salesRouter)` at the `EXTENSION POINT (modules)`. No aggregator adapter needed (catalog/inventory/platform dependencies are one-directional, like `purchasing.routes.ts`). (plan cross-cutting §)
- [ ] Test: `test/integration/sales.integration.spec.ts` (real test DB, `ApiResponse` envelope) — draft create → confirm end-to-end (stock drops, `sale.confirmed` fires, receipt figures); exhausted-stock confirm → 409 + sale stays DRAFT; underpaid anonymous → 400; staff A reads staff B's sale → 403, admin OK; `STAFF_LIST` scoped to me; DRAFT invisible to non-owner; RETURN admin-only (staff → 403) + restock movement.
- [ ] Test: `test/contract/routes.conformance.spec.ts` — sales guarded routes resolve DB-free; every response parses against `SaleResponseSchema`/`ReceiptResponseSchema`; every route uses a `SALE_ROUTES` constant.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (unit + conformance). Run `npm run test:int` once the route is wired and the test DB is up (note the set-05 environment lacked Docker/Postgres — verify in an environment that has one).
- [ ] Routes use contract constants only; responses via `sendSuccess` (PDF n/a here); mapper excludes margins when gated.
- [ ] Committed on green (`sales: sprint 4 — api and wiring`).

---

### Sprint 5: Billing — Foundation (mapper, interface, factories)   — Status: ⬜ Pending

**Goals**
- Pure `billing.mapper.ts`, `IBillingService` + local `PdfResult`, factories, mapper unit tests.

**Tasks**
- [ ] Impl: `src/modules/billing/billing.mapper.ts` — `toInvoiceDto(invoice, lines, ctx, { audience })` (**audience-gated**: `client`/`staff` omit `totalCost`/`totalProfit` + line `costSnapshot`/`profit`/`currentAverageCost`; `admin` keeps them and fills `currentAverageCost` from the live `Product.averageCost` join; `issuedAt` ISO, `dueDate` date-only; snapshot name/address never re-derived), `toClientPaymentDto(payment, ctx)` (`invoiceNumber?` via join, money `Decimal→number`, `paidAt` ISO), `toInvoicePersistence(source, event, lines)` (immutable snapshot create-input, never spreads). Each ends `XxxResponseSchema.parse(dto)`. (plan §II.1)
- [ ] Impl: `src/modules/billing/billing.interface.ts` — `IBillingService` (all methods from plan §II.2, returning contract DTOs; PDF getters return the local `PdfResult = { filename; mime:'application/pdf'; body: Buffer }`; listener-only `issueFromSale`/`issueFromOrder`/`applyClientPaymentRecorded` typed off the contract event payloads). `PdfResult` mirrors platform/inventory's `ExportResult` (not a contract DTO — PDFs bypass the envelope, §D-6). (plan §II.2)
- [ ] Impl: factories `test/data/create-client-payment.factory.ts` + synthetic `sale.confirmed` / `order.confirmed` event builders (reuse the Sprint-2 sale factories where useful). (plan §II.4)
- [ ] Test: `test/unit/modules/billing/billing.mapper.spec.ts` — client/staff audience strips `costSnapshot`/`profit`/`currentAverageCost`/`totalCost`/`totalProfit`; admin keeps + injects live `currentAverageCost`; `Decimal→number`, `Date→ISO`; `.parse` never throws on valid input.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper + conformance).
- [ ] Mapper pure/field-listing, audience-gated; returns contract DTOs only.
- [ ] Committed on green (`billing: sprint 5 — foundation (mapper, interface, factories)`).

---

### Sprint 6: Billing — Logic (service + listener)   — Status: ⬜ Pending

**Goals**
- `BillingService implements IBillingService` + `BillingListener`; all §II.3 logic; PDF render;
  emits/handles events; unit tests with mock Prisma + spy bus.

**Tasks**
- [ ] Impl: `src/modules/billing/billing.service.ts` — constructor DI `(prisma, sequence: ISequenceService)`:
  - **`issueFromSale`** (listener-invoked) — skip `payload.origin===REPAIR`; else one tx: read the persisted `Sale`/`SaleLine` rows for `sourceReference` + per-line `costSnapshot`/`profit` the event omits (§C-3), snapshot client name/address from `PosClient`, copy previous/new credit from the event, `number = sequence.nextNumber(tx, DocType.INVOICE)` → `FAC-YYYY-NNNN`; commit → emit `invoice.issued`. **Idempotent** via `Invoice @@unique(sourceType, sourceId)` — duplicate insert P2002 swallowed as no-op.
  - **`issueFromOrder`** (listener-invoked, dormant until orders emits) — `sourceType ORDER`; read `Order`/`PosClient` for the thin-payload fields, `totalCost/totalProfit` default 0 (§C-4); same idempotency.
  - **`cancelInvoice`** (admin) — `status → CANCELLED` only; sequence counter never rolled back (gaps survive); emit `invoice.cancelled`.
  - **`createClientPayment`** (staff/admin) — one tx serialized on the `PosClient` row (`FOR UPDATE`): snapshot `previousCredit`, `newCredit = previous − amount`, persist `ClientPayment` (`reference = nextNumber(tx, DocType.CLIENT_PAYMENT)`; `invoiceId` from `invoiceNumber?` — **on-account allowed** when absent; **overpayment allowed** ⇒ negative credit, the negative number is the flag); commit → emit `payment.clientRecorded`.
  - Reads: `getMyInvoices`/`getMyInvoice` (scoped `posClientId` — **404 on foreign**), `listStaffInvoices` (`staffId=me`), `listAdminInvoices` (filters), `listClientPayments` (admin ledger); all via `paginated(schema)`.
  - **PDF** (`get*InvoicePdf`) — render from the invoice snapshot + settings-store header into a `Buffer` `PdfResult`; **never recomputed** from live product/price data. Introduce a small `@common` PDF render util (+ its dependency, e.g. `pdfkit`), MIME/size bounded — infra like the password util, not a 6-file concern (§D-6).
- [ ] Impl: `src/modules/billing/billing.listener.ts` — injects `IBillingService`, `setup()` subscribes: `sale.confirmed` → `issueFromSale` (skip REPAIR), `order.confirmed` → `issueFromOrder`, and its **own** `payment.clientRecorded` → `applyClientPaymentRecorded` (when `invoiceNumber` present, **recompute** `invoice.paidAmount = Σ ClientPayment.amount` and set `status` `ISSUED→PARTIALLY_PAID→PAID` — idempotent by construction, §D-7; on-account = no-op). All wrapped in `safeRun`. (plan §II.2)
- [ ] Test: `test/unit/modules/billing/billing.service.spec.ts` — `sale.confirmed` REPAIR origin → no invoice; `sale.confirmed` replay → one invoice (P2002 swallowed); order path issues with no sale row; cancel changes status only + leaves the sequence gap; `createClientPayment` snapshot math; **overpayment ⇒ negative credit flagged**; on-account (no `invoiceNumber`) persists but updates no invoice.
- [ ] Test: `test/unit/modules/billing/billing.listener.spec.ts` — `payment.clientRecorded` recompute flips `ISSUED→PARTIALLY_PAID→PAID` and is **idempotent on replay** (recompute-from-ledger); REPAIR `sale.confirmed` ignored; a handler throw is swallowed.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (service + listener + conformance).
- [ ] Events emitted **post-commit**; issue idempotent by `@@unique(sourceType, sourceId)`; invoice `paidAmount` recomputed from the ledger (not incremented); no cross-module folder import (billing reads `Sale`/`Order` rows via the shared `prisma` singleton — a pure read, §D-4).
- [ ] Committed on green (`billing: sprint 6 — logic (service + listener)`).

---

### Sprint 7: Billing — API (controller, routes, wiring, integration)   — Status: ⬜ Pending

**Goals**
- HTTP surface + composition root + aggregator wiring; integration (incl. end-to-end
  sale→invoice) & conformance green.

**Tasks**
- [ ] Impl: `src/modules/billing/billing.controller.ts` — thin; `sendSuccess` (`201` `createClientPayment`, `200` reads/cancel); **PDF handlers stream the `Buffer`** with explicit `Content-Type: application/pdf` + `Content-Disposition` (not `sendSuccess`, §D-6). Audience/scoping from the route family + `req.user!` (`posClientId`/`staffId`).
- [ ] Impl: `src/modules/billing/billing.routes.ts` — composition root: `new BillingService(prisma, sequenceService)`; `new BillingController(service)`; `new BillingListener(service).setup()`. Routes use `BILLING_ROUTES` constants only, per-segment `validateRequest`, guards per plan §II.2 table (`MY_* → types:[CLIENT]`, `STAFF_* / STAFF_CLIENT_PAYMENTS → pages:[STAFF_INVOICES]`, `ADMIN_* / CANCEL / ADMIN_CLIENT_PAYMENTS / CLIENT_PAYMENTS_LIST → types:[ADMIN], checkDB`). **Register `/:number/pdf` and `/:number/cancel` literals before the bare `/:number`** so segments aren't captured as a number. (plan §II.2)
- [ ] Impl: wire into `src/modules/index.ts` — direct import of `billingRouter`; `apiRouter.use(billingRouter)`. No listener registration here (each module wires its own in `routes.ts`). `clients`/`observability` dormant handlers wake automatically. (plan cross-cutting §)
- [ ] Test: `test/integration/billing.integration.spec.ts` (real test DB, envelope) — **end-to-end**: POS sale confirm (Sprint 4) → `sale.confirmed` → invoice issued (polled via `waitFor`); **replay ⇒ one invoice**; REPAIR-origin sale ⇒ **no invoice**; synthetic `order.confirmed` ⇒ ORDER invoice with no sale row; cancel leaves a sequence gap; client-payment flips invoice status; **client A cannot fetch client B's invoice → 404**; staff list issued-by-me; concurrent payments serialize (previous→new credit chains without overlap); PDF endpoint returns `application/pdf`.
- [ ] Test: `test/contract/routes.conformance.spec.ts` — billing guarded routes resolve DB-free; responses parse against `InvoiceResponseSchema`/`ClientPaymentResponseSchema` (JSON endpoints; PDFs excluded per §D-6); every route uses a `BILLING_ROUTES` constant.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (unit + conformance). Run `npm run test:int` once the route is wired and the test DB is up (same Docker/Postgres caveat as set 05 — run in an environment that has one before treating this as fully proven).
- [ ] Routes use contract constants only; JSON responses via `sendSuccess`, PDFs stream a `Buffer`; mapper excludes cost/profit for client/staff audiences.
- [ ] Committed on green (`billing: sprint 7 — api and wiring`).

---

## Definition of done (set 06)

- **7 sprints** complete; 12 module files (6 sales + 6 billing) created; both routers mounted at
  the `modules/index.ts` extension point with ports injected (direct sibling import, set-05 pattern).
- Prerequisites (Sprint 1) landed before any dependent endpoint: `DocType.RETURN` +
  `DocType.CLIENT_PAYMENT` (+ seed prefixes `RET`/`REG`), catalog `getPosPrices` read method.
- Every service method returns a DTO that `.parse`es against its contract schema; every route uses
  a `*_ROUTES` constant; every JSON response goes through `sendSuccess`; PDFs stream a `Buffer`.
- Unit + integration + conformance green, including the plan §I.4/§II.4 scenarios: exhausted-stock
  confirm → 409 + stays DRAFT, credit math + receipt figures, underpaid anonymous → 400
  `CREDIT_REQUIRES_CLIENT`, double-confirm → one consumption/one event, return restock vs not,
  `repair.pickedUp` replay ⇒ one sale + no invoice, staff mapping hides profit; billing
  `sale.confirmed` replay ⇒ one invoice, REPAIR ⇒ none, order invoice without a sale row, sequence
  gap survives cancel, payment flips statuses idempotently, client A cannot read client B's invoice,
  concurrent payments serialize.
- No `schema.prisma` migration (all models pre-exist); the only contract change is Sprint 1's two
  `DocType` values; `CREDIT_REQUIRES_CLIENT` adds no `ErrorCode`.
