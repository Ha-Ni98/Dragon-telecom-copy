# Stage 02 · Sub-02 — Module Implementation Plan: `catalog`

> Set: catalog (merges taxonomy + product + client-category). Reference module: `delivery-company`
> shape as realised by the built `identity`/`platform`/`observability` modules. 6-file architecture,
> manual DI, no code yet. Standing rules applied: **rules = HOW, phase = WHAT/WHEN, contract = WHICH**;
> every type/enum/route below was confirmed to already exist in `@dragon-telecom/contract` before being
> named (§0). HOW gaps are resolved toward the rules and flagged (§7–§8); none is a genuine
> authority-vs-authority conflict, so I did not stop to ask.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

Everything the module serves already exists in the contract, **except two owner-approved additions to
`catalog.dtos.ts`** (§8 #1–#2, shared back+front response shapes): `ProductDetailResponseSchema`
(`ProductWithPricingDto` + `relatedIds`) and an optional `productCount` on `FamilyResponseSchema`.
Everything else is confirmed pre-existing:

- **Routes** — `CATALOG_ROUTES` (`catalog.routes.ts`): `BRANDS`, `FAMILIES`, `MODELS`, `PRODUCTS`,
  `PRODUCT_DETAIL`, `STAFF_PRODUCTS`, `ADMIN_PRODUCTS`, `ADMIN_PRODUCT_BY_ID`, `PRICING`, `IMAGES`,
  `PRODUCT_STATS`, `ADMIN_BRANDS`, `ADMIN_BRAND_BY_ID`, `ADMIN_FAMILIES`, `ADMIN_FAMILY_BY_ID`,
  `ADMIN_MODELS`, `ADMIN_MODEL_BY_ID`, `MODEL_FAMILIES`, `CATEGORIES`, `CATEGORIES_CUD`,
  `CATEGORY_BY_ID`. *(Note: the spec's GET/POST/PATCH "one row" entries expand to the `_BY_ID`
  constants already present — no string literals needed.)*
- **Enum** — `StockStatus` (`in_stock|low_stock|out_of_stock`).
- **DTOs** (`catalog.dtos.ts`): `ProductImageDto`, `ProductWithPricingDto`, `StaffProductDto`,
  `AdminProductDto`, `ClientCategoryDto`, `BrandDto`, `FamilyDto`, `DeviceModelDto`, `ProductStatsDto`.
- **Commands** (`catalog.command.ts`): `CreateProductCommand`/`UpdateProductCommand`,
  `UpdatePricingCommand`, `CreateBrandCommand`/`UpdateBrandCommand`,
  `CreateFamilyCommand`/`UpdateFamilyCommand`, `CreateModelCommand`/`UpdateModelCommand`,
  `SetModelFamiliesCommand`, `AddProductImagesCommand`/`UpdateProductImagesCommand`,
  `CreateClientCategoryCommand`/`UpdateClientCategoryCommand`. The `CreateProductSchema` already encodes
  the XOR (`familyId|newFamilyName`, `brandId|newBrandName`, `modelId`⊕`newModelName`) and the two
  stock/pricing refinements (`PRICING_REQUIRES_STOCK`, `initialUnitCost` required when qty>0).
- **Queries** (`catalog.query.ts`): `ProductListQuerySchema`, `FamiliesQuerySchema`, `ModelsQuerySchema`,
  and params `ProductIdParamsSchema`, `BrandIdParamsSchema`, `FamilyIdParamsSchema`,
  `ModelIdParamsSchema`, `CategoryIdParamsSchema`.
- **Events (out)** — `CatalogEvents` (`catalog.events.ts`): `product.created`, `product.repriced`,
  `taxonomy.changed`, `clientCategory.changed`, `product.searched`. The **event bus already includes
  `CatalogEvents`** (`common/events/event-bus.ts`) and the **observability listener already subscribes
  to all five** (`observability.listener.ts::registerCatalog`, incl. the `product.searched` →
  `StaffSearchLog` path). ⇒ **catalog only emits; it needs no `catalog.listener.ts`.**
- **Cross-module (injected)** — `MovementType.INITIAL_STOCK` exists (`inventory.enums.ts`); the injected
  inventory service is the seam for the first FIFO layer (§2.2, §7.1).
- **Auth** — `PageKey.STAFF_PRODUCTS` exists (`identity.enums.ts`) and is seeded STAFF-scope
  (`pages.registry.ts`); `UserType` (`PUBLIC` via no-token, `CLIENT`, `STAFF`, `ADMIN`) exists.

**Prisma models** (all pre-built, `Apps/api/prisma/schema.prisma`): `Brand`, `DeviceModel`, `Family`,
`DeviceModelFamily` (m2m), `Product`, `ProductImage`, `ProductPrice`, `ClientCategory`, plus read-only
joins to `ClientCart` (for `inCart`) and `PosClient` (for tier resolution). **`Product.quantityOnHand`,
`quantityReserved`, `averageCost` are inventory-owned — catalog never writes them** (spec BL#6).

> **Schema gap found and fixed during Sprint 2 (owner-approved, asked before implementing):**
> `Product` had no direct `brandId` — brand was only reachable via the optional `deviceModel` relation,
> so a universal part (`deviceModelId = null`) had **no way to resolve a brand at all**. But the contract
> already modelled brand as independent of model: `CreateProductCommand`'s `brandId|newBrandName` is a
> required top-level XOR pair, separate from the optional `modelId|newModelName`, and all three product
> DTOs declare `brand` required while `model` is optional. This is a genuine schema-vs-contract conflict
> (not a HOW gap), so I stopped and asked. **Decision: add `Product.brandId`/`brand` (required, direct
> relation to `Brand`, independent of `deviceModelId`) to `schema.prisma` + a migration**, matching the
> contract's existing intent with zero contract change. Applied via migration
> `20260717191021_product_brand_id` against both the dev and test databases (Product table was empty —
> no data-loss risk). See Sprint 2's report for details.

---

## 1. Step 1 — Contract & Schema analysis

### 1.1 Prisma model ⇄ contract DTO mapping (the mapper's job — pure/static, never spreads the entity)

| DTO | Source | Convert / derive | **Excluded (never returned)** |
|---|---|---|---|
| `ProductImageDto` | `ProductImage` | `position`, `isPrimary` pass-through | — |
| `ProductWithPricingDto` (public) | `Product` + `brand`/`family`/`model` + `images` + resolved price + cart | `createdAt→ISO`; `currentPrice`/`guestPrice` `Decimal→number`; `priceHidden`/`inStock`/`inCart` **computed** (§1.2) | `averageCost`, `quantityOnHand`, `quantityReserved`, `defaultSalePrice`, category prices, `sku`, `reorderThreshold`, publish flags |
| `StaffProductDto` (staff) | `Product` + relations + `ProductPrice[]`+category names | `availableQuantity = onHand − reserved`; `defaultSalePrice` `Decimal→number`; `categoryPrices[]` from `ProductPrice` join | **`averageCost`, cost, `quantityReserved`, exact `quantityOnHand`** |
| `AdminProductDto` (admin) | `Product` full + relations | `createdAt→ISO`; every `Decimal→number` (`guestPrice?`, `defaultSalePrice?`, `averageCost`); `availableQuantity` derived; `stockStatus` derived (§1.3) | nothing (full visibility) |
| `ClientCategoryDto` | `ClientCategory` + counts | `memberCount` = enabled `PosClient` w/ this `categoryId`; `pricedProductCount` = `ProductPrice` rows for it | — |
| `BrandDto` | `Brand` | `slug`, `logoUrl?`, `isEnabled` pass-through | — |
| `FamilyDto` | `Family` | `parentId?`, `isUniversal`, `isFeatured`, `isEnabled` | — |
| `DeviceModelDto` | `DeviceModel` + `DeviceModelFamily[]` | `familyIds = families.map(f => f.familyId)` | — |
| `ProductStatsDto` | aggregate over `Product` | `total`/`inStock`/`lowStock`/`outOfStock` counts (§1.3) | — |

Each `toDto` ends with `XxxResponseSchema.parse(dto)` (dev/test conformance guard, per rules §4). Money
leaves the service as `number` (`Decimal.toNumber()`); `Date` leaves as `.toISOString()`.

### 1.2 Price resolution — the one reused function (spec BL#1)

A single pure resolver `resolvePrice(product, viewer, categoryPriceMap)` returns
`{ currentPrice?: number; guestPrice?: number; priceHidden: boolean }`. Storefront/POS/orders reuse it
(exposed as an injected `IPricingService` for the downstream POS/orders modules — §8):

| Viewer | Resolution | `priceHidden` |
|---|---|---|
| **CLIENT + tier** (`Client.posClientId → PosClient.categoryId`) | `ProductPrice[productId, categoryId].price` → else `guestPrice` | true iff both null |
| **CLIENT, no tier** (no posClient/category/price row) | `guestPrice` | true iff `guestPrice` null |
| **Guest** (no token) | `guestPrice` | true iff `guestPrice` null |
| **POS/staff selling** | category `ProductPrice` → else `defaultSalePrice` (staff/order surfaces only) | — |

`priceHidden` products are **"price on request" and unorderable** for guests (spec BL#1). `inStock` =
`availableQuantity > 0` (boolean only — public never sees the number). `inCart` = a `ClientCart` row
exists for `(viewer.clientId, productId)` for CLIENT tokens; **always `false`** otherwise (spec BL#3).

### 1.3 Enum / money / derived columns

- **`availableQuantity`** = `quantityOnHand − quantityReserved` (read-only compute; never persisted here).
- **`stockStatus`** (admin) / stats buckets: `available <= 0 → out_of_stock`;
  `available <= reorderThreshold → low_stock`; else `in_stock`. `ProductStats` = counts per bucket +
  `total`.
- **Money**: all `Decimal(12,2)` → `number` via `.toNumber()` at the mapper boundary; DZD, cash-only, no
  payment field anywhere (spec Shared Conventions).

---

## 2. Step 2 — Component definition

### 2.1 Interfaces (`catalog.interface.ts`) — cohesive surfaces + one injected port

Following the **platform precedent** (`platform.interface.ts` declared three interfaces; the service file
co-located their implementations — plan-platform §2.1/§8.7), catalog splits by cohesion so no single
class is unwieldy, while honouring the strict single-`service.ts` file:

- **`ICatalogProductService`** — `listProducts(q, viewer): Promise<PaginatedResult<ProductWithPricingDto>>`,
  `getProduct(id, viewer): Promise<ProductDetailDto>` (= `ProductWithPricingDto` + `relatedIds`, §8 #1),
  `listStaffProducts(q, viewer): Promise<PaginatedResult<StaffProductDto>>`,
  `listAdminProducts(q, viewer): Promise<PaginatedResult<AdminProductDto>>`,
  `createProduct(cmd, images): Promise<AdminProductDto>`, `updateProduct(id, cmd): Promise<AdminProductDto>`,
  `updatePricing(id, cmd): Promise<AdminProductDto>`, `addImages(id, cmd, files): Promise<AdminProductDto>`,
  `updateImages(id, cmd): Promise<AdminProductDto>`, `productStats(): Promise<ProductStatsDto>`.
- **`ICatalogTaxonomyService`** — `listBrands()`, `listFamilies(q)`, `listModels(q)` (public, enabled-only);
  admin `createBrand/updateBrand`, `createFamily/updateFamily`, `createModel/updateModel`,
  `setModelFamilies(id, cmd)`. Returns `BrandDto`/`FamilyDto`/`DeviceModelDto`.
- **`ICatalogCategoryService`** — `listCategories()`, `createCategory(cmd)`, `updateCategory(id, cmd)`
  → `ClientCategoryDto`.
- **`IInventoryPort`** (injected dependency, **defined here as the port catalog needs**, implemented by the
  future inventory module) — `addLayer(tx, { productId, quantity, unitCost, type }): Promise<void>` with
  `type = MovementType.INITIAL_STOCK`. Declaring the port in catalog inverts the dependency so catalog
  doesn't hard-import an unbuilt module (§7.1).

Controllers depend on the interfaces; the service class(es) receive `PrismaClient` (+ the injected
`IInventoryPort` for the product service). Methods return **DTOs**, never Prisma entities (rules §4).

### 2.2 Events

- **Emits (after commit, payloads are contract-typed):**
  - `product.created { productId, name }` — on create.
  - `product.repriced { productId, name }` — on `PRICING` PATCH (and the create path when pricing set).
  - `taxonomy.changed { entityType, entityId, description }` — on any brand/family/model create/update/
    disable and `MODEL_FAMILIES` replace.
  - `clientCategory.changed { categoryId, description }` — on category create/update/disable.
  - `product.searched { userId, query, matchedProductId? }` — **only on staff/admin list searches** (a
    `search` term present + an authenticated `userId`); public/guest searches carry no `userId` and emit
    nothing (spec Events + Test Scenarios). One `StaffSearchLog` row is written by the observability
    listener, not here.
- **Listens: none** (observability already owns every catalog subscription).
- **Injected call:** `createProduct` with `initialQuantity > 0` calls
  `inventory.addLayer(tx, INITIAL_STOCK)` **inside** its `$transaction` (return-value-in-caller's-tx ⇒
  injected service, per the spec connection rule).

---

## 3. Business logic (the HOW behind the methods) — spec §Business Logic

1. **Price resolution** — §1.2. Public list/detail resolve per-viewer; staff DTO adds
   `availableQuantity` + the 4 sale prices (no cost); admin DTO is unrestricted. **Leak guard:**
   storefront never returns cost, exact/reserved quantities, or margin (mapper omits them by listing
   returned fields — rules §4 "exclude by listing what you return").
2. **Product creation** (single `$transaction`):
   - `initialQuantity === 0` ⇒ any of `guestPrice`/`defaultSalePrice`/`categoryPrices` present ⇒ **400
     `PRICING_REQUIRES_STOCK`** (already enforced by `CreateProductSchema.refine`; the service trusts the
     validated body). Product is born **price-less**.
   - `initialQuantity > 0` ⇒ `initialUnitCost` **required** (schema-enforced); create the product, then
     `inventory.addLayer(tx, INITIAL_STOCK)` for the **first FIFO layer in the same tx**, then persist
     unlocked pricing (`guestPrice`/`defaultSalePrice`/`ProductPrice` rows).
   - `newBrandName`/`newFamilyName`/`newModelName` inline-create the taxonomy row (slug generated,
     uniqueness checked) within the tx; else the `*Id` is validated to exist.
   - `sku` is generated (unique) — not client-supplied. Emit `product.created` after commit.
3. **Pricing update** (`PRICING` PATCH): upsert `guestPrice` (nullable — `null` clears/hides),
   `defaultSalePrice`, and `categoryPrices[]` (upsert/replace `ProductPrice` rows by
   `(productId, clientCategoryId)`). Emit `product.repriced`. This is also the reprice-prompt target.
4. **Taxonomy** — names unique (**model name unique per brand**: `@@unique([brandId, name])`); slugs
   generated; **one family nesting level** (reject `parentId` whose parent itself has a parent);
   **disable-only** (no deletes) — disabled brand/family/model **vanishes from public lists & pickers**
   but products keep their FK and stay sellable (test: disabled brand hidden, its products' DTOs still
   resolve). **Featured families capped at 6 enabled** (reject the 7th `isFeatured=true`). `MODEL_FAMILIES`
   PUT **replaces** the whole `DeviceModelFamily` set for the model. Emit `taxonomy.changed`.
5. **Client categories** — name unique; **disable requires zero enabled `PosClient` members** else **409
   `CATEGORY_IN_USE` + count**; create makes **no** price rows; `pricedProductCount` surfaces sparse
   tiers. No assumption of three categories (that cap is front-end). Emit `clientCategory.changed`.
6. **Inventory-owned columns** — `quantityOnHand`, `quantityReserved`, `averageCost` are **read-only**
   here; writes happen only through the injected inventory port (`addLayer`), never a direct
   `product.update` on those fields.

**Cross-cutting:** all list endpoints paginate via `ProductListQuerySchema` + the `paginated()` factory
(`meta`); `select`/`include` fetch only needed fields; every state mutation emits the event the audit
module narrates.

---

## 4. Step 3 — Test strategy (`test-rules.md`)

### 4.1 Factories (`test/data/`, contract-shaped — the single source of truth)

`brand.factory.ts`, `family.factory.ts`, `device-model.factory.ts`, `product.factory.ts`,
`product-price.factory.ts`, `client-category.factory.ts` (+ reuse existing `pos-client`/`client`
factories for tier/`inCart` scenarios; add if absent). Each returns a valid persistence payload and a
matching command payload.

### 4.2 Unit (`test/unit/modules/catalog/`, mock Prisma + spy `eventBus`)

- **`catalog.mapper.spec.ts`** — each `toDto` parses its schema; **leak assertions** (public/staff DTOs
  carry no `averageCost`/reserved/exact qty); `Decimal→number`, `Date→ISO`, `familyIds` flattening,
  `stockStatus` thresholds, `availableQuantity` math.
- **`catalog.service.spec.ts`** — **price-resolution matrix** (client+tier / client no-tier / guest
  priced / guest null); `initialQuantity 0 + pricing → 400 PRICING_REQUIRES_STOCK`; `>0 without cost →
  400`; `>0 → addLayer called once with INITIAL_STOCK in-tx` (mock `IInventoryPort`, assert tx passed);
  duplicate model-in-brand → 409; featured-families 7th → rejected; category disable with members → 409
  `CATEGORY_IN_USE` (+count); `product.searched` emitted with `userId` on staff/admin search, **not** on
  guest search; taxonomy/category events emitted on mutation (spy `eventBus`).

### 4.3 Integration (`test/integration/catalog.integration.spec.ts`, real test DB, envelope asserted)

Hit the real prefix through Supertest; assert `ApiResponse` envelope. Cover: guest `/products` DTO leak
check; disabled brand hidden in `/brands` but its product's `/products/:id` still resolves; `POST
/admin/products` with `initialQuantity>0` creates the FIFO layer (assert via inventory read) and unlocks
pricing; `pricing` PATCH → `product.repriced`; category disable with an enabled POS member → 409;
`staff/products` requires the `STAFF_PRODUCTS` page (403 without it, 200 with it / as admin);
`optionalAuth` on `/products` (guest vs CLIENT-token pricing differ). Auth via `auth.fixture`.

### 4.4 Contract conformance (`test/contract/routes.conformance.spec.ts`)

Extend the existing suite: every catalog response parses against its `*ResponseSchema`; every registered
route uses a `CATALOG_ROUTES` constant (no string literals).

---

## 5. Step 4 — File checklist (create only what the module needs)

Inside `Apps/api/src/modules/catalog/`, in order:

1. **`catalog.mapper.ts`** — pure/static: `toProductImageDto`, `toProductWithPricingDto(product, priced,
   viewerFlags)`, `toStaffProductDto`, `toAdminProductDto`, `toClientCategoryDto(cat, counts)`,
   `toBrandDto`, `toFamilyDto`, `toDeviceModelDto`, `toProductStatsDto`. `Decimal.toNumber()`,
   `Date.toISOString()`, enum/`stockStatus` derivation; each ends `…ResponseSchema.parse(dto)`.
2. **`catalog.interface.ts`** — `ICatalogProductService`, `ICatalogTaxonomyService`,
   `ICatalogCategoryService`, and the injected **`IInventoryPort`** (§2.1).
3. **`catalog.service.ts`** — `CatalogProductService` (injects `PrismaClient` + `IInventoryPort`),
   `CatalogTaxonomyService`, `CatalogCategoryService` co-located, each `implements` its interface. Holds
   the shared `resolvePrice` resolver; throws `AppError` subclasses; `$transaction` for create/pricing;
   `isKnownRequestError` (P2002/P2025) → `ConflictError`/`NotFoundError`; emits `CatalogEvents` after
   commit. *(Co-location keeps the strict single service file — platform §8.7 precedent.)*
4. *(no `catalog.listener.ts` — catalog listens to nothing; observability owns the subscriptions.)*
5. **`catalog.controller.ts`** — thin; `try/catch → next(error)`; reads `req.validated`; reads the viewer
   from `req.user` (optional) for pricing/`inCart`; `sendSuccess` (`201` create, `200` read/update);
   multipart create/images read `req.files` (Multer).
6. **`catalog.routes.ts`** — composition root: `new CatalogProductService(prisma, inventoryService)`,
   `new CatalogTaxonomyService(prisma)`, `new CatalogCategoryService(prisma)`, controllers, then one
   registration per route using the `CATALOG_ROUTES` constant + `validateRequest` per segment + guards +
   Multer on multipart routes. `export { router }`.

### 5.1 Route registration map (guards + validation)

| Route const | Method | Guard | `validateRequest` / middleware |
|---|---|---|---|
| `BRANDS` | GET | public | — |
| `FAMILIES` | GET | public | `{ query: FamiliesQuerySchema }` |
| `MODELS` | GET | public | `{ query: ModelsQuerySchema }` |
| `PRODUCTS` | GET | `requireAuth({ optional:true })` (§7.2 — token only shapes data, never gates) | `{ query: ProductListQuerySchema }` |
| `PRODUCT_DETAIL` | GET | `requireAuth({ optional:true })` | `{ params: ProductIdParamsSchema }` |
| `STAFF_PRODUCTS` | GET | `requireAuth({ types:[STAFF,ADMIN], pages:[STAFF_PRODUCTS], checkDB:true })` (admin bypasses page — §7.3) | `{ query: ProductListQuerySchema }` |
| `PRODUCT_STATS` | GET | admin | — · **register before `ADMIN_PRODUCT_BY_ID`** |
| `ADMIN_PRODUCTS` | GET | admin | `{ query: ProductListQuerySchema }` |
| `ADMIN_PRODUCTS` | POST | admin | `multer().array('images')` + `{ body: CreateProductSchema }` |
| `ADMIN_PRODUCT_BY_ID` | GET | admin | `{ params: ProductIdParamsSchema }` |
| `ADMIN_PRODUCT_BY_ID` | PATCH | admin | `{ params: ProductIdParamsSchema, body: UpdateProductSchema }` |
| `PRICING` | PATCH | admin | `{ params: ProductIdParamsSchema, body: UpdatePricingSchema }` |
| `IMAGES` | POST | admin | `multer().array('images')` + `{ params, body: AddProductImagesSchema }` |
| `IMAGES` | PATCH | admin | `{ params: ProductIdParamsSchema, body: UpdateProductImagesSchema }` |
| `ADMIN_BRANDS` | GET/POST | admin | POST `{ body: CreateBrandSchema }` |
| `ADMIN_BRAND_BY_ID` | PATCH | admin | `{ params: BrandIdParamsSchema, body: UpdateBrandSchema }` |
| `ADMIN_FAMILIES` | GET/POST | admin | POST `{ body: CreateFamilySchema }` |
| `ADMIN_FAMILY_BY_ID` | PATCH | admin | `{ params: FamilyIdParamsSchema, body: UpdateFamilySchema }` |
| `ADMIN_MODELS` | GET/POST | admin | POST `{ body: CreateModelSchema }` |
| `ADMIN_MODEL_BY_ID` | PATCH | admin | `{ params: ModelIdParamsSchema, body: UpdateModelSchema }` |
| `MODEL_FAMILIES` | PUT | admin | `{ params: ModelIdParamsSchema, body: SetModelFamiliesSchema }` |
| `CATEGORIES` | GET | `requireAuth({ types:[STAFF,ADMIN] })` | — |
| `CATEGORIES_CUD` | POST | admin | `{ body: CreateClientCategorySchema }` |
| `CATEGORY_BY_ID` | PATCH | admin | `{ params: CategoryIdParamsSchema, body: UpdateClientCategorySchema }` |

`admin` = `requireAuth({ types:[UserType.ADMIN], checkDB:true })` (the built pattern). **Route ordering:**
`PRODUCT_STATS` (`/admin/products/stats`) must be registered **before** `ADMIN_PRODUCT_BY_ID`
(`/admin/products/:id`) or Express matches `:id="stats"`.

---

## 6. Wiring (the real extension point)

Add `catalogRouter` to the aggregator `Apps/api/src/modules/index.ts` at the `EXTENSION POINT (modules)`:
`apiRouter.use(catalogRouter)`. `CATALOG_ROUTES` paths (`/brands`, `/families`, `/products`,
`/admin/…`, `/staff/products`) compose under `env.API_PREFIX` (`/api`) to `/api/brands`,
`/api/admin/products`, `/api/staff/products`, … exactly per spec.

**Injected inventory service.** `catalog.routes.ts` receives the inventory service via `IInventoryPort`.
Per the owner decision (§7.1) we **assume inventory is built** and inject the real service; while it is
still absent, catalog's local `inventory.port.stub.ts` skeleton satisfies the port so nothing fails to
import/compile. Swapping the stub for the inventory module's exported singleton (on the shared `prisma`,
mirroring platform's `sequenceService`/`deliveryFeeService` export — plan-platform §6) is a one-line
change at the composition root.

---

## 7. Prerequisites / dependencies outside the 6 files (flagged)

1. **Injected `InventoryService` (cross-module) — DECIDED: assume inventory is built.** `createProduct`
   needs `addLayer(tx, INITIAL_STOCK)` to run **inside catalog's transaction** and return before commit
   ⇒ the inventory `addLayer` **must accept a Prisma tx client**. Catalog defines the `IInventoryPort`
   seam (dependency inversion) and wires the real inventory service assuming it exists (owner decision:
   "assume inventory is built"). **To guarantee no import/compile error while inventory is still absent,
   catalog ships a tiny local `inventory.port.stub.ts` skeleton** (a class implementing `IInventoryPort`
   with a single `addLayer` that performs the `INITIAL_STOCK` movement/layer insert on the passed `tx`, or
   is swapped for the real export in one line once inventory lands). The composition root injects it;
   unit/integration tests inject a **mock port** and assert `addLayer` is called once in-tx. No sprint is
   blocked on the inventory module.
2. **`requireAuth({ optional:true })` — DECIDED (owner): the token shapes data, it does not gate.**
   `PRODUCTS`/`PRODUCT_DETAIL` stay `public`; when a token is present the middleware populates `req.user`
   (viewer tier / `inCart`), when absent it is a **no-op that still calls `next()`** (guest). Implemented
   as a new `optional?: boolean` option **on the existing `requireAuth`** (`auth.middleware.ts` edit — no
   new middleware file): on a missing/invalid token with `optional:true`, skip instead of throwing.
3. **`requireAuth({ pages: PageKey[] })` — DECIDED (owner): extend the auth middleware to DB-check role
   access.** `requireAuth` gains a `pages?: PageKey[]` option: after the `type` check, if `pages` is set
   it **loads the user's effective page set from the DB** (reusing identity's `effectivePages` logic —
   `type===ADMIN` ⇒ bypass/all pages; STAFF ⇒ union of enabled roles' pages) and 403s unless every
   required page is present. Same file edit as §7.2 — `auth.middleware.ts`, no new file. `STAFF_PRODUCTS`
   is the first consumer (`pages:[PageKey.STAFF_PRODUCTS]`, `checkDB:true`).
4. **Multer + upload limits.** `ADMIN_PRODUCTS` POST and `IMAGES` POST are **multipart** (image bytes +
   per-image metadata; `AddProductImagesSchema`/`CreateProductSchema` are the JSON companion). Reuse the
   `multer` dependency platform added; restrict MIME (image/*) + size. Env has no upload knob
   (`env-template.md` lists only `AWS_*`) — **use an in-code constant** (platform §7.2 precedent) or add
   `UPLOAD_MAX_BYTES` to both `env.ts` and the template (env-template precedence). Store **URL/path only**
   (rules §5). Actual object storage (local/S3) is an infra decision flagged for the owner.
5. **Symbolic error codes not in `ErrorCode`.** `PRICING_REQUIRES_STOCK` (already a schema refinement →
   400 `VALIDATION_ERROR`), `CATEGORY_IN_USE` → `ConflictError` (409, symbolic name + count in the
   message), inline-taxonomy/duplicate collisions → `ConflictError`/`NotFoundError`. No contract change
   (mirrors platform §7.3 / identity's `LAST_ADMIN_PROTECTED`).

---

## 8. Deviations & open decisions (resolved toward the rules; noted per standing rules)

| # | Item | Resolution |
|---|---|---|
| 1 | **`PRODUCT_DETAIL` spec says "+ related ids" but `ProductWithPricingDto` has no `relatedIds`.** | **DECIDED (owner rule: shared back+front ⇒ contract).** The detail page renders related products on the frontend, so add `ProductDetailResponseSchema = ProductWithPricingResponseSchema.extend({ relatedIds: z.array(z.uuid()) })` (+ `ProductDetailDto`) to `catalog.dtos.ts` and export it. `getProduct` returns it; conformance parses against it. **This is the module's only contract addition.** |
| 2 | **`FAMILIES?withCount=` but `FamilyDto` has no count field.** | **DECIDED (owner rule: shared back+front ⇒ contract).** The Home/admin family list renders the count on the frontend, so add an **optional** `productCount: z.number().int().min(0).optional()` to `FamilyResponseSchema` in `catalog.dtos.ts`. Populated only when `withCount=true` (else omitted — stays backward-compatible). |
| 3 | **Staff/admin product lists reuse `ProductListQuerySchema`.** | The contract defines only `ProductListQuerySchema`; staff/admin lists reuse it for search/filter/pagination (satisfies "always paginate", rules §5.2). `product.searched` fires only when `search` is present **and** a `userId` exists (staff/admin), never for guests — matches the spec's "fired by staff/admin list searches". |
| 4 | **Multipart create/images bypass the JSON-body convention.** | `multipart/form-data` (Multer) for image bytes; the Zod command validates the accompanying metadata/JSON part. Standard envelope exception (platform §8.4 precedent). |
| 5 | **Cohesive service split vs single class.** | Three interfaces (`product`/`taxonomy`/`category`) **co-located in one `catalog.service.ts`**, each `implements` its interface — honours the strict single-service-file rule while keeping classes cohesive (platform §8.7). Splitting into files is the alternative if the owner prefers. **Flagged.** |
| 6 | **`sort` query is a free string (no enum).** | The contract kept `sort: z.string().optional()`; the service maps a known allow-list (`name`, `createdAt`, price) to `orderBy` and ignores unknown values (no invented contract enum). Revisit if the owner fixes sort keys. **Flagged.** |
| 7 | **`sku` generation.** | Not client-supplied (absent from `CreateProductCommand`); generated uniquely in the service (sequence/slug-style), surfaced only on `AdminProductDto`. |
| 8 | **Price resolver reuse across modules.** | Exposed as an injected `IPricingService` from catalog's composition root so POS/orders resolve prices through the **same** function (return-value-in-caller ⇒ injected service). Exact export path coordinated with the sales/orders plans (platform §8.8 pattern). **Flagged.** |

No item rises to a genuine authority-vs-authority conflict, so per the standing rules I did not stop to
ask — each is resolved toward the rules/contract and flagged for the owner.

---

## 9. Definition of done

- `Apps/api/src/modules/catalog/` has 5 files (mapper, interface, service, controller, routes); **no
  listener**. `catalog.service.ts` provides the product/taxonomy/category services + the shared price
  resolver.
- `catalogRouter` mounted via `registerModules`; every route uses a `CATALOG_ROUTES` constant (no string
  literals) and validates each segment against the contract schema; `PRODUCT_STATS` registered before
  `ADMIN_PRODUCT_BY_ID`.
- Every service method returns a DTO that parses against its `*ResponseSchema` (mapper-enforced);
  `Decimal → number` and `Date → ISO` at every boundary.
- **Price resolution** honours the full matrix; **storefront leaks nothing** (no cost/reserved/exact
  qty/margin); `inStock` boolean-only; `inCart` correct for CLIENT tokens.
- **Product creation** is transactional: qty=0 rejects pricing (`PRICING_REQUIRES_STOCK`); qty>0 requires
  cost and creates the **first FIFO layer via injected `InventoryService.addLayer` in the same tx**;
  catalog never writes `quantityOnHand`/`quantityReserved`/`averageCost`.
- **Taxonomy** disable-only (disabled hidden from public/pickers, products stay sellable), unique
  model-per-brand (409 on dup), featured cap 6, `MODEL_FAMILIES` replaces the set.
- **Categories** unique name, disable blocked with enabled members (409 `CATEGORY_IN_USE` + count),
  create makes no prices.
- All five events emit after commit; `product.searched` emits with `userId` on staff/admin search only.
- `requireAuth` extended with `optional` (token shapes data, never gates) and `pages` (DB-checked
  effective-page membership; ADMIN bypasses) options — same `auth.middleware.ts` file, unit-tested.
- Contract additions (`ProductDetailResponseSchema`, `FamilyResponseSchema.productCount?`) exported and
  covered by conformance; unit + integration + conformance suites green.
```