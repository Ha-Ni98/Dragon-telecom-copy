# Stage 02 · Sub-02 — Catalog Module Sprint Plan (set 03)

Dependency-ordered decomposition of [`plan-catalog.md`](./plan-catalog.md) into sprints, following the
phase-02 backbone **foundation (mapper/interface) → logic (service) → API (controller/wiring)**.
**No code in this document.** Each sprint ends green (compiles + tests pass) and is committed before the
next begins.

## Sprint sequence & rationale

The phase file's suggested 3-sprint shape (Foundation / Logic / API) is **adjusted to 5** because
`catalog` is the largest merged module so far (taxonomy + product + client-category + price resolution +
images) and carries enabling changes outside its 6 files (two contract DTO additions, an `auth.middleware`
extension, the injected inventory port). Splitting the logic layer keeps each service sprint reviewable
and green.

| # | Sprint | Layer | Why separate |
|---|---|---|---|
| 1 | Prerequisites — contract additions + auth-middleware extension | *pre-foundation* | `ProductDetailResponseSchema` + `FamilyResponseSchema.productCount?` (plan §8 #1–#2) and `requireAuth`'s new `optional`/`pages` options (plan §7.2–§7.3) must exist before the module and its routes build on them. |
| 2 | Foundation — mapper, interfaces, factories | foundation | Pure Entity⇄DTO transforms, the 3 service contracts + `IInventoryPort`, and contract-shaped test data; no business logic. |
| 3 | Logic A — taxonomy + client-categories | logic | Brands/families/models (disable-only, slugs, featured cap, m2m replace) + categories (unique, in-use guard) + their events — a cohesive, self-contained slice with no inventory coupling. |
| 4 | Logic B — products, pricing, price resolution | logic | Product lists (public/staff/admin), create-with-stock (tx + injected `addLayer`), pricing, images, stats, the reused price resolver + `product.*` events. The heavy slice; split from A to stay reviewable. |
| 5 | API — controller, routes, wiring, inventory stub, integration & conformance | API | HTTP surface + composition root (guards, Multer, route ordering) + inventory port stub + mount + end-to-end/contract proof. |

**Gate rule:** a sprint starts only when the previous one is green and committed. Integration tests
(`test:int`) first run in Sprint 5 (once routes are wired + the test DB is up); every earlier sprint runs
`test:unit` (+ contract conformance).

**Commit style** (per project convention): `git add .` then a short `api: sub-02 sprint N — <topic>`
message (contract-only changes may be a separate `contract:` commit); **no** `Co-Authored-By`.

---

### Sprint 1: Prerequisites — contract additions + auth-middleware extension   — Status: ✅ Done

**Goals**
- Land the two owner-approved contract response shapes and extend the shared `requireAuth` with the
  `optional` and `pages` options the catalog routes depend on — on a green base, before any module code.

**Tasks**
- [x] Impl (contract): add `ProductDetailResponseSchema = ProductWithPricingResponseSchema.extend({ relatedIds: z.array(z.uuid()) })` + `type ProductDetailDto` to `Apps/contract/src/modules/catalog/catalog.dtos.ts`; confirm the catalog barrel re-exports it. (plan §8 #1)
- [x] Impl (contract): add optional `productCount: z.number().int().min(0).optional()` to `FamilyResponseSchema` (populated only when `withCount=true`; omitted otherwise → backward-compatible). (plan §8 #2)
- [x] Impl (middleware): extend `Apps/api/src/common/middlewares/auth.middleware.ts` with `optional?: boolean` — on a missing/invalid token, **skip and call `next()`** (no `req.user`) instead of throwing; keeps the route public while letting the handler read the viewer when a token is present. (plan §7.2)
- [x] Impl (middleware): extend the same `requireAuth` with `pages?: PageKey[]` — after the `type` check, if `pages` is set, load the user's **effective page set** from the DB (ADMIN ⇒ bypass/all; STAFF ⇒ union of enabled roles' pages, reusing identity's `effectivePages` logic) and `ForbiddenError` unless every required page is present. (plan §7.3)
- [x] Test: extend `test/unit/middleware/auth.middleware.spec.ts` — `optional:true` no-token → `next()` with no `req.user`; `optional:true` valid token → `req.user` populated; `pages` present-in-set → pass; missing → 403; ADMIN bypasses `pages`; STAFF without the page → 403.

**Validation**
- [x] Contract: `npm --prefix Apps/contract run validate` green (tsc `--noEmit` + madge cycles + eslint + conformance); the two new/changed schemas parse and the conformance suite still passes.
- [x] API: `npx tsc --noEmit` clean; `npm run lint --no-color` clean.
- [x] `npm run test:unit` green (extended auth-middleware spec + existing suites — 172/172, 18 files).
- [x] No magic strings — `pages` option consumes `PageKey` enum members only; no route touched yet.
- [x] Committed on green (`api: catalog sprint 1 — prerequisites`).

**Report:** [`results-catalog-03/report-sprint-01-03.md`](./results-catalog-03/report-sprint-01-03.md)

---

### Sprint 2: Foundation — mapper, interfaces, factories   — Status: ⬜ Pending

**Goals**
- Pure Entity⇄DTO transformation, the three service contracts + the injected inventory port, and
  contract-shaped test data — no business logic.

**Tasks**
- [ ] Impl: `src/modules/catalog/catalog.mapper.ts` — pure/static `toProductImageDto`, `toProductWithPricingDto(product, priced, viewerFlags)`, `toProductDetailDto` (+`relatedIds`), `toStaffProductDto`, `toAdminProductDto`, `toClientCategoryDto(cat, counts)`, `toBrandDto`, `toFamilyDto(family, productCount?)`, `toDeviceModelDto`, `toProductStatsDto`. `Decimal.toNumber()`, `Date.toISOString()`, `availableQuantity`/`stockStatus` derivation, `familyIds` flatten; **never spreads the entity** (excludes cost/reserved/exact-qty on public+staff DTOs); each `toDto` ends `…ResponseSchema.parse(dto)`. (plan §1, §5.1)
- [ ] Impl: `src/modules/catalog/catalog.interface.ts` — `ICatalogProductService`, `ICatalogTaxonomyService`, `ICatalogCategoryService` (methods per plan §2.1, returning contract DTOs only) + `IInventoryPort` (`addLayer(tx, { productId, quantity, unitCost, type })`). (plan §2.1)
- [ ] Test (factories): `test/data/brand.factory.ts`, `family.factory.ts`, `device-model.factory.ts`, `product.factory.ts`, `product-price.factory.ts`, `client-category.factory.ts` — each returns a valid persistence payload + matching command payload; reuse/extend existing `pos-client`/`client` factories for tier + `inCart` scenarios. (plan §4.1)
- [ ] Test: `test/unit/modules/catalog/catalog.mapper.spec.ts` — each `toDto` parses its schema; **leak assertions** (public/staff carry no `averageCost`/reserved/exact qty); `Decimal→number`, `Date→ISO`, `familyIds` flatten, `stockStatus` thresholds, `availableQuantity` math, `productCount` present only when supplied. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper spec + contract conformance + existing suites).
- [ ] `npm run lint --no-color` clean.
- [ ] Mapper excludes sensitive fields and returns contract DTOs (parses `*ResponseSchema`); interfaces return DTOs, never Prisma entities.
- [ ] Committed on green (`api: catalog sprint 2 — foundation`).

---

### Sprint 3: Logic A — taxonomy + client-categories   — Status: ⬜ Pending

**Goals**
- Stand up `CatalogTaxonomyService` + `CatalogCategoryService` (constructor DI on `PrismaClient`),
  implementing disable-only taxonomy and category rules with their events. Product service is a typed
  stub this sprint.

**Tasks**
- [ ] Impl: create `src/modules/catalog/catalog.service.ts` with `CatalogTaxonomyService implements ICatalogTaxonomyService` and `CatalogCategoryService implements ICatalogCategoryService` co-located; `CatalogProductService` present as **typed stubs that throw `"...not implemented yet (see Sprint 4)"`** so the file compiles its `implements`. (plan §5.1 item 3, §8 #5)
- [ ] Impl (taxonomy): `listBrands`/`listFamilies(q)`/`listModels(q)` (public → **enabled-only**, `withCount` populates `productCount`); admin `createBrand/updateBrand`, `createFamily/updateFamily`, `createModel/updateModel`, `setModelFamilies`. Enforce: unique names (**model unique per brand** → 409 on dup), slug generation, **one nesting level** (reject grandparent), **disable-only** (no deletes), **featured cap 6 enabled** (reject 7th), `MODEL_FAMILIES` **replaces** the `DeviceModelFamily` set. `isKnownRequestError` P2002/P2025 → `ConflictError`/`NotFoundError`. Emit `taxonomy.changed` after commit. (plan §3.4)
- [ ] Impl (categories): `listCategories`, `createCategory` (unique name, creates **no** prices), `updateCategory` (rename + `isEnabled` toggle; **disable requires zero enabled `PosClient` members** → 409 `CATEGORY_IN_USE` + count). `memberCount`/`pricedProductCount` counts. Emit `clientCategory.changed`. (plan §3.5)
- [ ] Test: `test/unit/modules/catalog/catalog.service.spec.ts` (taxonomy+category portion) — mock Prisma via constructor DI + spy `@common/events/event-bus`: enabled-only public lists; disabled brand hidden; duplicate model-in-brand → 409; one-nesting-level rejected; featured 7th → rejected; `MODEL_FAMILIES` replace; category disable with enabled member → 409 `CATEGORY_IN_USE` (+count); create-category makes no prices; `taxonomy.changed`/`clientCategory.changed` emitted on mutation. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (taxonomy+category service tests + prior suites).
- [ ] `npm run lint --no-color` clean.
- [ ] Services throw `AppError` subclasses; emit typed events **after commit**; return DTOs via `.parse()` (never entities); catalog never writes `quantityOnHand`/`quantityReserved`/`averageCost`.
- [ ] Committed on green (`api: catalog sprint 3 — taxonomy and categories`).

---

### Sprint 4: Logic B — products, pricing, price resolution   — Status: ⬜ Pending

**Goals**
- Complete `catalog.service.ts`: the reused price resolver, product lists (public/staff/admin),
  create-with-stock (transaction + injected `addLayer`), pricing update, images, stats, and the
  `product.*` events.

**Tasks**
- [ ] Impl: `CatalogProductService implements ICatalogProductService`; `constructor(prisma, inventory: IInventoryPort)`. Replace the Sprint-3 stubs. (plan §2.1, §5.1)
- [ ] Impl (resolver): the single pure `resolvePrice(product, viewer, categoryPriceMap)` → `{ currentPrice?, guestPrice?, priceHidden }` covering the full matrix (client+tier via `Client.posClientId→PosClient.categoryId`, client no-tier, guest priced, guest null); `inStock = availableQuantity > 0`; `inCart` from `ClientCart` for CLIENT tokens else false. (plan §1.2, §3.1)
- [ ] Impl (reads): `listProducts(q, viewer)` (public, viewer-resolved, paginated via `ProductListQuerySchema` + `paginated()`), `getProduct(id, viewer)` (→ `ProductDetailDto` incl. `relatedIds`), `listStaffProducts` (qty + 4 sale prices, no cost), `listAdminProducts` (full), `productStats` (bucket counts). **`product.searched` emitted only when `search` present AND an authenticated `userId` exists** (staff/admin), never for guests. (plan §3.1, §8 #3)
- [ ] Impl (writes): `createProduct(cmd, images)` in one `$transaction` — inline-create taxonomy on `newXxxName` (else validate `*Id`); generate unique `sku`; **qty=0 rejects pricing (`PRICING_REQUIRES_STOCK`)**, **qty>0 requires cost** → create product then `inventory.addLayer(tx, INITIAL_STOCK)` then persist unlocked pricing; emit `product.created` after commit. `updateProduct` (core fields only). `updatePricing` (upsert `guestPrice` nullable / `defaultSalePrice` / `ProductPrice` rows) → emit `product.repriced`. `addImages`/`updateImages` (store URL/path only). Never writes inventory-owned columns. (plan §3.2, §3.3, §3.6)
- [ ] Test: extend `catalog.service.spec.ts` — price matrix (4 cases); guest DTO leak check; `qty 0 + pricing → 400 PRICING_REQUIRES_STOCK`; `qty>0 no cost → 400`; `qty>0 → addLayer called once with INITIAL_STOCK on the tx` (mock `IInventoryPort`); `product.searched` emitted with `userId` on staff/admin search, **not** guest; `product.created`/`product.repriced` emitted. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (full service spec + prior suites).
- [ ] `npm run lint --no-color` clean.
- [ ] `createProduct` is transactional and calls the injected port in-tx; storefront DTOs leak no cost/reserved/exact qty/margin; every method returns a `.parse()`d DTO.
- [ ] Committed on green (`api: catalog sprint 4 — products and pricing`).

---

### Sprint 5: API — controller, routes, wiring, inventory stub, integration & conformance   — Status: ⬜ Pending

**Goals**
- Expose the HTTP surface, wire the composition root (guards, Multer, route ordering, inventory port
  stub), mount the router, and prove the module end-to-end + against the contract.

**Tasks**
- [ ] Impl: `src/modules/catalog/catalog.controller.ts` — thin; `try/catch → next(error)`; reads `req.validated` + optional viewer from `req.user`; multipart create/images read `req.files` (Multer); `sendSuccess` (`201` create, `200` read/update). (plan §5.1 item 5)
- [ ] Impl: `src/modules/catalog/inventory.port.stub.ts` — minimal `IInventoryPort` skeleton performing the `INITIAL_STOCK` layer insert on the passed `tx` (one-line swap for the inventory module's exported singleton once it lands). (plan §7.1)
- [ ] Impl: `src/modules/catalog/catalog.routes.ts` — composition root: instantiate the three services (product service gets `prisma` + the inventory port) + controller; register every route via `CATALOG_ROUTES` constants with `validateRequest` per segment + guards from the map (plan §5.1); `requireAuth({ optional:true })` on `PRODUCTS`/`PRODUCT_DETAIL`; `requireAuth({ types:[STAFF,ADMIN], pages:[STAFF_PRODUCTS], checkDB:true })` on `STAFF_PRODUCTS`; admin guard elsewhere; Multer on multipart routes. **Register `PRODUCT_STATS` before `ADMIN_PRODUCT_BY_ID`** (else `/admin/products/stats` matches `:id`). `export { router }`. (plan §5.1, §5.1 ordering note)
- [ ] Impl (wiring): add `catalogRouter` to `src/modules/index.ts` `registerModules` at the EXTENSION POINT. (plan §6)
- [ ] Test: `test/integration/catalog.integration.spec.ts` (real test DB, envelope asserted) — guest `/products` leak check; disabled brand hidden in `/brands` but its product's `/products/:id` still resolves; `POST /admin/products` qty>0 creates the FIFO layer (assert via inventory read) + unlocks pricing; `PATCH pricing` → `product.repriced`; category disable with an enabled POS member → 409; `staff/products` 403 without the page / 200 with it or as admin; `optional` auth on `/products` (guest vs CLIENT pricing differ). Auth via `auth.fixture`. (plan §4.3)
- [ ] Test: extend `test/contract/routes.conformance.spec.ts` — every catalog response parses its `*ResponseSchema`; every registered route uses a `CATALOG_ROUTES` constant. (plan §4.4)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint --no-color` clean.
- [ ] `npm run test:unit` green (incl. conformance).
- [ ] `npm run test:int` green against the test DB (routes wired, module mounted).
- [ ] Routes use `CATALOG_ROUTES` constants only (no string literals); all responses go through `sendSuccess`; `PRODUCT_STATS` precedes `ADMIN_PRODUCT_BY_ID`; guards match the plan's map.
- [ ] Committed on green (`api: catalog sprint 5 — api and wiring`).

---

## Definition of done (module) — ⬜ Pending

- `Apps/api/src/modules/catalog/` has the 5 core files (mapper, interface, service, controller, routes) —
  **no listener** — plus the local `inventory.port.stub.ts`; `catalogRouter` mounted via `registerModules`.
- Contract additions (`ProductDetailResponseSchema`, `FamilyResponseSchema.productCount?`) landed and
  conformance-covered; `requireAuth` extended with `optional` + `pages` and unit-tested.
- Every service method returns a `.parse()`d DTO; `Decimal→number` + `Date→ISO` at every boundary;
  storefront leaks no cost/reserved/exact qty/margin.
- Price resolution honours the full matrix; product creation is transactional (qty=0 rejects pricing;
  qty>0 requires cost + creates the first FIFO layer via the injected port in-tx); catalog never writes
  inventory-owned columns.
- Taxonomy disable-only (unique model-per-brand, featured cap 6, m2m replace); categories unique with the
  in-use disable guard; all five `CatalogEvents` emit after commit (`product.searched` on staff/admin
  search only).
- Unit + integration + conformance suites green; each sprint committed on green in order.
