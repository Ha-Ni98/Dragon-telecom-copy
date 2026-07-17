# Sprint 2 — Catalog

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/catalog/`** — new module, 6 content files + barrel (plan C / spec `catalog.md` + `database-description.md` §4 reconciliation):
  - `catalog.enums.ts` — `StockStatus { IN_STOCK='in_stock', LOW_STOCK='low_stock', OUT_OF_STOCK='out_of_stock' }`.
  - `catalog.routes.ts` — `CATALOG_ROUTES` (20 constants; `ADMIN_TAXONOMY`'s `{brands|families|models}` template split into three concrete resource groups per rules §3.4).
  - `catalog.command.ts` — `CreateProductCommand` (5 cross-field `.refine()`s: familyId/newFamilyName XOR, brandId/newBrandName XOR, modelId/newModelName mutual exclusion, `initialUnitCost` required iff `initialQuantity>0`, pricing fields forbidden iff `initialQuantity===0`), `UpdateProductCommand`, `UpdatePricingCommand` (`guestPrice` nullable), brand/family/model create+update pairs, `SetModelFamiliesCommand`, `AddProductImagesCommand`/`UpdateProductImagesCommand` (metadata only — file bytes are multipart, outside Zod), `CreateClientCategoryCommand`/`UpdateClientCategoryCommand`.
  - `catalog.query.ts` — `ProductListQuery`, `FamiliesQuery`, `ModelsQuery`, and the five `*IdParams`.
  - `catalog.dtos.ts` — `ProductImageDto`, `ProductWithPricingDto` (public), `StaffProductDto`, `AdminProductDto`, `ClientCategoryDto`, `BrandDto`, `FamilyDto`, `DeviceModelDto`, `ProductStatsDto`.
  - `catalog.events.ts` — `CatalogEvents` map: `product.created`, `product.repriced`, `taxonomy.changed`, `clientCategory.changed`, `product.searched`.
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/catalog'`.

## Database-description reconciliation (Sprint 2's explicit task)

`catalog.md` line 47 defers `BrandDto`/`FamilyDto`/`DeviceModelDto` to "the DB description." Cross-checked against `database-description.md` §4:
- **`BrandDto`** and **`DeviceModelDto`** matched the plan's sketch exactly — no changes.
- **`FamilyDto`** was missing `isUniversal` (a real, non-sensitive `Family` column: `isUniversal boolean` — marks a family as containing model-less/universal parts). Added it. It has no write path in any command in `catalog.md` (create/update family commands never mention it), so it's read-only in this contract; flagged below.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`ProductSort` enum dropped — plan deviation.** The plan sketched a `ProductSort` enum, but `catalog.md`'s `ProductListQuery { …; sort?; … }` gives no enumerated values anywhere in the spec or the DB description. Inventing sort keys (`'newest'`, `'price_asc'`, …) would be fabricated API surface, not a spec-derived one. `sort` is modelled as `z.string().optional()` instead; the report flags this as an open item for whoever defines the actual sort keys (likely a frontend/backend integration decision, not a contract one).
2. **`isUniversal` on `FamilyDto` has no command write path.** Neither `CreateFamilyCommand` nor `UpdateFamilyCommand` exposes it in `catalog.md`, yet it's a real schema column surfaced by the DB description. Included as DTO-only (display) per this sprint's explicit reconciliation task; not added to the commands since no source authorizes writing it. Flagged for the backend stage to confirm whether it's seed-only or needs a write path added later.
3. **`UpdateClientCategoryCommand` includes `isEnabled`.** `catalog.md`'s route table annotates `CATEGORIES_CUD` as "**name only**," but the Shared Conventions section repeated verbatim in every module spec states "No delete endpoints — `isEnabled` PATCH toggles" as a contract-wide rule. Read "name only" as scoping what a category *creates*/*holds* (no other business data, no prices), not as overriding the universal enable/disable mechanism every other module relies on. `CreateClientCategoryCommand` stays `{ name }` only, matching the literal "name only" note for creation.
4. **`AdminProductDto` includes `sku`.** Never listed in any DTO field-list line, but `Product.sku` is a real `@unique` column with no schema default — meaning it must be shown to admins somewhere (they need to search/identify by it), and it's not sensitive. Added to the admin view only, consistent with rules §5.E's "build field-by-field" guidance.
5. **`UpdateProductCommand`, brand/family/model image-metadata commands, and four of five `catalog.events.ts` payloads are minimally inferred** — `catalog.md` names them without full field lists (mirrors the pattern already flagged in Sprint 1 for `identity.events.ts`). Modelled as narration-friendly minimal payloads (`{ productId; name }` etc.), consistent with the audit module's stated "one narrated string" consumption pattern. Flagged for backend-stage confirmation once real listener needs are known.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (19 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged — no catalog tests added, out of scope) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `createdAt: z.iso.datetime()` in `ProductWithPricingDto`/`AdminProductDto`; no other dates in this module |
| No sensitive field in any DTO | ✅ — `averageCost`/`quantityOnHand`/`quantityReserved` appear only in `AdminProductResponseSchema`; public (`ProductWithPricingDto`) and staff (`StaffProductDto`) schemas carry neither cost nor exact quantities, matching the spec's leak-boundary rule |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 2 — catalog`.
