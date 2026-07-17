# Catalog — Sprint 2 Report: Foundation — mapper, interfaces, factories

**Status:** ✅ Done — [`sprints-catalog-03.md`](../sprints-catalog-03.md) Sprint 2 marked ✅.

---

## Owner decision taken mid-sprint (asked before implementing — a genuine schema-vs-contract conflict)

While typing `catalog.mapper.ts`'s `ProductWithRelations`, discovered that `Product` in
`schema.prisma` has **no direct `brandId`** — brand was only reachable through the optional
`deviceModel` relation (`deviceModelId: String? // null = universal part`). But the contract already
modelled brand as **independent** of model: `CreateProductCommand`'s `brandId|newBrandName` is a
required top-level XOR pair, separate from the optional `modelId|newModelName`, and all three product
DTOs (`ProductWithPricingDto`, `StaffProductDto`, `AdminProductDto`) declare `brand` **required** while
`model` is optional. A universal part (no `deviceModel`) would have had no way to resolve a brand at all
— a genuine schema-vs-contract conflict, not a HOW gap, so I stopped and asked rather than picking
silently.

**Decision (owner-approved): add `Product.brandId`/`brand`** — a required, direct relation to `Brand`,
independent of `deviceModelId` — matching the contract's existing intent with **zero contract change**.

### What changed as a result
- `Apps/api/prisma/schema.prisma`: `Product` gained `brandId String` + `brand Brand @relation(...)`;
  `Brand` gained the reverse `products Product[]`.
- New migration `20260717191021_product_brand_id` (`ALTER TABLE "Product" ADD COLUMN "brandId" TEXT NOT
  NULL` + FK) — safe because the `Product` table was empty (no products module has ever written to it).
  Applied to **both** the dev and test databases in this sandbox's ephemeral Postgres.
- `plan-catalog.md` §0 updated with a note recording the gap and the fix (see the plan file).
- `test/unit/modules/observability/observability.mapper.spec.ts`'s `buildProduct` fixture needed
  `brandId: 'brand-1'` added — pre-existing fallout from the schema change, unrelated to this sprint's
  own scope but required for `tsc --noEmit` to stay clean.

---

## What was implemented

### `Apps/api/src/modules/catalog/catalog.interface.ts`
- `Viewer = JWTPayload | undefined` (guest vs authenticated, for `optional`-guarded routes).
- `ICatalogProductService`, `ICatalogTaxonomyService`, `ICatalogCategoryService` — full method sets per
  `plan-catalog.md` §2.1, all returning contract DTOs.
- `IInventoryPort` — the injected seam (`addLayer(tx, { productId, quantity, unitCost, type })`),
  dependency-inverted so catalog doesn't hard-import the not-yet-built inventory module.

### `Apps/api/src/modules/catalog/catalog.mapper.ts`
- `toProductImageDto`, `toProductWithPricingDto` (+ public leak guard: no cost/reserved/exact
  qty/margin), `toProductDetailDto` (extends the public DTO with `relatedIds`), `toStaffProductDto`
  (availableQuantity + 4 sale prices, no cost), `toAdminProductDto` (full visibility, derives
  `stockStatus`), `toClientCategoryDto`, `toBrandDto`, `toFamilyDto` (optional `productCount`),
  `toDeviceModelDto` (flattens `familyIds`), `toProductStatsDto`.
- Two small pure helpers made **public** (mirrors identity's public `effectivePages` precedent, since
  the service will call them directly without building a full DTO): `availableQuantity` and
  `deriveStockStatus`.
- Every `toDto` ends `…ResponseSchema.parse(dto)`; money fields convert via a private `toMoney`
  (`Prisma.Decimal | number → number`), matching platform's `Money` type precedent.

### Factories (`Apps/api/test/data/`)
- `brand.factory.ts`, `family.factory.ts`, `device-model.factory.ts`, `product.factory.ts`,
  `product-price.factory.ts`, `client-category.factory.ts` — each with a `create*Payload` (schema-parsed
  command) and a `seed*` (real Prisma persistence) function, following the `role.factory.ts`/
  `delivery-fee.factory.ts` pattern. Unique-constrained text fields (brand/family/category name+slug,
  product sku) get a random suffix to avoid cross-test collisions.
- **Deferred (not blocking):** `client.factory.ts`/`pos-client.factory.ts` for the price-resolution tier
  scenarios — nothing in Sprint 2's own tests needs them (the mapper takes pre-resolved `priced`/`viewer`
  flags, not raw `Client`/`PosClient` rows). They're real Prisma-mocked inputs in Sprint 4's service unit
  tests and only need real seeding in Sprint 5's integration tests, so adding them now would be unused
  code. Flagged for Sprint 5.

### Tests (`Apps/api/test/unit/modules/catalog/catalog.mapper.spec.ts`)
- 25 tests: schema-parse conformance for every DTO; leak assertions (public/staff DTOs carry no
  `averageCost`/`quantityOnHand`/`quantityReserved`/`sku`); `Decimal → number`; `Date → ISO`; universal
  part (`model: null`) omits `model`; `familyIds` flatten; `stockStatus` thresholds (all three buckets);
  `availableQuantity` math; `productCount` present only when supplied.
- Fixture builders mirror `identity.mapper.spec.ts`'s `build*` style; money fields use real
  `new Prisma.Decimal(...)` instances (the mapper's `ProductWithRelations` type is the actual generated
  `Product` type, not a loosened `number`-accepting alias) and every `z.uuid()`-typed id field uses a
  real UUID literal (the schemas reject non-UUID strings).

---

## Validation

| Check | Result |
|---|---|
| API: `npx tsc --noEmit` | ✅ clean |
| API: `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (197 tests / 19 files, incl. 25 new mapper tests) | ✅ green |
| Contract: `npm --prefix Apps/contract run validate` | ✅ green (unchanged this sprint) |
| `npm run test:int` (re-pointed at the sandbox's ephemeral Postgres — real `docker-compose.test.yml` DB on port 5433 isn't reachable here, same pre-existing constraint noted in Sprint 1's report) | ✅ 45/45 green against **both** databases post-migration |
| Mapper excludes sensitive fields and returns contract DTOs (parses `*ResponseSchema`); interfaces return DTOs, never Prisma entities | ✅ |
| Migration applied to dev **and** test DB, verified via the full pre-existing integration suite passing unchanged | ✅ |

---

## Deferred / flagged (not blocking, tracked)

- `client.factory.ts`/`pos-client.factory.ts` — deferred to Sprint 5 (see above).
- The service layer (Sprints 3–4) will consume `product.brandId` directly instead of the previous
  (incorrect) assumption of deriving brand through `deviceModel`.

---

## Commit

`git add .` then `git commit -m "api: catalog sprint 2 — foundation"` (the schema/migration fix lands in
the same commit as the foundation files it unblocks — both are small and tightly coupled to this
sprint's own work, not worth splitting into a separate commit).
