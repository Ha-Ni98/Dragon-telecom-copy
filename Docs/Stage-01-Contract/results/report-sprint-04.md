# Sprint 4 — Platform & Purchasing

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/platform/`** — new module, 6 content files + barrel (plan L / spec `platform.md`):
  - `platform.enums.ts` — `DocType` (8 document-type values), `FeeSource { COMMUNE='commune', WILAYA='wilaya', DEFAULT='default' }` (lowercase, per spec).
  - `platform.routes.ts` — `PLATFORM_ROUTES` (7 constants).
  - `platform.command.ts` — `UpsertFeesCommand`, `UpdateSettingsCommand` (a nested partial of `SettingsDto` — every section and every leaf field independently optional, for a PATCH that may touch just one value).
  - `platform.query.ts` — `FeeQuery` (`wilayaId` required, `communeId` optional — resolving a fee needs at least the wilaya), `FeesExportQuery` (`excel`/`csv`/`json`, per the spec's explicit list).
  - `platform.dtos.ts` — `WilayaDto`, `FeeDto`, `SettingsDto`, `PublicSettingsDto` (trimmed to `storefront.featuredProductIds` only, per the "featured products only" route note — store/invoicing/delivery stay internal).
  - `platform.events.ts` — `PlatformEvents` map: `settings.changed`, `deliveryFees.changed` (both fully explicit in the spec).
  - `index.ts` barrel.
  - **Excluded from the contract, as planned (C6):** `SequenceService` and `DeliveryFeeService` — both take a transaction handle and describe runtime behaviour; backend concerns.
- **`Apps/contract/src/modules/purchasing/`** — new module, 6 content files + barrel (plan E / spec `purchasing.md`):
  - `purchasing.enums.ts` — `SupplierInvoiceStatus { DRAFT, CONFIRMED, CANCELLED }`.
  - `purchasing.routes.ts` — `PURCHASING_ROUTES` (9 constants; `SUPPLIER_BY_ID` and `SUPPLIER_DETAIL` share a path but different methods/purposes — same pattern as Sprint 2's `CATEGORIES`/`CATEGORIES_CUD`).
  - `purchasing.command.ts` — `CreateSupplierCommand`, `UpdateSupplierCommand`, `CreateSupplierInvoiceCommand` (`amountOnly` XOR `lines` — exactly one required), `UpdateSupplierInvoiceCommand` (same two fields mutually exclusive, but both may be absent on a partial PATCH), `CancelSupplierInvoiceCommand`, `CreateSupplierPaymentCommand`.
  - `purchasing.query.ts` — `SupplierListQuery`, `SupplierInvoiceListQuery`, `SupplierPaymentListQuery`, `SupplierIdParams`, `SupplierInvoiceIdParams`.
  - `purchasing.dtos.ts` — `SupplierDto`, `SupplierInvoiceDto`, `ConfirmResultDto`, `SupplierPaymentDto`, `SupplierDetailDto`, `SupplierStatsDto`.
  - `purchasing.events.ts` — `PurchasingEvents` map: `supplierInvoice.confirmed`, `supplierInvoice.cancelled`, `payment.supplierRecorded`, `supplier.creditChanged`.
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/platform'` and `export * from './modules/purchasing'`.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`CreateSupplierInvoiceCommand`'s `amountOnly`/`lines` refine is exactly-one** (spec Business Logic #1: "`amountOnly` XOR `lines` (400 otherwise)" — both present *and* both absent are rejected). `UpdateSupplierInvoiceCommand` relaxes this to "not both" (a PATCH may legitimately touch neither field while editing others).
2. **`UpdateSupplierCommand` field list is inferred** — no field list given beyond the route's PATCH mention; mirrors `CreateSupplierCommand` minus `initialCredit` (ledger-derived thereafter), plus the universal `isEnabled` toggle.
3. **`SupplierDetailDto` and `SupplierStatsDto` are minimally inferred aggregates.** `SUPPLIER_DETAIL`'s route note ("aggregate: invoices, payments, product history") names three sections with no field list, and `SUPPLIER_STATS` has no description at all beyond its name. Modelled `SupplierDetailDto` from the three named sections plus the supplier itself; `SupplierStatsDto` mirrors Sprint 2's `ProductStatsDto` shape (count + credit/invoiced roll-ups). Both flagged for confirmation once the backend/frontend stages define the actual dashboard needs.
4. **`ConfirmResultDto.repriceCandidates[].current.categoryPrices` is inlined, not imported from catalog.** The spec's shape matches catalog's `categoryId`/`categoryName`/`price` pattern, but the plan documents no `purchasing → catalog` dependency edge (unlike `clients`/`inventory`), so the shape is duplicated inline rather than introducing a new cross-module edge not called for in the plan.
5. **Two of four `purchasing.*` event payloads inferred** (`supplierInvoice.cancelled`, `supplier.creditChanged`) — same pattern as prior sprints; `supplier.creditChanged` mirrors `clients`' `posClient.creditChanged` shape for consistency across the two "credit ledger" event families.
6. **`UpdateSettingsCommand`/`SettingsDto.invoicing.nextSequences`** uses `z.record(z.enum(DocType), z.number().int().min(0))` — confirmed this Zod 4 record-with-enum-key form compiles cleanly (`tsc` green), matching rules §3.7's Zod 4 guidance.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (47 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged — no new tests added, out of scope) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `lastDeliveryAt`/`paidAt` use `z.iso.datetime()`; `invoiceDate`/`dueDate`/`from`/`to` use `z.iso.date()` (day-level, matching Sprint 3's `MovementsQuery` precedent) |
| No sensitive field in any DTO | ✅ — grep for `password`/`passwordHash`/`tokenHash` across both modules' DTOs returns no matches (neither module touches identity/credentials) |
| No business logic / DB / Express imports | ✅ — `SequenceService`/`DeliveryFeeService` correctly excluded |
| 6-file-max per module | ✅ — both modules: 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 4 — platform & purchasing`.
