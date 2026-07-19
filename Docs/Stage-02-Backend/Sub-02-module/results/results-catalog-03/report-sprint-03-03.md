# Catalog — Sprint 3 Report: Logic A — taxonomy + client-categories

**Status:** ✅ Done — [`sprints-catalog-03.md`](../sprints-catalog-03.md) Sprint 3 marked ✅.

---

## What was implemented

### `Apps/api/src/modules/catalog/catalog.service.ts` (new)
- **`CatalogTaxonomyService implements ICatalogTaxonomyService`**
  - `listBrands`/`listFamilies`/`listModels` — enabled-only by default (`includeDisabled` omitted, the
    public-route case); `includeDisabled: true` (admin management routes) drops the `isEnabled` filter.
    `listFamilies` always fetches `_count.products` (a single static `include`, no conditional-shape
    typing gymnastics) and only surfaces it as `productCount` when `query.withCount` is set.
  - `createBrand`/`updateBrand`, `createFamily`/`updateFamily`, `createModel`/`updateModel`,
    `setModelFamilies` — slugs generated from `name` via a small module-local `slugify` (no slug is
    ever client-supplied); P2002/P2025 mapped to `ConflictError`/`NotFoundError` via a module-local
    `isKnownRequestError` (mirrors identity's exact pattern, duplicated per-module by existing
    convention, not shared).
  - **One family nesting level**: `assertOneNestingLevel` loads the target parent and 400s if *it*
    already has a `parentId` (a grandparent would result).
  - **Featured cap (6 enabled)**: `assertFeaturedCapacity` counts `isFeatured && isEnabled` rows
    (optionally excluding the row being updated) and 409s (`FEATURED_FAMILIES_LIMIT_REACHED`) at 6. On
    `updateFamily`, the check only re-runs when the *resulting* state transitions into
    enabled-and-featured from something else — re-enabling an already-featured-but-disabled family is
    exactly the case that can silently blow the cap, so it's covered, not just the create path.
  - `setModelFamilies` replaces the whole `DeviceModelFamily` set inside `$transaction([deleteMany,
    createMany])` — `createMany` is skipped when `familyIds` is empty (Prisma rejects an empty `data`
    array for arrays passed straight to `$transaction`, not a defensive add-on: the array form doesn't
    execute lazily like `Promise.all`, so an empty `createMany` would still be issued as a query and can
    error on some drivers — cheaper to just omit it than special-case the error).
  - Model uniqueness comes for free from the schema's `@@unique([brandId, name])` — no extra query
    needed, matching the "duplicate model in brand → 409" test scenario.
- **`CatalogCategoryService implements ICatalogCategoryService`**
  - `createCategory` — no price rows created (spec BL#5); skips the two count queries entirely since a
    fresh category is always `{ memberCount: 0, pricedProductCount: 0 }`.
  - `updateCategory` — disabling counts **enabled** `PosClient` members first; 409 `CATEGORY_IN_USE` +
    the count if any exist, before the update ever runs.
  - `memberCount` on every returned DTO counts **enabled** `PosClient` rows specifically — the same
    population the disable-guard checks, so the number shown always matches what would block a disable.
- **`CatalogProductService implements ICatalogProductService`** — every one of the 10 interface methods
  is a one-line stub (`return this.notImplemented('methodName')`) via a shared private `notImplemented`
  helper, mirroring identity's Sprint-3 precedent exactly. This exists solely so the file compiles its
  `implements` clause; Sprint 4 replaces every stub body.

### Tests (`Apps/api/test/unit/modules/catalog/catalog.service.spec.ts`, new — 15 tests)
Mocks `PrismaClient` via constructor DI (no `@common/db/prisma` mock) + spies `@common/events/event-bus`,
following `identity.service.spec.ts`'s exact conventions (a `prismaKnownError` helper building real
`Prisma.PrismaClientKnownRequestError` instances, per the Prisma-mocking house rule). Covers: enabled-only
public lists vs `includeDisabled` admin lists; `taxonomy.changed` emitted on brand create; P2002 → 409 on
brand/model/category name collisions; two-level nesting rejected, one-level accepted; featured cap
rejects the 7th and allows the 6th; `setModelFamilies` issues `deleteMany` then `createMany` with the
exact replacement set and 404s on a missing model; category create skips the count queries; category
disable 409s with enabled members and succeeds with zero.

---

## Validation

| Check | Result |
|---|---|
| API: `npx tsc --noEmit` | ✅ clean |
| API: `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (212 tests / 20 files, incl. 15 new service tests) | ✅ green |
| Services throw `AppError` subclasses; emit typed events after the mutating call resolves; return DTOs via `.parse()` (never entities) | ✅ |
| Catalog never writes `quantityOnHand`/`quantityReserved`/`averageCost` (not touched anywhere in this sprint's code) | ✅ |

`test:int` not re-run — no route wiring changed this sprint (routes.ts doesn't exist yet); deferred to
Sprint 5 per the sprint plan's gate rule.

---

## Deferred / flagged (not blocking, tracked)

- `CatalogProductService`'s 10 stub methods and the shared `notImplemented` helper are replaced in
  Sprint 4 — unlike identity's leftover `notImplemented` (still dead code in `identity.service.ts` after
  its own Sprint 4), this one is fully removed once Sprint 4 lands real implementations, since nothing
  will call it anymore.
- Two different taxonomy names slugifying to the same value (e.g. "Pixel!" / "Pixel?" → `pixel`) simply
  409s via the DB's slug unique constraint like any other collision — no retry/suffix logic added, since
  the spec's Test Scenarios don't call for it and it isn't a case that can practically arise from the
  admin's own inline-create UI.

---

## Commit

`git add .` then `git commit -m "api: catalog sprint 3 — taxonomy and categories"`.
