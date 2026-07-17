# Stage 01 · Phase 02 — Contract Sprint Plan

Decomposition of `Docs/Stage-01-Contract/results/plan.md` into dependency-aware sprints for `@dragon-telecom/contract`. **No code in this phase — this is the ordered build sheet.** Module letters (A–L) reference the plan's Part 2.

> **Path note:** the prompt said `/docs/stage-01-contract/sprints.md`; the phase file's Expected Output says `results/sprints.md` and `plan.md` already lives there. Placed at `Docs/Stage-01-Contract/results/sprints.md` for consistency (repo casing).

## Ordering rationale (from plan §3.3)

Hard type edges are few: `common/auth.ts` → `identity.UserType`; `clients.CartItemDto` → `catalog.ProductWithPricingDto`; `inventory.CreateAdjustmentCommand` → `catalog.UpdatePricingCommand`. Every other module depends only on `common/`. Event **listeners** reference emitting modules by documentation, not import (events.ts files stay leaf nodes), so `purchasing`/`sales`/`orders`/`repairs`/`billing`/`statistics`/`observability`/`platform` carry **no cross-module type edges** and can be scheduled in any order after `common`.

Build order: **common → identity (core) → catalog (unblocks clients + inventory) → everything else.** Direction stays `common → identity → catalog → {clients, inventory}` with no back-edges; `madge --circular` must stay clean after every sprint.

Each sprint ends by updating the touched module barrel(s) **and** root `src/index.ts`, and commits on green.

---

### Sprint 0: Common Foundation & Package Setup   — Status: ✅ Complete

**Goals**
- Establish the shared foundation every module imports (envelope, `paginated()`, `ErrorCode`) and rename the package. Nothing else can export safely first (plan Part 1).

**Tasks**
- [ ] Rename the package `@your-app/contract` → `@dragon-telecom/contract` in `package.json` (plan §3.2).
- [ ] Finalize `common/types.ts` — `ApiResponse<T>` union, `PaginationMetaSchema`/`PaginationMeta`, `paginated()` factory, `BooleanQuerySchema`, `PaginatedResult<T>` (plan §1.1; kept as baseline).
- [ ] Finalize `common/errors.ts` — `ErrorCode` = the baseline 8 only, no domain additions (plan §1.2 / C8).
- [ ] Defer `common/auth.ts` to Sprint 1 (it imports `identity.UserType`).
- [ ] Reset root `src/index.ts` to export `common/errors` + `common/types` only; remove the template placeholder module exports (`modules/user`, `modules/auth`, `modules/delivery-company`) so the barrel is clean for the domain modules (plan §3.1 / C3).

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 1: Identity (Core) & JWT Primitive   — Status: ✅ Complete

**Goals**
- Implement the core auth/user/roles/pages/technicians module (plan A) — it supersedes the template `user`/`auth` modules — and complete the shared JWT primitive that depends on its `UserType` enum.

**Tasks**
- [ ] Delete the template scaffolding dirs `modules/user`, `modules/auth`, `modules/delivery-company` (superseded, plan C3).
- [ ] Implement `modules/identity/` per plan A: `identity.enums.ts` (`UserType`, `PageScope`, `AuthType`), `identity.routes.ts` (`IDENTITY_ROUTES`), `identity.command.ts` (`LoginCommand`, `RefreshCommand`, `CreateUserCommand`, `UpdateUserCommand`, `CreateRoleCommand`, `UpdateRoleCommand`, `SetRolePagesCommand`, `CreateTechnicianCommand`, `UpdateTechnicianCommand`), `identity.query.ts` (`UserListQuery`, `PagesQuery`, `UserIdParams`, `RoleIdParams`, `TechnicianIdParams`), `identity.dtos.ts` (`LoginResultDto` — sanctioned raw-token exception, `RefreshResultDto`, `UserDto`, `StaffProfileDto`, `RoleDto`, `PageDto`, `TechnicianDto`), `identity.events.ts` (`auth.loggedIn`, `user.created`, `user.updated`, `user.roleChanged`).
- [ ] Reshape `common/auth.ts` — `JWTPayloadSchema` = `{ sub; type: UserType; clientId?; staffId? }`, `JWTPayload = z.infer<…>` (plan §1.3 / C4).
- [ ] Confirm excluded sensitive fields: `passwordHash`, token hashes/ids, `replacedByTokenId`, `userAgent`, `ipAddress` (plan A).
- [ ] Update `modules/identity/index.ts` and root `src/index.ts` (add `common/auth`, `modules/identity`).

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 2: Catalog   — Status: ✅ Complete

**Goals**
- Implement the taxonomy/products/prices/categories module (plan C). It is the largest module and the only dependency of `clients` and `inventory`, so it ships alone to unblock them.

**Tasks**
- [ ] Implement `modules/catalog/` per plan C: `catalog.enums.ts` (`StockStatus`, `ProductSort`), `catalog.routes.ts` (`CATALOG_ROUTES`), `catalog.command.ts` (`CreateProductCommand` w/ `initialQuantity`/pricing cross-field refines, `UpdateProductCommand`, `UpdatePricingCommand`, brand/family/model create+update, `SetModelFamiliesCommand`, image commands, `CreateClientCategoryCommand`/`UpdateClientCategoryCommand`), `catalog.query.ts` (`ProductListQuery`, `FamiliesQuery`, `ModelsQuery`, `ProductIdParams`, `BrandIdParams`, `FamilyIdParams`, `ModelIdParams`, `CategoryIdParams`), `catalog.dtos.ts` (`ProductWithPricingDto` — public, no cost/exact-qty/reserved/margin; `StaffProductDto` — no cost; `AdminProductDto`; `ProductImageDto`; `ClientCategoryDto`; `BrandDto`; `FamilyDto`; `DeviceModelDto`; `ProductStatsDto`), `catalog.events.ts` (`product.created`, `product.repriced`, `taxonomy.changed`, `clientCategory.changed`, `product.searched`).
- [ ] Enforce the DTO leak boundary: `averageCost` admin-only; storefront exposes boolean `inStock` only (plan C excluded fields).
- [ ] Reconcile `BrandDto`/`FamilyDto`/`DeviceModelDto` display fields against `Docs/Stage-00-Conception/database-description.md` (plan open item 3).
- [ ] Update `modules/catalog/index.ts` and root `src/index.ts`.

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 3: Clients & Inventory   — Status: ⬜ Pending

**Goals**
- Implement the two modules that depend on `catalog` (now available): client/POS identity (plan B) and the FIFO ledger surface (plan D).

**Tasks**
- [ ] Implement `modules/clients/` per plan B: `clients.enums.ts` (`ClientStatus`, `PhoneAvailability`), `clients.routes.ts` (`CLIENT_ROUTES` + `POS_CLIENT_ROUTES`), `clients.command.ts` (`RegisterClientCommand`, `UpdateMeCommand` — no phone, `ChangeMyPasswordCommand`, `ApproveClientCommand`, `RejectClientCommand`, `ResetClientPasswordCommand`, `AdminUpdateClientCommand`, `CreatePosClientCommand`, `UpdatePosClientCommand`, `AddCartItemCommand`), `clients.query.ts` (`AdminClientListQuery`, `PosClientSearchQuery`, `ClientIdParams`, `PosClientIdParams`, `CartItemParams`), `clients.dtos.ts` (`ValidatePhoneResultDto`, `ClientMeDto` — no category/raw-status, `AdminClientDto`, `PosClientDto`, `CartItemDto`), `clients.events.ts` (`client.registered`, `client.approved`, `client.rejected`, `client.passwordReset`, `posClient.creditChanged`).
- [ ] Wire `CartItemDto.product` → `catalog.ProductWithPricingDto` via `import type` (plan §3.3).
- [ ] Implement `modules/inventory/` per plan D: `inventory.enums.ts` (`MovementDirection`, `MovementType`, `AdjustmentReason`), `inventory.routes.ts` (`INVENTORY_ROUTES`), `inventory.command.ts` (`CreateAdjustmentCommand`), `inventory.query.ts` (`StockQuery`, `MovementsQuery`, `ReservationsQuery`), `inventory.dtos.ts` (`StockRowDto`, `MovementDto`, `ReservationDto`, `AdjustmentResultDto`), `inventory.events.ts` (`inventory.stockChanged`, `inventory.lowStock`, `inventory.adjusted`).
- [ ] Wire `CreateAdjustmentCommand.lines[].prices` → `catalog.UpdatePricingCommand` via `import type`; exclude the backend `InventoryService` interface (plan C6).
- [ ] Update `modules/clients/index.ts`, `modules/inventory/index.ts`, and root `src/index.ts`.

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 4: Platform & Purchasing   — Status: ⬜ Pending

**Goals**
- Implement two self-contained modules: platform settings/geography/fees (plan L) and supplier purchasing (plan E).

**Tasks**
- [ ] Implement `modules/platform/` per plan L: `platform.enums.ts` (`DocType`, `FeeSource`), `platform.routes.ts` (`PLATFORM_ROUTES`), `platform.command.ts` (`UpsertFeesCommand`, `UpdateSettingsCommand`), `platform.query.ts` (`FeeQuery`, `FeesExportQuery`), `platform.dtos.ts` (`WilayaDto`, `FeeDto`, `SettingsDto`, `PublicSettingsDto`), `platform.events.ts` (`settings.changed`, `deliveryFees.changed`). Exclude `SequenceService`/`DeliveryFeeService` interfaces (plan C6).
- [ ] Implement `modules/purchasing/` per plan E: `purchasing.enums.ts` (`SupplierInvoiceStatus`), `purchasing.routes.ts` (`PURCHASING_ROUTES`), `purchasing.command.ts` (`CreateSupplierCommand`, `UpdateSupplierCommand`, `CreateSupplierInvoiceCommand` w/ `amountOnly` XOR `lines` refine, `UpdateSupplierInvoiceCommand`, `CancelSupplierInvoiceCommand`, `CreateSupplierPaymentCommand`), `purchasing.query.ts` (`SupplierListQuery`, `SupplierInvoiceListQuery`, `SupplierPaymentListQuery`, `SupplierIdParams`, `SupplierInvoiceIdParams`), `purchasing.dtos.ts` (`SupplierDto`, `SupplierInvoiceDto`, `ConfirmResultDto`, `SupplierPaymentDto`), `purchasing.events.ts` (`supplierInvoice.confirmed`, `supplierInvoice.cancelled`, `payment.supplierRecorded`, `supplier.creditChanged`).
- [ ] Update `modules/platform/index.ts`, `modules/purchasing/index.ts`, and root `src/index.ts`.

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 5: Sales & Orders   — Status: ⬜ Pending

**Goals**
- Implement the two revenue-document modules: POS sales (plan F) and storefront orders (plan G). Both self-contained; margin fields are `.optional()` mapping-gated.

**Tasks**
- [ ] Implement `modules/sales/` per plan F: `sales.enums.ts` (`SaleStatus`, `SaleOrigin`, `ReturnType`), `sales.routes.ts` (`SALE_ROUTES`), `sales.command.ts` (`SaleDraftCommand`, `UpdateSaleDraftCommand`, `ConfirmSaleCommand`, `CreateReturnCommand`), `sales.query.ts` (`SaleListQuery`, `SaleReferenceParams`, `SaleIdParams`), `sales.dtos.ts` (`SaleDto` — `costOfGoods`/`profit`/`totalCost`/`totalProfit` optional, `ReceiptDto`), `sales.events.ts` (`sale.confirmed`, `return.created`; documents listening to `repair.pickedUp`).
- [ ] Implement `modules/orders/` per plan G: `orders.enums.ts` (`OrderStatus`, `OrderType`), `orders.routes.ts` (`ORDER_ROUTES`), `orders.command.ts` (`PlaceOrderCommand` w/ PICKUP/delivery refines, `ConfirmOrderCommand`, `UpdateOrderStatusCommand`, `ReturnOrderCommand`), `orders.query.ts` (`MyOrdersQuery`, `BackofficeOrdersQuery`, `OrderStatsQuery`, `OrderIdParams`), `orders.dtos.ts` (`OrderDto` — inlined wilaya/commune, `costOfGoods`/`profit` optional; `OrderStatsDto`), `orders.events.ts` (`order.confirmed`, `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned`; documents listening to `payment.clientRecorded`).
- [ ] Confirm margin fields are `.optional()` (mapping-gated, plan C9), not schema-stripped; inline wilaya/commune in `OrderDto` to avoid a `platform` cycle (plan G).
- [ ] Update `modules/sales/index.ts`, `modules/orders/index.ts`, and root `src/index.ts`.

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 6: Repairs & Billing   — Status: ⬜ Pending

**Goals**
- Implement back-office repairs (plan H) and the invoice/client-payment module (plan I). Both self-contained; margins `.optional()` mapping-gated.

**Tasks**
- [ ] Implement `modules/repairs/` per plan H: `repairs.enums.ts` (`RepairStatus`, `ReportedIssue`), `repairs.routes.ts` (`REPAIR_ROUTES`), `repairs.command.ts` (`CreateRepairCommand`, `UpdateRepairCommand`, `AddRepairPartCommand`, `RepairStatusCommand`), `repairs.query.ts` (`RepairListQuery`, `RepairIdParams`, `RepairPartParams`), `repairs.dtos.ts` (`RepairDto` — `totalCost`/`totalProfit`/part costs optional), `repairs.events.ts` (`repair.pickedUp`, `repair.statusChanged`, `repair.cancelled`).
- [ ] Implement `modules/billing/` per plan I: `billing.enums.ts` (`InvoiceStatus`, `InvoiceSource`), `billing.routes.ts` (`BILLING_ROUTES`), `billing.command.ts` (`CancelInvoiceCommand`, `CreateClientPaymentCommand`), `billing.query.ts` (`InvoiceListQuery`, `ClientPaymentListQuery`, `InvoiceNumberParams`), `billing.dtos.ts` (`InvoiceDto` — `totalCost`/`totalProfit`/line costs optional, `ClientPaymentDto`), `billing.events.ts` (`invoice.issued`, `invoice.cancelled`, `payment.clientRecorded`; documents listening to `sale.confirmed`/`order.confirmed`).
- [ ] Update `modules/repairs/index.ts`, `modules/billing/index.ts`, and root `src/index.ts`.

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

### Sprint 7: Statistics & Observability   — Status: ⬜ Pending

**Goals**
- Implement the two read-only/sink modules last: statistics dashboards & reports (plan J) and the audit/activity module (plan K). Neither is imported by anything.

**Tasks**
- [ ] Implement `modules/statistics/` per plan J: `statistics.enums.ts` (`ReportType`, `ChartType`, `ReportFormat`), `statistics.routes.ts` (`STATS_ROUTES`), `statistics.query.ts` (`FilteredQuery`, `ChartsQuery`, `ChartParams`, `TopProductsQuery`, `ReportQuery`, `ReportParams`), `statistics.dtos.ts` (`OverviewDto`, `FilteredDto`, `ReportDto` — `rows: Record<string, unknown>[]`, `AdminDashboardDto`, `StaffDashboardDto`). **No `command.ts`, no `events.ts`** (plan §73).
- [ ] Implement `modules/observability/` per plan K: `observability.enums.ts` (`ClientActivityType`), `observability.routes.ts` (`OBS_ROUTES`), `observability.command.ts` (`ClientActivityCommand`, `StaffSearchCommand`), `observability.query.ts` (`ClientActivityQuery`, `StaffSearchesQuery`, `LogsQuery`, `ClientIdParams`), `observability.dtos.ts` (`ClientActivityDto`, `StaffSearchDto`, `AuditLogDto` — `actionType: string` open, `LogStatsDto`). **No `events.ts`** (emits none; only consumes others' events).
- [ ] Update `modules/statistics/index.ts`, `modules/observability/index.ts`, and root `src/index.ts`.
- [ ] Final gate: root `src/index.ts` exports `common/*` + all 12 module barrels; run the full `validate` script (check + cycles + lint + conformance test).

**Validation**
- [ ] `tsc --noEmit` is clean.
- [ ] `madge --circular src` reports no cycles.
- [ ] Lint is clean.
- [ ] Every type is `z.infer`'d from a schema; no `any`; dates are `z.iso.datetime()`.
- [ ] No sensitive field appears in any DTO.
- [ ] No business logic / DB / Express imports.
- [ ] Committed on green.

---

## Sprint summary

| Sprint | Modules | Depends on | Blocks |
|---|---|---|---|
| 0 | `common/` (types, errors) + package rename | — | everything |
| 1 | identity (+ `common/auth`) | common | common/auth JWT |
| 2 | catalog | common | clients, inventory |
| 3 | clients, inventory | catalog | — |
| 4 | platform, purchasing | common | — |
| 5 | sales, orders | common | — |
| 6 | repairs, billing | common | — |
| 7 | statistics, observability | common | — |

8 sprints, each 1–3 modules, ordered so every module ships after the modules it imports from.
