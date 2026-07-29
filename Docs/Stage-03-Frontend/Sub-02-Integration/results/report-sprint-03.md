# Sprint 3 Report — Catalog

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/lib`,
`/src/hooks`, `/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/catalog.service.ts`** — 24 real, contract-typed functions appended (products, taxonomy,
  categories), clearly separated from the untouched Sub-01 stub section by a header comment.
- **3 new hook files**, mirroring the backend's own service-interface split:
  `src/hooks/useCatalogProducts.ts` (11 hooks: 6 queries + 5 mutations), `useCatalogTaxonomy.ts` (9 hooks:
  brands/families/models CRUD), `useClientCategories.ts` (3 hooks).
- **`src/lib/query-keys.ts`** — `catalog.brands`/`families`/`models` restructured from flat parameterized
  functions into `{all, list}` objects, so a mutation can invalidate both the public and admin cached variants
  in one call. Extended `qkLegacy` with 3 more shims for the 2 old stub hooks this incidentally broke
  (`use-brands.ts`, `use-models.ts`).
- **`tests/fixtures/data/catalog.mock.ts`** (new) + **`tests/fixtures/msw/catalog.handlers.ts`** (new, 27
  handler registrations + 9 named error overrides) + registered in `server.ts`.
- **39 new tests**: `tests/integration/services/catalog.service.test.ts` (26) +
  `tests/integration/hooks/catalog.test.tsx` (13).

## Scope correction: "replace the stub" was impossible under the standing constraints

Before writing any code, I checked which pages/components actually consume the 5 Sub-01 stub catalog hooks:

```
useProducts, useFeaturedProducts     → Products.tsx, products-section.tsx
useAdminProducts, useAdminProductsStats, useDeleteAdminProduct,
useAddAdminProductSupply, useRefreshAdminProducts
                                      → AdminProducts.tsx, admin-products-stats-section.tsx,
                                        admin-products-filters-section.tsx
useProductDetails                    → ProductDetails.tsx
useBrands                            → Products.tsx, AdminProductsAdd.tsx, product-hierarchy-section.tsx,
                                        admin-products-filters-section.tsx, brands-section.tsx
useFamilies                          → product-hierarchy-section.tsx
useModels                            → Products.tsx, admin-products-filters-section.tsx,
                                        AdminProductsAdd.tsx, product-hierarchy-section.tsx
```

**8 distinct files.** The phase-03 commandment "no UI code — don't touch `/src/components` or `/src/pages`"
applies to every sprint in this stage, not just this one. Rewiring these hooks' return shapes to real contract
DTOs (UUID ids, different field names) would break all 8 files' `tsc` compilation, and I'm barred from fixing
them. So "replace `catalog.service.ts`" (plan.md's literal wording) was not actually achievable this sprint —
only *adding* a real, parallel service+hooks was.

This corrects an over-optimistic note from Sprint 1's handoff, which implied catalog `qkLegacy` entries would
"retire by Sprint 3." They don't — real retirement only happens in **Sub-03**, when those 8 pages are rewired
onto the new hooks (`useCatalogProducts`, `useCatalogTaxonomy`, `useClientCategories`). `sprints.md` is updated
to state this plainly for Sprints 4–9: every remaining sprint should expect the same pattern (new hooks under
new names; extend `qkLegacy` only for incidental breakage, never for new Sub-02 hooks).

## 2 real bugs found while writing tests

1. **MSW handler registration order matters like Express route order.** `PRODUCT_STATS`
   (`/admin/products/stats`) was registered after `ADMIN_PRODUCT_BY_ID` (`/admin/products/:id`) — msw matches
   the first registered handler, so the `:id` pattern greedily matched the literal path segment `"stats"`, and
   `productStats()` silently received a full `AdminProductDto` instead of stats. The real backend router
   (`Apps/api/.../catalog.routes.ts`) has an explicit comment about needing this exact ordering; the MSW fixture
   needed the same discipline and didn't have it. **Fixed** by reordering the handler array.
2. **Genuine, unfixed contract gap: `AddProductImagesCommand.images` collides with multer's file-field name.**
   The command's own per-image metadata array is named `images`; multer's `.array('images')` expects the actual
   file blobs under that exact same multipart field name. A standard FormData encoding sends both under one
   key, so `body.getAll("images")` returns 2 entries (1 JSON-stringified metadata array + 1 File), not 1 as
   naively expected. This is a wire-format ambiguity baked into the contract itself, not something the frontend
   service can resolve by choosing a different (invented, backend-unaware) encoding. Documented in
   `commandToFormData`'s comment and asserted as the real, observed behavior in the test. **Not fixed** — flagged
   for a contract/backend decision (rename one of the two colliding fields).
   - Same investigation also confirmed `CreateProductSchema`/`AddProductImagesSchema` use strict
     `z.number()`/`z.boolean()` (not `.coerce`), with no JSON-parse preprocessing in
     `validate-request.middleware.ts` — any real multipart body (multer only produces strings) will 400 against
     the live backend regardless of how the frontend encodes it. Same category of gap, also flagged, not fixed.

## Validation

```
npm run check
```
Clean, whole project, zero errors.

```
npx vitest run
```
**13/13 files, 115/115 tests passing** (up from 76/76 at Sprint 2 close — 39 new tests, all catalog).

Lint: ran `eslint --fix` on all 7 fully-new files (safe, no pre-existing content). For `catalog.service.ts`
(mixed old stub + new real section), `--fix` initially also reformatted 15+ untouched pre-existing lines
(quote-style + line-wrap) — reconstructed the file from the original committed stub + my fixed new section to
keep the diff to a pure addition, then re-verified `eslint` reports errors only in the untouched pre-existing
section (same precedent as Sprint 1: don't mass-fix debt outside the current diff).

## Commit

`fe: integration sprint 3 — catalog` on `stage-03-sub-02-integration`.

## Handoff to Sprint 4 (Clients & POS Clients)

- The "check page/component consumers before touching a stub hook's shape" step is now a standing pre-check for
  every remaining sprint — do it before writing services/hooks, not after hitting a `tsc` wall.
- `use-my-account.ts` (already on `qkLegacy.clientsMyAccount` since Sprint 1) is Sprint 4's analogous case —
  expect the same "new hooks alongside, not instead of" pattern.
- `CartItemDto.product` nests `ProductWithPricingDto` — Sprint 4's cart fixtures can reuse
  `tests/fixtures/data/catalog.mock.ts`'s `mockProductWithPricing` directly rather than duplicating it.
- Two contract gaps now logged (multipart field collision, strict-type-vs-multer-strings) — worth a single
  consolidated note back to whoever owns `Apps/contract`/`Apps/api` once Sub-02 execution finishes, rather than
  raising them piecemeal.
