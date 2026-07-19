# Catalog — Sprint 5 Report: API — controller, routes, wiring, inventory stub, integration & conformance

**Status:** ✅ Done — [`sprints-catalog-03.md`](../sprints-catalog-03.md) Sprint 5 marked ✅. **All 5 sprints
of `plan-catalog.md` are now complete.**

---

## Interface gap found and fixed while wiring routes

`ADMIN_PRODUCT_BY_ID`'s GET (`/api/admin/products/:id`) needs a handler, but `ICatalogProductService`
had no public single-product-by-id method for admins — only a **private** `getAdminProductById` helper
used internally after mutations. **Made it public as `getAdminProduct(id)`** and added it to the
interface; switched its lookup from `findUniqueOrThrow` to `findUnique` + an explicit `NotFoundError`
(cleaner 404 than translating a raw P2025). Updated the 3 Sprint-4 tests that referenced the old
`findUniqueOrThrow` mock accordingly — all still green.

---

## What was implemented

### `Apps/api/src/modules/catalog/catalog.controller.ts` (new)
Thin; every handler `try/catch → next(error)`, reads `req.validated`, reads the optional viewer from
`req.user`, responds via `sendSuccess`. Multipart handlers (`createProduct`, `addImages`) read
`req.files` through a small `filesOf(req)` helper (Multer only populates `req.files` on `.array(...)`
routes; every other route never sets it). Public/admin/staff variants of the taxonomy list endpoints
are separate controller methods (`listBrands` vs `listAdminBrands`, etc.) that call the **same** service
method with a different `includeDisabled` argument.

### `Apps/api/src/modules/catalog/inventory.port.stub.ts` (new)
Satisfies `IInventoryPort` since the inventory module doesn't exist yet (plan §7.1, owner-decided:
"assume inventory is built"). A real implementation would write an attributed `StockMovement` FIFO-layer
row, but `addLayer`'s signature carries no acting-staff identity (that's the inventory module's own
concern to design) — so the stub instead applies the **same net effect directly** to the two columns
inventory owns (`quantityOnHand`, `averageCost`) on the passed `tx`, keeping `createProduct`'s result
materially correct end-to-end without inventing FIFO/staff-attribution logic that isn't this sprint's to
build. One-line swap for the inventory module's real exported singleton once it lands.

### `Apps/api/src/modules/catalog/catalog.routes.ts` (new) — composition root
- Manual DI: `InventoryPortStub` → `CatalogProductService(prisma, inventory)`,
  `CatalogTaxonomyService(prisma)`, `CatalogCategoryService(prisma)` → `CatalogController(...)`.
- **Multer**: unlike platform's `FEES_IMPORT` (memory storage — the file is parsed once and discarded),
  product images must persist with a stable, servable URL, so this module's `uploadImages` uses
  **`diskStorage`** (`uploads/`, random-UUID filenames, `image/*` MIME filter, 5MB limit). `mkdirSync`
  ensures the directory exists at startup. No upload-size env knob exists yet
  (`env-template.md` lists only `AWS_*`) — an in-code constant, per the plan §7.4-recommended default;
  the actual storage backend (local vs S3) is still the open item for the owner.
- **Guards** — `requireAuth({ optional: true })` on `PRODUCTS`/`PRODUCT_DETAIL` (token shapes data,
  never gates); `requireAuth({ types: [STAFF, ADMIN], pages: [PageKey.STAFF_PRODUCTS], checkDB: true })`
  on `STAFF_PRODUCTS` — the **first page-gated route in the codebase**; `requireAuth({ types: [ADMIN],
  checkDB: true })` everywhere else admin-only; `requireAuth({ types: [STAFF, ADMIN], checkDB: true })`
  on `CATEGORIES`.
- **Route ordering**: `PRODUCT_STATS` registered before `ADMIN_PRODUCT_BY_ID`, with a comment explaining
  why (`:id` would otherwise swallow `"stats"`).
- Every route uses a `CATALOG_ROUTES` constant + `validateRequest` per segment; no string literals.

### Wiring
`Apps/api/src/modules/index.ts` — added `catalogRouter` to `registerModules`.

### `Apps/api/test/data/` — the two factories deferred from Sprint 2
- `pos-client.factory.ts` — `seedPosClient({ categoryId?, isEnabled? })`.
- `client.factory.ts` — `seedClientUser({ wilayaId, communeId, posClientId? })`, a minimal
  self-contained `User(type=CLIENT) + Client` pair for this module's own tests (the real
  registration/approval flow is the not-yet-built clients module's job — this factory doesn't attempt
  to model it).

### Tests
- **`test/integration/catalog.integration.spec.ts`** (new, 10 tests, real Postgres) — guest `/products`
  leak check (schema-parsed); disabled brand hidden from `/brands` but its product still resolves via
  `/products/:id`; guest vs. tiered-CLIENT `currentPrice` differs for the same product (the `optional`
  guard exercised for real); `POST /admin/products` with `initialQuantity>0` reflects the stub's
  `quantityOnHand`/`averageCost` in the response and unlocks `guestPrice` (**adapted from the plan's
  "assert via inventory read"** — no inventory module/read-endpoint exists yet, so the created
  `AdminProductDto`'s stock fields are the available proxy); `PATCH pricing` updates and emits
  `product.repriced` (via `vi.spyOn(eventBus, 'emit')`); category disable 409s with an enabled
  `PosClient` member; `STAFF_PRODUCTS` 403 without the page, 200 with it, 200 as ADMIN regardless; and a
  real authenticated route-ordering check (`GET /admin/products/stats` returns the stats shape, not a
  uuid-param 400).
- **`test/contract/routes.conformance.spec.ts`** (extended, +1 test) — a `describe` block mirroring the
  identity/platform/observability precedent: every **guarded** `CATALOG_ROUTES` path resolves on `app`
  DB-free (unauthenticated `requireAuth` — including the `pages` check — short-circuits before any
  Prisma call). Public/optional-viewer routes (`BRANDS`/`FAMILIES`/`MODELS`/`PRODUCTS`/`PRODUCT_DETAIL`)
  are excluded from this block for the same reason platform's public routes are: they'd hit the real DB
  unauthenticated, breaking this tier's DB-free promise — covered instead by the integration suite. I
  initially wrote (then removed) a DB-free "route-ordering" assertion here — it turned out unable to
  actually distinguish the two routes, since both share the identical `adminOnly` guard that 401s before
  either route's `validateRequest` ever runs on a missing token; the real, meaningful check is the
  integration test above.

---

## Validation

| Check | Result |
|---|---|
| API: `npx tsc --noEmit` | ✅ clean |
| API: `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (226 tests / 20 files, incl. the extended conformance suite) | ✅ green |
| `npm run test:int` (re-pointed at the sandbox's ephemeral Postgres, same constraint as every prior sprint's real-DB check — port 5433 from `docker-compose.test.yml` isn't reachable here) | ✅ 55/55 green (45 pre-existing + 10 new) |
| Routes use `CATALOG_ROUTES` constants only (no string literals); every response goes through `sendSuccess`; `PRODUCT_STATS` precedes `ADMIN_PRODUCT_BY_ID`; guards match the plan's map | ✅ |

---

## Deferred / flagged (not blocking, tracked)

- **Storage backend** (local disk vs S3) remains the owner's open decision (plan §7.4); this sprint
  picked local `diskStorage` as the interim, functioning default.
- **Inventory port**: `InventoryPortStub` is a deliberate simplification (direct column update, no
  `StockMovement`/FIFO/staff-attribution) — swapped for the real inventory module's export once it's
  built, per the owner's "assume inventory is built" decision from `/next`.
- `Apps/api/uploads/` is a real runtime artifact directory (created by `mkdirSync` on module load,
  including during test runs) — added to the root `.gitignore` rather than committed.

---

## Module definition of done — ✅ all criteria met

- `Apps/api/src/modules/catalog/` has the 5 core files (mapper, interface, service, controller, routes)
  — no listener — plus `inventory.port.stub.ts`; `catalogRouter` mounted via `registerModules`.
- Contract additions (`ProductDetailResponseSchema`, `FamilyResponseSchema.productCount?`) landed in
  Sprint 1 and are conformance-covered; `requireAuth` extended with `optional` + `pages`, unit-tested.
- Every service method returns a `.parse()`d DTO; `Decimal→number`/`Date→ISO` at every boundary;
  storefront leaks nothing (verified in both unit and integration tests).
- Price resolution honours the full matrix (unit-tested with all 4 cases; integration-tested for guest
  vs. tiered CLIENT); product creation is transactional with the injected port called in-tx; catalog
  never writes `quantityOnHand`/`quantityReserved`/`averageCost` directly (only the stub/inventory does).
- Taxonomy disable-only, unique model-per-brand, featured cap 6, `MODEL_FAMILIES` replace — all
  unit-tested; disabled-brand-but-product-still-resolves integration-tested.
- Categories: unique name, in-use disable guard (409 `CATEGORY_IN_USE` + count) — unit- and
  integration-tested.
- All five `CatalogEvents` emit after commit; `product.searched` only from staff/admin search.
- Unit (226) + integration (55, full suite) + conformance (6) all green; 5 sprints, 5 commits, in order.

---

## Commit

`git add .` then `git commit -m "api: catalog sprint 5 — api and wiring"`.
