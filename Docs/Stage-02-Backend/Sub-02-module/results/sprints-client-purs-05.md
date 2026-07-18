# Stage 02 · Sub-02 — Clients + Purchasing Module Sprint Plan (set 05)

Decomposes [`plan-client-purch.md`](./plan-client-purch.md) into dependency-ordered sprints.
Order obeys the phase rule **foundation (mapper/interface) → logic (service/listener) → API
(controller/wiring)**, per module, behind one shared **prerequisites** sprint that lands the
cross-module enablers the plan §C/§D-1 flag. **No code in this document.**

Standing rules carried through: contract governs WHICH (nothing re-declared that already exists —
plan §0), rules govern HOW, phase file WHAT/WHEN. Commit style: `git add .` + short
`scope: sprint N — topic`, no `Co-Authored-By`. Commit each sprint **on green**.

---

## Sprint sequence & rationale

| # | Sprint | Layer | Why separate |
|---|---|---|---|
| 1 | Shared prerequisites & contract | enabling | The plan §C/§D-1 gaps touch **other** modules (identity, catalog, platform seed) + the contract package. Landing them first, independently tested, unblocks both modules and keeps the contract build green in one atomic change. Neither `clients/` nor `purchasing/` exists yet. |
| 2 | Clients — Foundation | foundation | Factories, pure mapper, `IClientsService` + consumer-side port interfaces, mapper unit tests. No DB writes. |
| 3 | Clients — Logic | logic | `ClientsService` + `ClientsListener`; web-identity / cart / admin-pipeline / pos-client logic; emits + handles events; service & listener unit tests (mock Prisma + fake ports + spy bus). |
| 4 | Clients — API | api | Controller, `clients.routes.ts` composition root, wiring into `modules/index.ts`, integration + conformance. |
| 5 | Purchasing — Foundation | foundation | Factories, pure mapper, `IPurchasingService` + `ICatalogRepricePort`, mapper unit tests. |
| 6 | Purchasing — Logic | logic | `PurchasingService` + `PurchasingListener`; supplier CRUD, DRAFT/landed-cost, confirm (in-tx engine + credit snapshot), cancel, payments; unit tests. |
| 7 | Purchasing — API | api | Controller, `purchasing.routes.ts`, wiring, integration + conformance + `cache = ledger` property tests. |

**Prisma:** no schema migration — every model (`Client`, `PosClient`, `ClientCart`, `Supplier`,
`SupplierInvoice`, `SupplierInvoiceLine`, `SupplierPayment`) already exists. Sprint 1 changes the
**contract** (`DocType`, one DTO, one schema) and **seed defaults**, not `schema.prisma`.

Cross-module note (reuse, do not re-implement): purchasing's confirm reuses the inventory
injected engine (`addLayer`/`flushEvents`, `MovementRef`, post-commit flush seam) exactly as the
inventory module documented — see the inventory-complete handoff.

---

### Sprint 1: Shared prerequisites & contract   — Status: ✅ Done

**Goals**
- Land the three §C prerequisites and the two §D-1 contract additions so both modules can be
  built against real, tested seams. No `clients/`/`purchasing/` code yet.

**Tasks**
- [x] Contract: add `DocType.SUPPLIER` and `DocType.SUPPLIER_PAYMENT` to `platform.enums.ts`; extend `settings-defaults.ts` `Record<DocType,string>` with `SUPPLIER → 'FRN'`, `SUPPLIER_PAYMENT → 'PAY'` (avoid `SUP`, already `SUPPLIER_INVOICE`). `DEFAULT_NEXT_SEQUENCES` picks them up automatically (`Object.values(DocType)`). (plan §C-2)
- [x] Contract: add the `ClientStatsDto` response schema (`clients.dtos.ts`: `{ totalClients; pending; approved; rejected }`) and a `{ phone }` body schema for `VALIDATE_PHONE` (`clients.command.ts` — e.g. `ValidatePhoneSchema`). Barrel already re-exports the module. (plan §D-1, §I.2)
- [x] Identity: add `provisionClientUser(input:{username; password}, tx: Prisma.TransactionClient): Promise<{ userId: string }>` to `IIdentityService` + `IdentityService` — creates a `type:CLIENT` `User` (no `Staff` row), hashes via the existing Argon2id util, emits **nothing** (caller emits post-commit). `P2002` → `ConflictError`. **`clientId` dropped from the signature** (see report — identity has no use for it; `Client.userId` is set by the caller). (plan §C-1, §I.3-2)
- [x] Identity: **export the service singleton** from `identity.routes.ts` (`export const identityService = service;` — currently exports only `router`) so clients' composition root can inject it. (plan §C-1, §B.2)
- [x] Catalog: add read methods to `CatalogProductService` (additive, no schema change): `getCartProducts(productIds, viewer): Promise<ProductWithPricingDto[]>` (clients cart); `getRepriceCandidates(tx, productIds)` and `getCostBasis(productIds)` (purchasing confirm + DRAFT projection). **Port interfaces deferred to Sprints 2/5** (consumer-side, matching the `ICatalogPricingPort`-in-`inventory.interface.ts` precedent — see report). (plan §C-3, §I.5, §II.5)
- [x] Test: `identity.service.spec.ts` — `provisionClientUser` creates a CLIENT user with no Staff row, hashes the password, emits nothing, `P2002` → `ConflictError`, honours the passed `tx`.
- [x] Test: `catalog.service.spec.ts` — `getCartProducts` returns per-viewer `ProductWithPricingDto[]`; `getRepriceCandidates`/`getCostBasis` return the documented shapes; both parse against their contract fragments.
- [x] Test: platform sequence/settings specs still green with the two new `DocType` keys (seed exhaustiveness); `SequenceService.nextNumber(tx, DocType.SUPPLIER)` yields `FRN-YYYY-0001`.
- [x] Test: contract package conformance/`tsc` green with the added enum values + DTO + schema.

**Validation**
- [x] `tsc --noEmit` clean across `contract`, `api`.
- [x] `npm run test:unit` green (identity + catalog + platform + contract conformance — 300/300, 22 files).
- [x] No route/DTO/enum re-declared that already existed (only the two `DocType` values + `ClientStatsDto` + `ValidatePhoneSchema` are new — all genuinely missing per plan §0/§D-1).
- [x] Committed on green (`identity/catalog/contract: sprint 1 — clients+purchasing prerequisites`).

---

### Sprint 2: Clients — Foundation (mapper, interface, factories)   — Status: ⬜ Pending

**Goals**
- Pure `clients.mapper.ts`, `IClientsService` + consumer-side port interfaces, and the missing
  factories, with mapper unit tests. No service logic.

**Tasks**
- [ ] Impl: `src/modules/clients/clients.mapper.ts` — `toValidatePhoneDto`, `toClientMeDto` (**no `category`, no raw `status`**; money proxied from linked PosClient, `0` if none), `toAdminClientDto` (`fullName`, `wilayaFr`/`communeFr`, `categoryName`, roll-ups), `toPosClientDto`, `toCartItemDto` (assembles `{ productId, addedAt(ISO), product }` — `product` supplied pre-resolved, never rebuilt). Each ends `XxxResponseSchema.parse(dto)`. Field-listing, never spreads; `Decimal→number` helper; `Date→ISO`; Prisma enum → contract enum. (plan §I.1)
- [ ] Impl: `src/modules/clients/clients.interface.ts` — `IClientsService` (all methods from plan §I.2, returning contract DTOs incl. `ClientStatsDto` from Sprint 1); `Viewer` alias reused; consumer-side port interfaces `ICatalogCartPort`, an identity port typing (`provisionClientUser`/`resetPassword`/password-verify), and an observability activity-read port. (plan §I.2, §I.5)
- [ ] Impl: factories `test/data/client-cart.factory.ts` (+ reuse existing `client`, `pos-client`, `client-category`, `client-activity`, `wilaya`, `product`, `product-price` factories). (plan §A)
- [ ] Test: `test/unit/modules/clients/clients.mapper.spec.ts` — field-exclusion (`ClientMeDto` has no `status`/`category`), `Decimal→number`, `Date→ISO`, `PhoneAvailability` lowercase never `ClientStatus`, `.parse` never throws on valid input.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper + conformance).
- [ ] Mapper excludes sensitive fields (lists returned fields, no spread); returns contract DTOs only.
- [ ] Committed on green (`clients: sprint 2 — foundation (mapper, interface, factories)`).

---

### Sprint 3: Clients — Logic (service + listener)   — Status: ⬜ Pending

**Goals**
- `ClientsService implements IClientsService` and `ClientsListener`; all §I.3 business logic;
  emits/handles events; unit tests with mock Prisma + fake ports + spy bus.

**Tasks**
- [ ] Impl: `src/modules/clients/clients.service.ts` — constructor DI `(prisma, identityPort, sequence: ISequenceService, catalogCart: ICatalogCartPort, activityRead)`:
  - phone three-states (`available`/`registered`/`pending`); `register` writes PENDING `Client` (`userId=null`, `code` via `DocType.CLIENT`), re-runs the phone check, duplicate → **status-specific `409`**, emits `client.registered`.
  - `approve` — one tx: `identityPort.provisionClientUser(..., tx)` → set `APPROVED`/`approvedAt`/`approvedByStaffId`/`userId` → commit → emit `client.approved {clientId, posClientSeed}`; only PENDING approvable (`409` else).
  - `resetClientPassword`/`changeMyPassword` via identity (revokes refresh tokens); emit `client.passwordReset`; reject if no `userId`.
  - `updateMe` never writes `phone`; money proxied from PosClient. Cart: `addCartItem` upsert (idempotent), `removeCartItem` idempotent delete, `getCart` resolves via `catalogCart.getCartProducts`.
  - PosClient create/quick-create (`code` via `DocType.POS_CLIENT`, `initialCredit` opening), update, search, list; `recomputePosClientCaches` internal. Emit `posClient.creditChanged` on credit moves. (plan §I.3, §I.6)
- [ ] Impl: `src/modules/clients/clients.listener.ts` — injects `IClientsService`, `setup()` subscribes: `client.approved` (own, post-commit → create linked PosClient + set `Client.posClientId`, **idempotent by `clientId`**), and the dormant `sale.confirmed`/`order.confirmed`/`payment.clientRecorded`/`return.created` handlers (recompute-from-ledger, idempotent by document id). All wrapped in a `safeRun` guard (throws/rejections never reach `eventBus.emit`). (plan §I.4, §D-3, §D-6)
- [ ] Test: `test/unit/modules/clients/clients.service.spec.ts` — phone three states; duplicate register status-specific `409`; approve happy path calls the identity port + emits `client.approved`; approve non-PENDING `409`; reset/change-password revoke tokens; `updateMe` never writes phone; cart upsert/delete idempotent.
- [ ] Test: `test/unit/modules/clients/clients.listener.spec.ts` — `client.approved` replay ⇒ exactly one PosClient; cache handlers apply once per document id; a handler throw is swallowed.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (service + listener + conformance).
- [ ] Events emitted post-commit; listener idempotent; no cross-module folder import (ports only).
- [ ] Committed on green (`clients: sprint 3 — logic (service + listener)`).

---

### Sprint 4: Clients — API (controller, routes, wiring, integration)   — Status: ⬜ Pending

**Goals**
- HTTP surface + composition root + aggregator wiring; integration & conformance green.

**Tasks**
- [ ] Impl: `src/modules/clients/clients.controller.ts` — thin (`try/catch → next`, reads `req.validated`, `sendSuccess` with `201` create / `200` read-update / `204` cart delete); arrow-method fields (no `.bind()`). Reads `req.user` for `clientId`/`staffId`. (plan §B, rules §4)
- [ ] Impl: `src/modules/clients/clients.routes.ts` — composition root: `new ClientsService(prisma, identityService, sequenceService, catalogCartPort, activityPort)`, `new ClientsController(service)`, `new ClientsListener(service).setup()`. Routes use `CLIENT_ROUTES`/`POS_CLIENT_ROUTES` constants only, per-segment `validateRequest`, guards per §B.1. **`POS_CLIENT_ROUTES.SEARCH` uses an OR page-check** (`STAFF_POS` **or** `STAFF_POS_CLIENTS`, ADMIN bypass — §D-2). (plan §B.1)
- [ ] Impl: wire into `src/modules/index.ts` at the EXTENSION POINT — declare the catalog cart adapter + identity/observability port adapters (only the aggregator knows both modules, mirroring `inventoryPortAdapter`), `apiRouter.use(clientsRouter)`. (plan §B.2)
- [ ] Test: `test/integration/clients.integration.spec.ts` (real test DB, `ApiResponse` envelope) — phone/register/me/cart; approve → PosClient materialization (post-commit listener) + `Client.posClientId` set; reset logs client out; `Me PATCH phone → 400`; admin list/detail(+`/activity`)/stats; pos search OR-scope + quick-create; disabled PosClient flag.
- [ ] Test: `test/contract/routes.conformance.spec.ts` — clients routes use constants; responses parse against DTOs; `PosClient.credit == ledger recompute` property.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green; `npm run test:int` green (test DB up).
- [ ] Routes use contract constants only; responses via `sendSuccess`; mapper excludes sensitive fields.
- [ ] Committed on green (`clients: sprint 4 — api and wiring`).

---

### Sprint 5: Purchasing — Foundation (mapper, interface, factories)   — Status: ⬜ Pending

**Goals**
- Pure `purchasing.mapper.ts`, `IPurchasingService` + `ICatalogRepricePort`, factories, mapper tests.

**Tasks**
- [ ] Impl: `src/modules/purchasing/purchasing.mapper.ts` — `toSupplierDto` (`invoiceCount` from `_count`), `toSupplierInvoiceDto` (`invoiceDate`/`dueDate` → **`z.iso.date()`** date-only; `previousCredit?/newCredit?` only when CONFIRMED; `lines[].projectedNewAverageCost?` on DRAFT reads only), `toConfirmResultDto`, `toSupplierPaymentDto`, `toSupplierDetailDto`, `toSupplierStatsDto`. Field-listing; `Decimal→number`; `SupplierInvoiceStatus` passthrough; `.parse` guard. (plan §II.1)
- [ ] Impl: `src/modules/purchasing/purchasing.interface.ts` — `IPurchasingService` (plan §II.2) + `ICatalogRepricePort` (consumer-side typing of `getRepriceCandidates`/`getCostBasis`).
- [ ] Impl: factories `test/data/supplier.factory.ts`, `supplier-invoice.factory.ts` (+ lines), `supplier-payment.factory.ts` (codes/refs = random strings; real allocation is SequenceService's job under test). (plan §A)
- [ ] Test: `test/unit/modules/purchasing/purchasing.mapper.spec.ts` — `Decimal→number`; `@db.Date → date-only`; `projectedNewAverageCost` present only on DRAFT input, absent when CONFIRMED; snapshots present only when CONFIRMED; `.parse` never throws on valid input.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper + conformance).
- [ ] Mapper pure/field-listing; returns contract DTOs only.
- [ ] Committed on green (`purchasing: sprint 5 — foundation (mapper, interface, factories)`).

---

### Sprint 6: Purchasing — Logic (service + listener)   — Status: ⬜ Pending

**Goals**
- `PurchasingService implements IPurchasingService` + `PurchasingListener`; all §II.3 logic;
  confirm reuses the inventory engine in-tx; unit tests.

**Tasks**
- [ ] Impl: `src/modules/purchasing/purchasing.service.ts` — constructor DI `(prisma, sequence: ISequenceService, inventory: IInventoryService, catalogReprice: ICatalogRepricePort)`:
  - supplier CRUD (`code` via `DocType.SUPPLIER`, `initialCredit` opening, `isEnabled` toggle), `supplierStats`, `getSupplier` aggregate.
  - invoice DRAFT create/update (`amountOnly` **XOR** `lines`; DRAFT-only PATCH else `409`; `supplierId` not reassignable); **landed-cost** math + `totalAmount = Σ lineTotal + shippingCost`; `productNameSnapshot` + `projectedNewAverageCost` via `catalogReprice` (DRAFT reads).
  - **confirm** — one tx, supplier `FOR UPDATE` lock: double-confirm no-op / CANCELLED `409`; per line `inventory.addLayer(tx, …, MovementType.SUPPLIER_INVOICE, ref)`; credit snapshot `previous→new`; `reference` via `DocType.SUPPLIER_INVOICE`; `CONFIRMED`; commit → `inventory.flushEvents(tx)` → emit `supplierInvoice.confirmed`; return `repriceCandidates` (post-`addLayer` avg). Zero-line ⇒ credit up, zero movements.
  - cancel (emit `supplierInvoice.cancelled`; **no** automatic stock reversal); payments (snapshot math, on-account, overpayment ⇒ negative credit flagged, `reference` via `DocType.SUPPLIER_PAYMENT`, emit `payment.supplierRecorded`); `recomputeSupplierCaches` internal. (plan §II.3, §II.5)
- [ ] Impl: `src/modules/purchasing/purchasing.listener.ts` — injects `IPurchasingService`, subscribes to its **own** post-commit `supplierInvoice.confirmed`/`.cancelled`/`payment.supplierRecorded`; maintains supplier caches by **recompute-from-ledger** (idempotent by document id); `safeRun` guard. (plan §II.4, §D-3)
- [ ] Test: `test/unit/modules/purchasing/purchasing.service.spec.ts` (mock Prisma + mock `ISequenceService` + **mock the inventory engine** + mock `ICatalogRepricePort` + spy bus) — `amountOnly+lines → 400`; landed-cost vs hand calc; confirm adds one layer per line at landed cost + avg matches hand calc + emits once; **double-confirm no-op**; zero-line confirm ⇒ credit up, zero `addLayer` calls; `PATCH` after confirm `409`; payment snapshot math; overpayment ⇒ negative credit flagged.
- [ ] Test: `test/unit/modules/purchasing/purchasing.listener.spec.ts` — confirmed/cancelled/paymentRecorded update caches; replay is a no-op (`cache = ledger`).

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green (service + listener + conformance).
- [ ] Engine reused via injected `IInventoryService` (no re-implementation); events post-commit; listener idempotent.
- [ ] Committed on green (`purchasing: sprint 6 — logic (service + listener)`).

---

### Sprint 7: Purchasing — API (controller, routes, wiring, integration)   — Status: ⬜ Pending

**Goals**
- HTTP surface + composition root + aggregator wiring; integration, conformance & property tests.

**Tasks**
- [ ] Impl: `src/modules/purchasing/purchasing.controller.ts` — thin; `sendSuccess` (`201` supplier/invoice/payment create, `200` read/update/confirm/cancel); reads `req.validated` + `req.user.staffId`.
- [ ] Impl: `src/modules/purchasing/purchasing.routes.ts` — composition root: `new PurchasingService(prisma, sequenceService, inventoryService, catalogRepricePort)`, controller, `new PurchasingListener(service).setup()`. All routes admin-guarded (`requireAuth({types:[ADMIN], checkDB:true})`), `PURCHASING_ROUTES` constants only, per-segment `validateRequest`. **Register `SUPPLIER_STATS` before `SUPPLIER_BY_ID`** so `stats` isn't captured as `:id`. (plan §B.1)
- [ ] Impl: wire into `src/modules/index.ts` — declare the catalog reprice adapter, import `inventoryService`/`sequenceService`, `apiRouter.use(purchasingRouter)`. (plan §B.2)
- [ ] Test: `test/integration/purchasing.integration.spec.ts` (real DB, envelope) — supplier CRUD; invoice DRAFT → confirm → reprice candidates → payment ledger; cancel; `PATCH`-after-confirm `409`; **concurrency**: two parallel payments serialize (supplier `FOR UPDATE`), two parallel confirms safe/no-op.
- [ ] Test: `test/contract/routes.conformance.spec.ts` — purchasing routes use constants; responses parse against DTOs; **property test** `Supplier.credit == opening + Σ confirmed − Σ payments`.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` green; `npm run test:int` green (test DB up).
- [ ] Routes use contract constants only; responses via `sendSuccess`; mapper excludes sensitive fields.
- [ ] Committed on green (`purchasing: sprint 7 — api and wiring`).

---

## Definition of done (set 05)

- **7 sprints** complete; 12 module files (6 clients + 6 purchasing) created; both routers mounted
  at the `modules/index.ts` extension point with ports injected.
- Prerequisites (Sprint 1) landed before any dependent endpoint: two `DocType` values + seed
  prefixes, identity `provisionClientUser` + exported singleton, catalog read ports, `ClientStatsDto`
  + `ValidatePhoneSchema`.
- Every service method returns a DTO that `.parse`es against its contract schema; every route uses
  a `*_ROUTES` constant; every response goes through `sendSuccess`.
- Unit + integration + conformance green, including the plan §E scenarios: phone three-states,
  approve-atomicity/replay ⇒ one PosClient, reset logs the client out everywhere, `Me PATCH phone
  → 400`, `amountOnly+lines → 400`, confirm one-layer-per-line + avg matches hand calc +
  double-confirm no-op, `PATCH`-after-confirm `409`, concurrent payments serialize, and both
  `cache = ledger` property tests.
