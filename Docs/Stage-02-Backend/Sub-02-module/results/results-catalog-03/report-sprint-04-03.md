# Catalog — Sprint 4 Report: Logic B — products, pricing, price resolution

**Status:** ✅ Done — [`sprints-catalog-03.md`](../sprints-catalog-03.md) Sprint 4 marked ✅.

---

## Fix carried over from Sprint 2 (discovered while writing this sprint's queries)

`catalog.mapper.ts`'s internal `ProductWithRelations` type used a field named `model` for the
optional device-model relation, but Prisma's actual relation field on `Product` is named
`deviceModel`. Sprint 2's hand-built test fixtures never surfaced this (they construct the object
directly, so any field name works), but writing this sprint's real `include: { deviceModel: true }`
queries would have forced a rename/translation step in every single service method. **Renamed the
mapper-internal field to `deviceModel`** (matching Prisma exactly) in `catalog.mapper.ts` and
`catalog.mapper.spec.ts`'s fixture — the DTO's own output field is still `model` (contract-mandated,
unchanged); only the *input* type changed. Re-ran the full mapper suite to confirm no regression
(still 25/25 green).

---

## What was implemented

### `Apps/api/src/modules/catalog/catalog.service.ts` — `CatalogProductService` (was a Sprint-3 stub)

- **Price resolution** (`resolvePricing`, private) — the one function reused across the storefront
  paths: tier price (from a pre-loaded `Map<productId, price>`) → else the product's own `guestPrice`;
  `priceHidden` is `currentPrice == null`. `guestPrice` on the DTO is always the raw entity value
  (informational), independent of the resolved `currentPrice` — both can appear together (matches the
  contract's two independently-optional fields).
- **`listProducts`** — public, `isEnabled && isPublished` only; viewer-resolved via
  `resolveViewerContext` (CLIENT → `Client.posClientId → PosClient.categoryId`, else `{}` for
  guest/staff/admin) + batched `ProductPrice`/`ClientCart` lookups (one query each per page, not
  per-row). `inStock` is exact (`onHand - reserved > 0`); the `inStock=true` **filter** is approximated
  as `quantityOnHand: { gt: 0 }` since no module writes `quantityReserved` yet and Prisma can't express
  a same-row two-column comparison without raw SQL — flagged, not silently done.
- **`getProduct`** — same `isEnabled && isPublished` gate (404 otherwise); adds `relatedIds` = up to 6
  other enabled+published products in the same family, newest first (the spec's "+ related ids" has no
  stated selection rule, so this is the simplest defensible one — flagged in the plan already, §8 #1).
- **`listStaffProducts`** — enabled products only, **no viewer-tier filtering** (staff serve every
  client), so the 4 sale prices come from a direct `prices: { include: { category: true } }` join, not
  the storefront resolver.
- **`listAdminProducts`** — unrestricted, full `AdminProductDto`.
- **`createProduct`** — single `$transaction`: resolves/creates brand (`brandId` or `newBrandName`),
  family (same pattern), and model (`modelId` — validated to belong to the resolved brand, or
  `newModelName`, or neither); generates a `sku` (not client-suppliable); creates the `Product` row
  (stock columns left at their schema defaults); if `initialQuantity > 0`, calls
  **`inventory.addLayer(tx, { productId, quantity, unitCost, type: INITIAL_STOCK })`** — the injected
  port, inside the same tx, so the first FIFO layer commits atomically with the product row; persists
  `categoryPrices`/inline image attachments if given. Emits `product.created` **after** commit.
  Catalog never sets `quantityOnHand`/`quantityReserved`/`averageCost` directly — only the injected port
  does (spec BL#6).
- **`updateProduct`** — core fields only (`barcode`/`name`/`description`/`reorderThreshold`/
  `isPublished`/`isEnabled`). **Emits nothing** — the spec's Events list names exactly five emitted
  events for this module (`product.created`, `product.repriced`, `taxonomy.changed`,
  `clientCategory.changed`, `product.searched`); a plain core-field edit isn't one of them, so this is a
  confirmed omission, not a gap.
- **`updatePricing`** — upserts `guestPrice` (`null` clears/hides, `undefined`/omitted leaves untouched
  — the two are handled with `!== undefined`, deliberately not `!= null`, since both `null` and
  "unset" are meaningfully different states here) / `defaultSalePrice` / `categoryPrices[]`
  (per-row `upsert` on `(productId, clientCategoryId)`, leaving unmentioned rows untouched — a partial
  PATCH, not a full replace like `setModelFamilies`). Emits `product.repriced`.
- **`addImages`** / **`updateImages`** — rules §5 "store path/URL only": the service takes whatever
  path Multer's disk storage already wrote (`file.filename`) and persists `/uploads/${filename}` as the
  `ProductImage.url`; it makes no storage-backend decision itself (local vs S3 remains the open infra
  item flagged in the plan §7.4). `addImages` 400s if the file count doesn't match the metadata array
  length (a real positional-pairing correctness check, not defensive bloat).
- **`productStats`** — fetches `{quantityOnHand, quantityReserved, reorderThreshold}` for every product
  and reduces bucket counts in application code (no raw SQL for the same cross-column comparison
  `listProducts`'s `inStock` filter can't express natively) — reasonable at this catalog's scale (a
  single store's parts inventory, not a marketplace).
- **`product.searched`** (private `emitProductSearched`) — fires only from `listStaffProducts`/
  `listAdminProducts` when `query.search` is set and a `viewer` exists; **never** from the public
  `listProducts`, matching the spec's "fired by staff/admin list searches" exactly (a guest or logged-in
  CLIENT browsing the storefront never triggers it).

### Tests (`catalog.service.spec.ts`, extended — 13 new tests)
Price-resolution matrix (all 4 cases from the plan's table); a guest-listing leak check
(no cost/reserved/exact-qty/`sku`); `product.searched` emitted with `userId` on a staff search and
**not** emitted on a guest storefront search; `createProduct` calls `inventory.addLayer` exactly once
with `INITIAL_STOCK` on the shared `tx` when `initialQuantity > 0`, and never when `0`; a
contract-enforcement regression pair proving `CreateProductSchema` still rejects
`initialQuantity=0`+pricing and `initialQuantity>0` without cost (the service intentionally doesn't
re-check these — it trusts the validated command, per the rules' data-flow diagram — so this pins down
that the schema itself, not the service, is what has to keep rejecting them); `updatePricing` emits
`product.repriced` and 404s on a missing product.

---

## Validation

| Check | Result |
|---|---|
| API: `npx tsc --noEmit` | ✅ clean |
| API: `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (225 tests / 20 files, incl. 13 new product-service tests) | ✅ green |
| `createProduct` is transactional and calls the injected port in-tx; storefront DTOs leak no cost/reserved/exact qty/margin; every method returns a `.parse()`d DTO | ✅ |

`test:int` not re-run — no route wiring changed this sprint (`catalog.routes.ts` doesn't exist yet);
deferred to Sprint 5 per the sprint plan's gate rule.

---

## Deferred / flagged (not blocking, tracked)

- `listProducts`'s `inStock=true` filter is an approximation (`quantityOnHand > 0`, ignoring
  `quantityReserved`) until an inventory module actually writes reservations — the *returned* `inStock`
  boolean is always exact regardless. Revisit once inventory sprints land.
- `getProduct`'s "related products" selection (same family, newest 6) is an assumption filling a gap
  the spec leaves open — already flagged in `plan-catalog.md` §8 #1.
- Local-disk image storage (`/uploads/${filename}`) assumes Sprint 5's Multer config uses
  `diskStorage`; the actual storage backend (local vs S3) is still the open item in plan §7.4.

---

## Commit

`git add .` then `git commit -m "api: catalog sprint 4 — products and pricing"`.
