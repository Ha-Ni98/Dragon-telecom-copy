# Stage 01 · Phase 01 — Contract Architecture Plan

**Package:** `@dragon-telecom/contract` (rename target; the scaffold currently ships as `@your-app/contract`).
**Role:** Contract Architect — strict shared TypeScript types, Zod schemas, and route constants. **No business logic, no DB/Prisma, no backend frameworks.** Pure TypeScript + Zod 4.
**Status:** blueprint only. **No code is written in this phase.**

## Inputs consumed

| Input | Role here |
|---|---|
| `Docs/Stage-01-Contract/contract-rules.md` | HOW — structure, naming, conventions (governs) |
| `Docs/Stage-01-Contract/stage-01-phase-01-plan.md` | WHAT/WHEN — this phase |
| `Docs/Stage-00-Conception/Module-Contracts/*.md` (12 files) | WHICH — routes, inputs, outputs, events per module |
| `Docs/Stage-00-Conception/schema.prisma` (936-line Dragon Telecom "Final") | Database source of truth (sensitive-field cross-check) |
| `Docs/Stage-00-Conception/error-codes.md` | The `ErrorCode` registry |
| `Apps/contract/src/**` | Existing baseline scaffold + `delivery-company` reference shape |

---

## 0. Precedence & Conflict Log (per `contract-rules.md` §0)

No **WHICH conflict** (a spec demanding a rules-forbidden field) was found — see the Security Check in §1 below. Every item here is a **HOW conflict or pointer ambiguity**, resolved in favour of the rules file / baseline and recorded as instructed. **None of these block the phase.**

> **User-confirmed (2026-07-17):** every existing file under `Apps/contract` and `Apps/api` is *template example only*; the **sole source of truth is `Docs/Stage-00-Conception/`**. This ratifies C1 and C3 below — they are decisions, not assumptions.

| # | Tension | Resolution (rules/baseline win) |
|---|---|---|
| C1 | **Schema pointer.** The prompt names `Apps/api/prisma/schema.prisma`, but that file is the *template baseline* (`User`/`RefreshToken`/`DeliveryCompany`, `UserRole = ADMIN\|USER`). It does **not** describe the Dragon Telecom domain the 12 specs cover. | Treated `Docs/Stage-00-Conception/schema.prisma` (header: *"Source of truth for persisted data"*, and the only schema matching the specs) as the database source of truth. The phase file says the data source is "prisma.schema (the database source of truth)"; this is it. `Apps/api/prisma/schema.prisma` is stale template scaffolding to be replaced in Stage 02. |
| C2 | **Output path.** Phase file §Step 3 says `/docs/stage-01-contract/plan.md`; the prompt (and Expected Output) says `/docs/stage-01-contract/results/plan.md`. | Prompt wins (explicit trigger + "Output only …"). Written to `Docs/Stage-01-Contract/results/plan.md`, matching the existing repo casing (`Docs/Stage-01-Contract/…`). |
| C3 | **Baseline `user` / `auth` / `delivery-company` modules.** The phase says "do not re-plan the baseline" and use `delivery-company` as the reference *shape*. But the domain has no `DeliveryCompany` entity (only a free-text `Order.deliveryCompany` string), and `identity` **supersedes** the placeholder `user` + `auth` modules (`UserRole ADMIN\|USER` → `UserType ADMIN\|STAFF\|CLIENT`; JWT reshaped — see C4). | Kept `common/` (envelope, `paginated()`, `ErrorCode`, JWT primitive) as the reusable baseline and used `delivery-company`'s **file layout** as the per-module pattern. Flagged that the placeholder `user`, `auth`, `delivery-company` modules are template scaffolding **superseded** by the domain modules; their planning is captured under `identity` (§Part 2 · A). Not re-planned as standalone modules. |
| C4 | **JWT shape.** Baseline `common/auth.ts` = `{ id, role: UserRole }`. `identity` spec's `JwtPayload = { sub: userId; type: 'CLIENT'\|'STAFF'\|'ADMIN'; clientId?; staffId? }`, explicitly tagged "contract common/". | Fields follow the spec (WHICH); naming/derivation follow the rules (`JWTPayloadSchema` → `z.infer` → `JWTPayload`, stays in `common/auth.ts`). The baseline `common/auth.ts` is **reshaped**, not added-to. Recorded as a baseline evolution. |
| C5 | **Pagination type name.** Specs say "Lists use `PaginationInfo`"; rules/baseline define `PaginationMeta` + `paginated()`. | Rules/baseline win: `PaginationMeta` + `paginated()`. `PaginationInfo` is treated as a spec synonym for the same shape. |
| C6 | **Injected service interfaces** (`InventoryService`, `SequenceService`, `DeliveryFeeService`) are tagged `[CONTRACT]` in `inventory.md` / `platform.md`. | **Excluded from the contract.** Their signatures take a DB transaction handle (`tx`) and describe runtime behaviour (FIFO drain, sequence issuance) — that would require a Prisma import and encodes logic, violating rules §Hard-Constraint and §6.1. They belong to the **backend** stage. Only their **event payloads and DTOs** live in the contract. |
| C7 | **Route path style.** Specs list absolute API paths (`/api/auth/login`, `/api/admin/users/:id`); rules §5.B show relative values under a single `BASE`. Domain modules span several prefixes (`/api/auth`, `/api/me`, `/api/admin/…`, `/api/staff/…`), so one `BASE` per module does not fit. | Rules' binding intent — **"no magic strings"** (§3.4) — is honoured: every path is a constant with an UPPERCASE key, `as const`. The single-`BASE` template is relaxed for multi-prefix modules; constants hold their full path segment. Recorded as a HOW relaxation. |
| C8 | **`ErrorCode` additions.** Specs reference conditions like `INSUFFICIENT_STOCK`, `CREDIT_REQUIRES_CLIENT`, `GUEST_PRICE_HIDDEN`, `PRICING_REQUIRES_STOCK`, `CATEGORY_IN_USE`, `SEQUENCE_DECREASE_FORBIDDEN`, `LAST_ADMIN_PROTECTED`, `CATEGORY_IN_USE`. | `error-codes.md` (the authoritative registry) fixes `ErrorCode` at the **baseline 8** and states domain specifics surface via `message`/`details`, not new enum members. The baseline `errors.ts` already matches. **No `ErrorCode` changes** — these strings are error *messages/identifiers*, resolved to `VALIDATION_ERROR` (400) or `RESOURCE_CONFLICT` (409). |
| C9 | **Margin/cost fields in DTOs** (`costOfGoods`, `profit`, `totalCost`, `totalProfit`, `averageCost`, `costSnapshot`). | Not password-class secrets — they are business-sensitive figures gated by **mapping** (admin-only; staff/client mappers strip them). Modelled as `.optional()` on the response schema; the exclusion is enforced at backend mapping time, not by omission from the schema. This matches the specs' "admin mapping only" notes and rules §5 (build DTO field-by-field). Public/storefront DTOs omit them entirely. |

---

## Part 1 — Common & Global (`src/common/`)

The baseline `common/` already exists and is largely correct. This part records what **stays**, what is **reshaped**, and the global vocabulary every module reuses.

### 1.1 `common/types.ts` — **keep as-is**
- `ApiResponse<T = null>` — discriminated union on `success` (type-only, sanctioned exception). Every spec's `sendSuccess`/`ApiResponse<T>` maps here.
- `PaginationMetaSchema` / `PaginationMeta` — the `PaginationInfo` every list spec refers to (C5).
- `paginated(item)` factory — every list DTO below is expressed as `paginated(XDto)`.
- `BooleanQuerySchema` — reused by every `?flag=true|false` query param (e.g. `inStock`, `lowStockOnly`, `featured`, `withCount`).
- `PaginatedResult<T>` type.

### 1.2 `common/errors.ts` — **keep as-is** (C8)
`ErrorCode` = the baseline 8: `AUTH_INVALID_CREDENTIALS`, `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `RATE_LIMITED`, `INTERNAL_SERVER_ERROR`. No domain additions.

### 1.3 `common/auth.ts` — **reshape** (C4)
`JWTPayloadSchema` → `{ sub: uuid; type: UserType; clientId?: uuid; staffId?: uuid }`; `JWTPayload = z.infer<…>`. Imports `UserType` from `modules/identity/identity.enums`. This is the single decoded-JWT primitive shared by the backend guard and the frontend; it stays in `common/` (not a feature module).

### 1.4 Global vocabulary (applied everywhere)
- **Naming:** writes → `Create/Update[X]Command` (+ `…Schema`); reads → `[X]Query` / `[Route]ParamsSchema`; outputs → `[X]Dto` (+ `[X]ResponseSchema`); routes → `[MODULE]_ROUTES` UPPERCASE keys `as const`.
- **Dates:** `z.iso.datetime()` (ISO strings) in every DTO — never `z.date()`. Schema `DateTime`/`@db.Date` columns all cross the wire as strings.
- **Money:** DZD decimals modelled as `z.number()` in the contract (JSON has no Decimal); precision/`Decimal(12,2)` is a backend concern. Cash-only — **no payment-method field anywhere**.
- **IDs:** `z.uuid()`.
- **Optionality:** notes, reasons, `email`, and every nullable schema column are `.optional()` (and `.nullable()` where the DTO surfaces an explicit `null`).
- **No delete:** no `DELETE`-to-remove commands; state toggles via `isEnabled` PATCH (cart is the only `DELETE`, and it removes a favourite, not an entity).
- **Types derive from schemas** (`z.infer`), no `any`, no magic strings.

---

## Part 2 — Module Blueprints

12 domain modules under `src/modules/`. Each entry lists the files to create per rules §2/§73 (a file exists **only if the module needs it**; `routes.ts`, `dtos.ts`, `index.ts` are effectively always present). Field lists are the contract surface distilled from each spec's API-Interface/Validation/Output/Events sections only (backend logic ignored per rules §1).

Cross-module DTO reuse is called out under **Deps**; barrels must avoid cycles (validation §6.8, `madge --circular`). Where a module needs another's DTO, prefer `import type` to keep the dependency type-only.

---

### A. `identity` — sessions, users, roles, pages, technicians
*Source: `identity.md` (+ supersedes baseline `user` / `auth`, C3).*

- **Routes (`IDENTITY_ROUTES`):** `LOGIN`, `REFRESH`, `LOGOUT`, `ME_PERMISSIONS`, `USERS`, `USER_BY_ID`, `ROLES`, `ROLE_BY_ID`, `ROLE_PAGES`, `PAGES`, `TECHNICIANS`, `TECHNICIAN_BY_ID`.
- **Enums (`identity.enums.ts`):** `UserType { ADMIN, STAFF, CLIENT }`, `PageScope { ADMIN, STAFF }`, `AuthType { CLIENT, STAFF, ADMIN }` (login-result discriminator). *`UserType` mirrors schema enum `UserType`; note the schema also holds legacy `UserRole ADMIN\|USER` only in the stale api template — not used.*
- **Commands (`identity.command.ts`):** `LoginCommand { username; password }`, `RefreshCommand { refreshToken }`, `CreateUserCommand { username; email?; password; type: ADMIN\|STAFF; profile { firstName; lastName; phone?; jobTitle? }; roleIds?: uuid[] }` (roleIds required-non-empty iff STAFF, forbidden iff ADMIN — cross-field refine), `UpdateUserCommand { isEnabled?; roleIds?; profile?; password? }`, `CreateRoleCommand { code; name; description? }`, `UpdateRoleCommand { name?; description?; isEnabled? }`, `SetRolePagesCommand { pageKeys: string[] }` (STAFF-scope keys only — refine), `CreateTechnicianCommand { name; phone? }`, `UpdateTechnicianCommand { name?; phone?; isEnabled? }`.
- **Queries / Params (`identity.query.ts`):** `UserListQuery { type?; isEnabled?; search?; page?; limit? }`, `PagesQuery { scope? }`, `UserIdParams`, `RoleIdParams`, `TechnicianIdParams` (each `{ id: uuid }`).
- **DTOs (`identity.dtos.ts`):** `LoginResultDto { authType: AuthType; accessToken; refreshToken; profile }` (**sanctioned raw-token exception**, §0.1.3), `RefreshResultDto { accessToken; refreshToken }`, `UserDto { id; username; email?; type; isEnabled; lastLoginAt?; profile: StaffProfileDto; roles: RoleDto[]; effectivePages: string[] }`, `StaffProfileDto { firstName; lastName; phone?; jobTitle? }`, `RoleDto { id; code; name; description?; isEnabled; pageKeys: string[] }`, `PageDto { key; label; group; scope: PageScope }`, `TechnicianDto { id; name; phone?; isEnabled }`.
- **Events (`identity.events.ts`):** `auth.loggedIn { userId; authType; ipAddress? }`, `user.created`, `user.updated`, `user.roleChanged`. (Listens: none — client creation/reset is an injected-service call, C6.)
- **Excluded sensitive fields:** `passwordHash`, `RefreshToken.tokenHash`, token ids, `replacedByTokenId`, `userAgent`, `ipAddress` (except the audit event's optional `ipAddress`). Login/refresh raw tokens are the only secrets returned, to their owner.
- **Files:** enums, routes, command, query, dtos, events, index.

### B. `clients` — web clients + POS commercial identity
*Source: `clients.md`.*

- **Routes:** `CLIENT_ROUTES` = `VALIDATE_PHONE`, `REGISTER`, `ME`, `ME_PASSWORD`, `CART`, `CART_ITEM`, `ADMIN_LIST`, `ADMIN_STATS`, `ADMIN_DETAIL`, `APPROVE`, `REJECT`, `RESET_PASSWORD`, `ADMIN_UPDATE`; `POS_CLIENT_ROUTES` = `SEARCH`, `QUICK_CREATE`, `ADMIN`, `ADMIN_BY_ID`. *(Two route consts in one module.)*
- **Enums (`clients.enums.ts`):** `ClientStatus { PENDING, APPROVED, REJECTED }`; `PhoneAvailability { available, registered, pending }` (validate-phone result).
- **Commands:** `RegisterClientCommand { firstName; lastName; phone; email?; storeName?; wilayaId; communeId }`, `UpdateMeCommand { email?; storeName?; wilayaId?; communeId?; address? }` (phone **not** present — read-only), `ChangeMyPasswordCommand { … }`, `ApproveClientCommand { username; password; categoryId }`, `RejectClientCommand { reason? }`, `ResetClientPasswordCommand { newPassword: string.min(6) }`, `AdminUpdateClientCommand { email?; storeName?; address?; isEnabled? }`, `CreatePosClientCommand { name; phone?; categoryId?; initialCredit? }`, `UpdatePosClientCommand { name?; phone?; categoryId?; isEnabled? }`, `AddCartItemCommand { productId }`.
- **Queries / Params:** `AdminClientListQuery { search?; status?; isEnabled?; page?; limit? }`, `PosClientSearchQuery { q }`, `ClientIdParams`, `PosClientIdParams`, `CartItemParams { productId }`.
- **DTOs:** `ValidatePhoneResultDto { isValid; status: PhoneAvailability }`, `ClientMeDto { id; firstName; lastName; phone; email?; storeName?; wilayaId; communeId; address?; createdAt; credit; totalPaid; totalSold }` (**no category, no raw status**), `AdminClientDto { id; code; fullName; storeName?; username?; phone; email?; wilayaFr; communeFr; categoryName?; status; isEnabled; totalOrders; totalSpent; lastOrderDate?; posClientId? }`, `PosClientDto { id; code; name; phone?; categoryId?; categoryName?; credit; totalPaid; totalSold; linkedClientId?; isEnabled }`, `CartItemDto { productId; addedAt; product: ProductWithPricingDto }`.
- **Events:** `client.registered`, `client.approved { clientId; posClientSeed { name; phone; categoryId } }`, `client.rejected`, `client.passwordReset`, `posClient.creditChanged { posClientId; previousCredit; newCredit; cause }`. (Listens: `sale.confirmed`, `order.confirmed`, `payment.clientRecorded`, `return.created`, own `client.approved` — payloads owned by the emitting modules; documented, not redefined.)
- **Deps:** `CartItemDto.product` → `catalog.ProductWithPricingDto` (`import type`).
- **Excluded sensitive fields:** `passwordHash` (via `User`), `rejectionReason` from client-facing `ClientMeDto` (admin-only), internal `approvedByStaffId`.
- **Files:** enums, routes, command, query, dtos, events, index.

### C. `catalog` — taxonomy, products, images, prices, client-categories
*Source: `catalog.md`.*

- **Routes (`CATALOG_ROUTES`):** `BRANDS`, `FAMILIES`, `MODELS`, `PRODUCTS`, `PRODUCT_DETAIL`, `STAFF_PRODUCTS`, `ADMIN_PRODUCTS`, `ADMIN_PRODUCT_BY_ID`, `PRICING`, `IMAGES`, `PRODUCT_STATS`, `ADMIN_BRANDS`, `ADMIN_FAMILIES`, `ADMIN_MODELS` (+ `_BY_ID`), `MODEL_FAMILIES`, `CATEGORIES`, `CATEGORIES_CUD`, `CATEGORY_BY_ID`.
- **Enums (`catalog.enums.ts`):** `StockStatus { in_stock, low_stock, out_of_stock }`; `ProductSort` (list `sort?` options).
- **Commands:** `CreateProductCommand { barcode?; name; description?; familyId|newFamilyName; brandId|newBrandName; modelId?|newModelName?; initialQuantity: int.min(0); initialUnitCost?; guestPrice?; defaultSalePrice?; categoryPrices?: { categoryId; price }[]; reorderThreshold? }` (pricing fields allowed iff `initialQuantity>0`; `initialUnitCost` required iff `initialQuantity>0` — cross-field refines), `UpdateProductCommand { … }`, `UpdatePricingCommand { guestPrice?: number|null; defaultSalePrice?; categoryPrices?: { categoryId; price }[] }`, `CreateBrandCommand { name; logoUrl? }` / `UpdateBrandCommand`, `CreateFamilyCommand { name; parentId?; iconUrl?; isFeatured? }` / `UpdateFamilyCommand`, `CreateModelCommand { brandId; name }` / `UpdateModelCommand`, `SetModelFamiliesCommand { familyIds: uuid[] }`, `AddProductImagesCommand` / `UpdateProductImagesCommand { … position/isPrimary }`, `CreateClientCategoryCommand { name }` / `UpdateClientCategoryCommand { name }` (**name only**).
- **Queries / Params:** `ProductListQuery { search?; familyId?; brandId?; modelId?; inStock?; featured?; sort?; page?; limit=15 }`, `FamiliesQuery { featured?; limit?; withCount? }`, `ModelsQuery { brandId? }`, `ProductIdParams`, `BrandIdParams`, `FamilyIdParams`, `ModelIdParams`, `CategoryIdParams`.
- **DTOs:** `ProductWithPricingDto { id; name; description?; barcode?; createdAt; brand { id; name }; model? { id; name }; family { id; name; iconUrl? }; images: ProductImageDto[]; currentPrice?; guestPrice?; priceHidden: boolean; inStock: boolean; inCart: boolean }` (**public — no cost, no exact qty, no reserved, no margin**), `StaffProductDto { id; name; barcode?; family; brand; model?; availableQuantity; defaultSalePrice?; categoryPrices: { categoryId; categoryName; price }[] }` (no cost), `AdminProductDto { …core; quantityOnHand; quantityReserved; availableQuantity; averageCost; reorderThreshold; stockStatus: StockStatus; isPublished; isEnabled }`, `ProductImageDto { id; url; alt?; position; isPrimary }`, `ClientCategoryDto { id; name; isEnabled; memberCount; pricedProductCount }`, `BrandDto { id; name; slug; logoUrl?; isEnabled }`, `FamilyDto { id; name; slug; iconUrl?; parentId?; isFeatured; isEnabled }`, `DeviceModelDto { id; name; slug; brandId; familyIds: uuid[]; isEnabled }`, `ProductStatsDto { total; inStock; lowStock; outOfStock }`.
- **Events:** `product.created`, `product.repriced`, `taxonomy.changed`, `clientCategory.changed`, `product.searched { userId; query; matchedProductId? }`. (Listens: none; `InventoryService.addLayer` is an injected-service call, C6.)
- **Excluded sensitive fields:** `averageCost` from public + staff DTOs (admin only); `quantityOnHand`/`quantityReserved` from storefront (boolean `inStock` only).
- **Files:** enums, routes, command, query, dtos, events, index.

### D. `inventory` — FIFO ledger, movements, adjustments
*Source: `inventory.md`. Owns `Product.quantityOnHand/quantityReserved/averageCost`.*

- **Routes (`INVENTORY_ROUTES`):** `STOCK`, `MOVEMENTS`, `RESERVATIONS`, `ADJUSTMENTS`.
- **Enums (`inventory.enums.ts`):** `MovementDirection { IN, OUT, PENDING }`, `MovementType { SUPPLIER_INVOICE, INITIAL_STOCK, ADJUSTMENT_IN, RETURN_IN, SALE, ORDER_OUT, REPAIR_CONSUMPTION, ADJUSTMENT_OUT, PENDING_ORDER, PENDING_REPAIR, PENDING_RELEASE }`, `AdjustmentReason { COUNT, DAMAGE, LOSS, CORRECTION }`.
- **Commands:** `CreateAdjustmentCommand { reason: AdjustmentReason; note?; lines: { productId; countedQuantity; unitCost?; prices?: UpdatePricingCommand }[] }`.
- **Queries / Params:** `StockQuery { lowStockOnly?; export? }`, `MovementsQuery { productId?; type?; from?; to?; staffId?; page?; limit? }`, `ReservationsQuery { … }`.
- **DTOs:** `StockRowDto { productId; name; barcode?; quantityOnHand; quantityReserved; availableQuantity; averageCost; stockValue; reorderThreshold; isLow }`, `MovementDto { id; productId; productName; direction: MovementDirection; type: MovementType; quantity; unitCost?; remainingQuantity?; costOfGoods?; profit?; balanceAfter; referenceType; referenceId; referenceLabel; reason?; staffName; createdAt }`, `ReservationDto { productId; productName; quantity; holderType: 'ORDER'|'REPAIR'; holderReference; ageHours }`, `AdjustmentResultDto { reference; lines: { productId; delta; movementId }[] }`.
- **Events:** `inventory.stockChanged { productId; onHand; reserved }`, `inventory.lowStock { productId; available; threshold }`, `inventory.adjusted { reference; description }`. (Listens: none.)
- **Deps:** `CreateAdjustmentCommand.lines[].prices` → `catalog.UpdatePricingCommand` (`import type`).
- **Excluded from contract:** the `InventoryService` interface (backend injected service, C6) — only its DTOs/events are here.
- **Excluded sensitive fields:** none beyond admin-gated cost columns (this whole module is admin-only).
- **Files:** enums, routes, command, query, dtos, events, index.

### E. `purchasing` — suppliers, supplier invoices, supplier payments
*Source: `purchasing.md`. Admin-only.*

- **Routes (`PURCHASING_ROUTES`):** `SUPPLIERS`, `SUPPLIER_BY_ID`, `SUPPLIER_DETAIL`, `SUPPLIER_STATS`, `INVOICES`, `INVOICE_BY_ID`, `CONFIRM`, `CANCEL`, `PAYMENTS`.
- **Enums (`purchasing.enums.ts`):** `SupplierInvoiceStatus { DRAFT, CONFIRMED, CANCELLED }`.
- **Commands:** `CreateSupplierCommand { name; contactName?; phone?; email?; location?; initialCredit? }` / `UpdateSupplierCommand { …; isEnabled? }`, `CreateSupplierInvoiceCommand { supplierId; supplierReference?; invoiceDate; dueDate?; shippingCost?; amountOnly?; note?; lines?: { productId; quantity; unitCost; serialNumbers? }[] }` (**`amountOnly` XOR `lines`** — cross-field refine), `UpdateSupplierInvoiceCommand { … }` (DRAFT-only is a backend guard), `CancelSupplierInvoiceCommand { reason? }`, `CreateSupplierPaymentCommand { supplierId; supplierInvoiceReference?; amount: positive; paidAt? }`.
- **Queries / Params:** `SupplierListQuery`, `SupplierInvoiceListQuery`, `SupplierPaymentListQuery`, `SupplierIdParams`, `SupplierInvoiceIdParams`.
- **DTOs:** `SupplierDto { id; code; name; contactName?; phone?; email?; location?; credit; totalPaid; totalInvoiced; invoiceCount; lastDeliveryAt?; isEnabled }`, `SupplierInvoiceDto { id; reference; supplierReference?; supplierId; supplierName; status: SupplierInvoiceStatus; invoiceDate; dueDate?; shippingCost; amountOnly?; totalAmount; paidAmount; previousCredit?; newCredit?; note?; staffName; lines: { id; productId; productNameSnapshot; quantity; unitCost; landedUnitCost; lineTotal; serialNumbers?; projectedNewAverageCost? }[] }`, `ConfirmResultDto { reference; repriceCandidates: { productId; name; averageCost; current { guestPrice?; defaultSalePrice?; categoryPrices } }[] }`, `SupplierPaymentDto { reference; supplierName; supplierInvoiceReference?; amount; previousCredit; newCredit; paidAt; staffName }`.
- **Events:** `supplierInvoice.confirmed { invoiceId; supplierId; totalAmount; previousCredit; newCredit }`, `supplierInvoice.cancelled`, `payment.supplierRecorded { paymentId; supplierId; supplierInvoiceReference?; amount; previousCredit; newCredit }`, `supplier.creditChanged`.
- **Excluded sensitive fields:** none beyond admin scope (module is admin-only; landed cost / avg cost are intentionally exposed to the buyer).
- **Files:** enums, routes, command, query, dtos, events, index.

### F. `sales` — POS drafts, confirmation, returns, repair-sale
*Source: `sales.md`. Staff-scoped.*

- **Routes (`SALE_ROUTES`):** `CREATE_DRAFT`, `UPDATE_DRAFT`, `CONFIRM`, `STAFF_LIST`, `ADMIN_LIST`, `DETAIL`, `RETURN`.
- **Enums (`sales.enums.ts`):** `SaleStatus { DRAFT, COMPLETED, RETURNED, PARTIALLY_RETURNED, CANCELLED }`, `SaleOrigin { POS, REPAIR }`, `ReturnType { REFUND, EXCHANGE }`.
- **Commands:** `SaleDraftCommand { posClientId?; discountAmount?; note?; lines: { productId; quantity; unitPrice; serialNumbers?: string[] }[].min(1) }`, `UpdateSaleDraftCommand { … }`, `ConfirmSaleCommand { paidAmount: number.min(0) }`, `CreateReturnCommand { saleId; type: ReturnType; reason?; lines: { saleLineId; quantity; restock: boolean; refundAmount }[].min(1) }`.
- **Queries / Params:** `SaleListQuery { status?; from?; to?; page?; limit? }`, `SaleReferenceParams { reference }`, `SaleIdParams { id }`.
- **DTOs:** `SaleDto { id; reference; origin: SaleOrigin; status: SaleStatus; posClientId?; posClientName?; subtotal; discountAmount; totalAmount; paidAmount; previousCredit?; newCredit?; totalCost?; totalProfit?; soldAt?; staffId; staffName; note?; lines: { productId; productName; quantity; resolvedPrice; unitPrice; costOfGoods?; profit?; lineTotal; serialNumbers? }[] }`, `ReceiptDto { reference; lines; total; previousCredit; grandTotal; totalPaid; newCredit }`.
- **Events:** `sale.confirmed { saleId; origin; posClientId?; totalAmount; paidAmount; previousCredit?; newCredit?; snapshotLines }`, `return.created { returnId; saleId; refundAmount; posClientId?; creditEffect? }`. (Listens: `repair.pickedUp`.)
- **Excluded sensitive fields (mapping-gated, C9):** `costOfGoods`, `profit`, `totalCost`, `totalProfit` — modelled `.optional()`; staff mapper strips them, admin keeps. Receipt figures stay for all.
- **Files:** enums, routes, command, query, dtos, events, index.

### G. `orders` — single-product storefront orders
*Source: `orders.md`.*

- **Routes (`ORDER_ROUTES`):** `PLACE`, `MY_LIST`, `MY_CANCEL`, `BACKOFFICE_LIST`, `CONFIRM`, `STATUS`, `CANCEL`, `RETURN`, `STATS`.
- **Enums (`orders.enums.ts`):** `OrderStatus { PENDING, CONFIRMED, PACKAGED, IN_DELIVERY, COMPLETED, CANCELLED, RETURNED }`, `OrderType { PICKUP, DELIVERY_HOME, DELIVERY_OFFICE }`.
- **Commands:** `PlaceOrderCommand { clientId?: uuid|null; productId; quantity: int.min(1); orderType: OrderType; contact { fullName; phone }; delivery? { wilayaId; communeId; address? }; note? }` (delivery required unless PICKUP; PICKUP requires client token — cross-field/context refines), `ConfirmOrderCommand { unitPrice?; serialNumbers?: string[]; paidAmount? }`, `UpdateOrderStatusCommand { status: OrderStatus; deliveryCompany?; trackingNumber?; reason? }`, `ReturnOrderCommand { quantity; restock: boolean; refundAmount; reason? }`.
- **Queries / Params:** `MyOrdersQuery { status? }`, `BackofficeOrdersQuery { status?; search?; page?; limit? }`, `OrderStatsQuery`, `OrderIdParams`.
- **DTOs:** `OrderDto { id; reference; status: OrderStatus; orderType: OrderType; contactName; contactPhone; wilaya? { id; frName; arName }; commune? { id; frName; arName }; address?; deliveryCompany?; trackingNumber?; productId; productName; quantity; resolvedPrice; unitPrice; serialNumbers?; subtotal; deliveryFee; totalAmount; paidAmount; costOfGoods?; profit?; placedAt; confirmedAt?; deliveredAt?; cancelledAt?; canBeCancelled; ageHours }`, `OrderStatsDto { … pending/confirmed/… counts }`.
- **Events:** `order.confirmed { orderId; clientId?; posClientId?; snapshotLine; totals; confirmedByStaffId }`, `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned`. (Listens: `payment.clientRecorded`.)
- **Deps:** `DeliveryFeeService`/`InventoryService` are backend injected (C6); wilaya/commune sub-objects are inlined here (identical to `platform` shapes but small enough to inline — avoids a cross-module cycle).
- **Excluded sensitive fields (mapping-gated, C9):** `costOfGoods`, `profit` — `.optional()`, admin mapper only.
- **Files:** enums, routes, command, query, dtos, events, index.

### H. `repairs` — back-office repair tickets
*Source: `repairs.md`. No public surface, no repair invoices.*

- **Routes (`REPAIR_ROUTES`):** `LIST`, `CREATE`, `UPDATE`, `PARTS`, `PART_BY_ID`, `STATUS`.
- **Enums (`repairs.enums.ts`):** `RepairStatus { INTAKE, PROCESSING, COMPLETED, PICKED_UP, CANCELLED }`, `ReportedIssue { charging, display, battery, camera, speaker, microphone, water-damage, software, other }`.
- **Commands:** `CreateRepairCommand { posClientId?; customerName; customerPhone; brandId?; deviceModelId?; deviceLabel?; deviceImei?; reportedIssues: ReportedIssue[].min(1); reportedIssueOther?; technicianId? }`, `UpdateRepairCommand { diagnosis?; labourPrice?; technicianId? }`, `AddRepairPartCommand { productId; quantity; unitPrice; serialNumbers? }`, `RepairStatusCommand { toStatus: RepairStatus; note?; paidAmount?; consumedPartReturns?: { partId; restock: boolean }[] }`.
- **Queries / Params:** `RepairListQuery { status?; technicianId? }`, `RepairIdParams`, `RepairPartParams { id; partId }`.
- **DTOs:** `RepairDto { id; reference; status: RepairStatus; customerName; customerPhone; posClientId?; device { brand?; model?; label?; imei? }; reportedIssues: ReportedIssue[]; reportedIssueOther?; diagnosis?; technician? { id; name }; labourPrice; partsTotal; totalAmount; paidAmount; totalCost?; totalProfit?; intakeAt; completedAt?; pickedUpAt?; ageHours; parts: { id; productId; productName; quantity; unitPrice; costOfGoods?; profit?; lineTotal; serialNumbers? }[]; history: { fromStatus; toStatus; note?; staffName; changedAt }[] }`.
- **Events:** `repair.pickedUp { repairId; posClientId?; totalAmount; paidAmount; totalCost; totalProfit; snapshotParts; labourPrice }`, `repair.statusChanged`, `repair.cancelled`. (Listens: none.)
- **Excluded sensitive fields (mapping-gated, C9):** `totalCost`, `totalProfit`, part `costOfGoods`/`profit` — `.optional()`, admin mapper only.
- **Files:** enums, routes, command, query, dtos, events, index.

### I. `billing` — invoices + client payments
*Source: `billing.md`. Invoices from SALE|ORDER, never REPAIR.*

- **Routes (`BILLING_ROUTES`):** `MY_INVOICES`, `STAFF_INVOICES`, `ADMIN_INVOICES`, `CANCEL`, `CLIENT_PAYMENTS`, `CLIENT_PAYMENTS_LIST`.
- **Enums (`billing.enums.ts`):** `InvoiceStatus { ISSUED, PARTIALLY_PAID, PAID, CANCELLED }`, `InvoiceSource { SALE, ORDER }`.
- **Commands:** `CancelInvoiceCommand { reason? }`, `CreateClientPaymentCommand { posClientId; invoiceNumber?; amount: positive; paidAt? }`.
- **Queries / Params:** `InvoiceListQuery { client?; status?; source?; from?; to?; page?; limit? }`, `ClientPaymentListQuery`, `InvoiceNumberParams { number }`.
- **DTOs:** `InvoiceDto { number; posClientId?; clientNameSnapshot; clientAddressSnapshot?; sourceType: InvoiceSource; sourceReference; status: InvoiceStatus; totalAmount; paidAmount; previousCredit?; newCredit?; totalCost?; totalProfit?; issuedAt; dueDate?; staffName; lines: { label; quantity; unitPrice; costSnapshot?; profit?; lineTotal; serialNumbers?; currentAverageCost? }[] }`, `ClientPaymentDto { reference; posClientName; invoiceNumber?; amount; previousCredit; newCredit; paidAt; staffName }`.
- **Events:** `invoice.issued`, `invoice.cancelled`, `payment.clientRecorded { paymentId; posClientId; invoiceNumber?; amount; previousCredit; newCredit }`. (Listens: `sale.confirmed`, `order.confirmed`.)
- **Excluded sensitive fields (mapping-gated, C9):** `totalCost`, `totalProfit`, line `costSnapshot`/`profit`/`currentAverageCost` — `.optional()`, admin mapper only; client mapper strips them and foreign invoices 404.
- **Files:** enums, routes, command, query, dtos, events, index.

### J. `statistics` — read-only dashboards & reports
*Source: `statistics.md`. Reads stored figures only.*

- **Routes (`STATS_ROUTES`):** `ADMIN_DASHBOARD`, `STAFF_DASHBOARD`, `OVERVIEW`, `FILTERED`, `CHARTS`, `TOP_PRODUCTS`, `REPORT`.
- **Enums (`statistics.enums.ts`):** `ReportType { sales-by-product, sales-by-client, sales-by-category, sales-by-seller, stock-movements, repairs, supplier-spend, ageing, client-browsing }`, `ChartType { revenue, orders, clients, sales-by-family }`, `ReportFormat { table, csv }`.
- **Commands:** *none* (read-only) → **no `command.ts`**.
- **Queries / Params:** `FilteredQuery { from?; to?; familyId? }`, `ChartsQuery { from?; to?; familyId? }`, `ChartParams { chart: ChartType }`, `TopProductsQuery { period? }`, `ReportQuery { from?; to?; groupBy?; format? }`, `ReportParams { type: ReportType }`.
- **DTOs:** `OverviewDto { totalRevenue; totalProfit; stockValue; totalClientCredit; totalSupplierCredit }`, `FilteredDto { revenue; profit; orders; revenueChangePct; profitChangePct; ordersChangePct }`, `ReportDto { chart: { label; value }[]; rows: Record<string, unknown>[]; totals; drill { entity; idField } }`, `AdminDashboardDto { stats { totalClients; totalProducts; ordersThisWeek; revenueThisMonth; …ChangePct }; pendingOrders[]; pendingClients[]; recentOrders[]; recentClients[]; lowStockProducts[]; repairsByStatus; draftSalesByStaff[] }`, `StaffDashboardDto { mySalesToday; myRevenueToday; myDrafts[]; myPendingOrdersCount?; lowStock[] }`.
- **Events:** none → **no `events.ts`**.
- **Note:** `rows: Record<string, unknown>[]` uses `unknown`, not `any` (§3.3). All admin-only except `STAFF_DASHBOARD` (`staffId = me`).
- **Files:** enums, routes, query, dtos, index. *(No command, no events.)*

### K. `observability` — audit trail + activity logs
*Source: `observability.md`. Append-only sinks.*

- **Routes (`OBS_ROUTES`):** `CLIENT_BEACON`, `STAFF_SEARCH_BEACON`, `CLIENT_ACTIVITY`, `STAFF_SEARCHES`, `LOGS`, `LOG_STATS`.
- **Enums (`observability.enums.ts`):** `ClientActivityType { SEARCH, PRODUCT_VIEW, CATALOG_SESSION }`.
- **Commands:** `ClientActivityCommand { type: ClientActivityType; query?; productId?; durationSeconds?: int.min(0) }` (duration valid only for PRODUCT_VIEW/CATALOG_SESSION — backend guard), `StaffSearchCommand { query; matchedProductId? }`.
- **Queries / Params:** `ClientActivityQuery { type?; from?; to? }`, `StaffSearchesQuery { userId?; from?; to?; q? }`, `LogsQuery { search?; userId?; actionType?; from?; to?; page?; limit?=20 }`, `ClientIdParams` (for `/clients/:id/activity`).
- **DTOs:** `ClientActivityDto { type: ClientActivityType; query?; product? { id; name }; durationSeconds?; createdAt }`, `StaffSearchDto { userId; userName; query; matchedProduct? { id; name }; createdAt }`, `AuditLogDto { id; user? { id; username }; actionType: string; entityType; entityId; description; ipAddress?; createdAt }` (`actionType` is an **open string, never an enum** — spec-mandated), `LogStatsDto { total; today; week; month }`.
- **Events:** emits none; listens to the whole event bus (payloads owned by the emitting modules). → **no `events.ts`** (the module defines no event; it only consumes others'). Documented as a listener, not redefined.
- **Files:** enums, routes, command, query, dtos, index. *(No events.)*

### L. `platform` — settings + geography/delivery fees
*Source: `platform.md`. Hosts `SequenceService`/`DeliveryFeeService` (backend, excluded — C6).*

- **Routes (`PLATFORM_ROUTES`):** `WILAYAS`, `FEE`, `ADMIN_FEES`, `FEES_IMPORT`, `FEES_EXPORT`, `SETTINGS`, `SETTINGS_PUBLIC`.
- **Enums (`platform.enums.ts`):** `DocType { INVOICE, SALE, ORDER, REPAIR, SUPPLIER_INVOICE, ADJUSTMENT, POS_CLIENT, CLIENT }`, `FeeSource { commune, wilaya, default }`.
- **Commands:** `UpsertFeesCommand { rows: { wilayaId; communeId?: uuid|null; deliveryHome; deliveryOffice }[] }`, `UpdateSettingsCommand { store?; invoicing?; delivery?; storefront? }` (partial of `SettingsDto`; lowering a next-sequence is a backend 409). *(Excel import is a multipart file — a backend/runtime concern, not a Zod body.)*
- **Queries / Params:** `FeeQuery { wilayaId?; communeId? }`, `FeesExportQuery { format? }`.
- **DTOs:** `WilayaDto { id; wilayaCode; frName; arName; communes: { id; communeCode; frName; arName }[] }`, `FeeDto { deliveryHome; deliveryOffice; source: FeeSource }`, `SettingsDto { store { name; address?; phone?; logoUrl? }; invoicing { prefixes: Record<DocType,string>; nextSequences: Record<DocType,number>; footerNote? }; delivery { defaultHome; defaultOffice }; storefront { featuredProductIds: uuid[] } }`, `PublicSettingsDto { storefront { featuredProductIds } … }`.
- **Events:** `settings.changed { description }`, `deliveryFees.changed { description }`. (Listens: none.)
- **Excluded from contract:** `SequenceService`, `DeliveryFeeService` interfaces (backend, C6).
- **Files:** enums, routes, command, query, dtos, events, index.

---

## Part 3 — Root barrel, dependency hygiene, deliverables

### 3.1 `src/index.ts`
Re-exports `common/*` then every module barrel. The stale placeholder exports (`modules/user`, `modules/auth`, `modules/delivery-company`) are **removed/replaced** by the 12 domain barrels (C3): `identity`, `clients`, `catalog`, `inventory`, `purchasing`, `sales`, `orders`, `repairs`, `billing`, `statistics`, `observability`, `platform`.

### 3.2 Package rename
`package.json` `name`: `@your-app/contract` → `@dragon-telecom/contract`. All later stages import from `@dragon-telecom/contract`.

### 3.3 Cross-module dependency map (watch for cycles — §6.8)
- `clients.CartItemDto` → `catalog.ProductWithPricingDto` (type-only).
- `inventory.CreateAdjustmentCommand` → `catalog.UpdatePricingCommand` (type-only).
- `common/auth.ts` → `identity.UserType` (enum value — runtime import; acyclic, one direction).
- All others self-contained. Event **listeners** reference emitting modules' payloads by documentation only, not by import, to keep `events.ts` files leaf nodes. Direction is strictly `common → identity → {catalog} → {clients, inventory}`; no back-edges. `madge --circular src` must stay clean.

### 3.4 Files created (net-new module dirs under `src/modules/`)
12 dirs, each with `index.ts` + the content files listed per module above. Read-only/eventless modules omit files per §73: `statistics` (no command, no events), `observability` (no events), all others carry the full six where the spec populates them.

### 3.5 Validation gate for the execute phase (rules §6)
Zero logic · every type `z.infer`'d · no `any` · no magic strings · no sensitive data in any DTO (see per-module *Excluded* lists) · ISO-string dates · `tsc --noEmit` clean · `madge --circular` clean · lint clean · everything barrelled.

---

## Open items surfaced (non-blocking — recorded, not stopped-for)

1. **C1 / C3 — resolved.** The user confirmed (2026-07-17) that `Docs/Stage-00-Conception/` is the sole source of truth and every existing `Apps/contract` / `Apps/api` file is template example only. The Stage-00 schema is authoritative; the placeholder `user`/`auth`/`delivery-company` modules are replaced by the 12 domain modules (Part 3.1). No further input needed.
2. No **WHICH conflict** (rules §0) arose — no spec places a `password`/token-hash/internal-flag in an output. Proceeded without stopping, as instructed.
3. `catalog.md` defers some taxonomy DTO fields to "the DB description" (`Docs/Stage-00-Conception/database-description.md`). The blueprint's `BrandDto`/`FamilyDto`/`DeviceModelDto` are derived from the schema + spec; the execute phase should reconcile any extra display fields from that doc.
