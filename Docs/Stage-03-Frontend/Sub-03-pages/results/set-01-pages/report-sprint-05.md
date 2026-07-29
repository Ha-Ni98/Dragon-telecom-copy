# Sprint 5 Report — Wiring: Public Browse Cluster

**Set:** pub-pages · **Status:** ✅ Done · **Branch:** `pages-set-01`

---

## Summary

The largest sprint in this set: Home, Catalog, and Product Detail all moved from Sub-01 stub
data onto the real Sub-02 Integration Engine hooks, with URL-driven filtering, server-side
pagination, real order submission, activity beacons, and working cart/favorites. Along the way,
two genuine engine gaps surfaced and were fixed (cache-patching on cart toggle; two hooks missing
an `enabled` option they needed), and a chain of now-fully-orphaned Sub-01 files was cleaned up.
`tsc --noEmit` clean on both configs, 299/299 tests, no new lint-error classes.

## Files changed

**Rewired**
- `src/components/shared/ProductCard.tsx` — real `useAddToCart`/`useRemoveFromCart`, client-only heart via `useSession()`.
- `src/components/sections/landing/categories-section.tsx` — was 100% hardcoded; now `useCatalogFamilies({featured,limit:6,withCount})` + its own skeleton/error/empty states.
- `src/components/sections/landing/brands-section.tsx` — `useBrands()` → `useCatalogBrands()`; `BrandCard` retyped to `BrandDto`.
- `src/components/sections/landing/products-section.tsx` — rebuilt around `useCatalogProducts({featured:true,limit:8})`; the old "show all products" embedded mini-catalog view is gone.
- `src/pages/Products.tsx` — full URL-as-state rewrite: `useCatalogProducts`/`Families`/`Brands`/`Models`, server pagination, `SEARCH`/`CATALOG_SESSION` beacons.
- `src/pages/ProductDetails.tsx` — `useCatalogProduct`, `useWilayas`, `usePlatformDeliveryFee`, `usePlaceOrder`, `useClientMe` (prefill), `PRODUCT_VIEW` beacon, related strip.

**New**
- `src/pages/product-detail/components/RelatedProductsStrip.tsx` — bounded per-id `useCatalogProduct` fan-out (D7).

**Engine additions (Sub-02 code, not page code — see Corrections)**
- `src/hooks/useClientPortal.ts` — `patchInCartInProductCaches` wired into `useAddToCart`/`useRemoveFromCart`; `useClientMe` gained an `enabled` option.
- `src/hooks/useCatalogTaxonomy.ts` — `useCatalogModels` gained an `enabled` option.

**Deleted (orphaned by this sprint's wiring)**
- `src/hooks/use-product-details.ts`, `use-product-order.ts`, `use-products.ts`.
- `catalog.service.ts`: `getProducts`, `getFeaturedProducts`, `getProductById`.
- `query-keys.ts`: `qkLegacy.catalogProductsList/catalogFeaturedProducts/catalogProductById`.

## Design decisions worth flagging

**`ProductsSection` (Home) was simplified, not just retyped.** PUB-01 specifies a fixed 8-item
featured grid with a search box and family select that *navigate* to `/products` — it does not
describe a second, embedded full-catalog browsing experience. The Sub-01 version had exactly that
(a `showAllProducts` toggle with its own local filtering, pagination, and hardcoded brand/category
arrays) layered on top of the featured view. Since `/products` (Catalog) already *is* that full
browsing experience, keeping a duplicate one on the home page would mean maintaining two
divergent implementations of the same feature. Removed the embedded mini-catalog; search submit
and family selection now navigate to Catalog, matching PUB-01's stated interactions exactly.

**`ProductCard`'s action row was consolidated.** The old card had a heart icon *and* a separate
"Add to Cart" button that triggered the identical underlying toggle — Sub-01 scaffolding that
conflated a favorites pattern with a shopping-cart-with-checkout pattern the real contract doesn't
have (`CartItemDto` carries no quantity; there's no cart checkout flow anywhere in PUB-01/02/03 —
ordering happens on the product detail page). Wiring the *real* mutation this sprint made the
duplication concrete and worth resolving: the heart now owns the toggle exclusively, and the
bottom action is a single "View Details" button. This also let the now-dead `isAuthenticated`
override prop drop cleanly (its only two call sites were both in `products-section.tsx`, already
being rewritten this sprint).

**Server-side pagination replaces `ProductGrid`'s client-side pagination on Catalog only.**
`ProductGrid`'s internal `useState<currentPage>` + array-slicing logic assumes it received the
*entire* result set — true for Home's fixed 8-item grid, false for Catalog once
`useCatalogProducts` returns one server page at a time (`PaginatedResult.meta`). Rather than
rework `ProductGrid` itself, `Products.tsx` passes `enablePagination={false}` (already a supported
mode) and renders its own `SimplePagination` driven by the real `meta.page`/`meta.totalPages`,
writing `page` back to the URL. Home's usage of `ProductGrid` is unaffected.

## Corrections & real gaps found this sprint

Same transparent pattern as every prior sprint in this set:

1. **`useAddToCart`/`useRemoveFromCart` didn't patch product caches** — a genuine gap against
   `plan.md`'s own PUB-01 line ("invalidates `['cart']` **and patches `inCart` in product
   caches**"). Without the patch, every `ProductCard` reading `inCart` off an already-cached
   product list/detail query wouldn't visually flip until something else happened to trigger a
   refetch. Fixed with `patchInCartInProductCaches`, which handles both cached shapes under
   `qk.catalog.products.all()` (`{items, meta}` list pages and bare detail DTOs) in one pass.
2. **`useCatalogModels` and `useClientMe` had no `enabled` option** — both were needed this
   sprint for the first time (models: "enabled only with a brand," PUB-02; clientMe: must never
   fire for a guest, since a doomed 401 on a public page would hit the axios interceptor's
   redirect-to-login and silently bounce a browsing guest to `/login`). Added as an optional
   parameter on each; grep-confirmed neither hook had any other consumer before this change, so
   the addition is zero-risk.
3. **A four-file, two-service-function, three-query-key chain of stub code went orphaned** as
   the direct, mechanical consequence of switching Home/Catalog/Product-Detail onto real hooks.
   Each deletion was grep-verified for zero remaining consumers before removal, same discipline as
   Sprint 3's `DeliveryForm` cleanup.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs) | ✅ clean |
| `vitest run` | ✅ 299/299 passed, 35/35 files, no regressions |
| `eslint` before/after, all 10 touched/new files | ✅ 9 flat-or-much-improved (rewrites happened to match Prettier's style far better than the Sub-01 code they replaced); 1 (`ProductDetails.tsx`) +2, confirmed 100% `prettier/prettier` via rule-class breakdown |
| No `useEffect` fetching | ✅ verified — 4 effects in `Products.tsx` (URL-sync ×2, beacons ×2), 1 in `ProductDetails.tsx` (beacon); none fetch render data |
| Fee gating on pickup | ✅ `onDeliveryParamsChange(null)` fires whenever `orderType === PICKUP`; `usePlatformDeliveryFee`'s own `enabled: !!wilayaId` gate does the rest |
| 401 handling | ✅ untouched — still the axios interceptor, not a toast; the one deliberate redirect (403 `GUEST_PRICE_HIDDEN` → `/login`) is spec-required, not generic |

## Next

Sprint 6 — Wiring: auth & account cluster (Login + `/staff` landing, Register, My Account). The
`/staff` landing's `usePermissions()`-driven redirect and Register's `useWilayas()` swap (dropping
`WilayaProvider`) are the two pieces flagged as deferred back in Sprints 2 and 4.
