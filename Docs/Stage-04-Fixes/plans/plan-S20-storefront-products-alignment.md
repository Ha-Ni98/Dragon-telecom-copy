# Plan S20 — Storefront products page: align to the admin/staff pattern

**Scope:** frontend only. No contract change, no backend change, no schema change, no migration.
This is a **structural refactor of `/products`** (PUB-02) and the four components it renders.

**Sets that must land first:** none. S20 is independent of S19 and S21 (the brief says it "may run
at any point"). It touches no file S19 touched.

---

## Owner decision taken before planning — do not re-open

**Header count.** `ProductListHeader` is specified by PUB-02 as "title, total vs filtered count",
but that feature has never worked: `Products.tsx` passes `meta.total` as **both** `totalProducts`
and `filteredCount`, so `hasActiveFilters = filteredCount < totalProducts` is permanently `false`
and the "showing X of Y" banner, the `filteredOf` badge and the two-number results text have never
rendered once.

**Resolution: show the result count only.** The header renders
`t("products.results.available", { count })` — the number of products matching the current filters —
and the `totalProducts`/`filteredCount` duality, the dead banner, the dead badge and the
never-true `hasActiveFilters` are all deleted. No second network request. This is what the admin
and staff pages do (neither shows a total-vs-filtered figure at all).

---

## The pattern to align to — read this before touching anything

The executor must not infer this. Both reference pages were read; here is what they actually do.

### Reference files
- `Apps/web/src/pages/admin/products/AdminProducts.tsx` + `components/admin-products-filters.tsx`
- `Apps/web/src/pages/staff/products/StaffProducts.tsx` + `components/StaffProductFilters.tsx`

### A. Filter state lives in the URL, parsed through the contract schema

```ts
const filters: ProductListQuery = useMemo(() => {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = ProductListQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : { page: 1, limit: 15 };
}, [searchParams]);
```
The page holds **no** mirrored filter state. The only local state is the search-input buffer.

### B. One `updateParams` writer, `replace: true`

```ts
const updateParams = useCallback(
  (patch: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  },
  [setSearchParams],
);
```
`undefined` and `""` **delete** the param — that is how "no filter" is expressed in the URL.

### C. Debounce lives on the page, not in the filter component

The filter component is fully controlled and fires `onSearchChange` on every keystroke. The **page**
owns the buffer and the debounce, and only the settled value is written to the URL:

```ts
const [searchInput, setSearchInput] = useState(filters.search ?? "");
const debouncedSearch = useDebouncedValue(searchInput, 300);
useEffect(() => {
  if (debouncedSearch !== (filters.search ?? "")) {
    updateParams({ search: debouncedSearch || undefined, page: undefined });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedSearch]);
useEffect(() => { setSearchInput(filters.search ?? ""); }, [filters.search]);
```
The second effect re-syncs the buffer when the URL changes from elsewhere (back/forward).

### D. The filter component owns the "no selection" sentinel, the page never sees it

Both reference filter components declare, at module level:

```ts
const ALL = "__all__";
```

Radix `Select` rejects an empty-string item value, so "no filter" needs a sentinel — but it is
**internal to the component**. Props are optional ids and the callbacks take `string | undefined`:

```ts
familyId?: string;
onFamilyChange: (id: string | undefined) => void;
```
```tsx
<Select value={familyId ?? ALL} onValueChange={(v) => onFamilyChange(v === ALL ? undefined : v)}>
  <SelectItem value={ALL}>{t("staff.products.allFamilies")}</SelectItem>
```
The page's handler is therefore a plain pass-through — it never compares against a sentinel.

### E. Cascading model filter is the **parent's** job, not the component's

The page fetches models already scoped to the brand and gates the query:

```ts
const { data: modelsData } = useCatalogModels({ brandId: filters.brandId }, false, {
  enabled: !!filters.brandId,
});
```
The filter component just renders whatever `models` it is handed and sets `disabled={!brandId}`.
`StaffProductFilters`' header comment states this explicitly: *"`models` is expected pre-filtered by
the parent (empty when no brand is selected) rather than this component knowing about that rule
itself."* The component does **no** client-side model filtering.

### F. Every filter change resets the page; brand change also clears the model

```ts
const handleFamilyChange = useCallback((id: string | undefined) =>
  updateParams({ familyId: id, page: undefined }), [updateParams]);
const handleBrandChange = useCallback((id: string | undefined) =>
  updateParams({ brandId: id, modelId: undefined, page: undefined }), [updateParams]);
const handleClearFilters = useCallback(() => {
  setSearchInput("");
  setSearchParams({}, { replace: true });
}, [setSearchParams]);
const handlePageChange = useCallback((page: number) =>
  updateParams({ page: page <= 1 ? undefined : String(page) }), [updateParams]);
```

### G. Query keys and pagination

Query keys come from `qk` only, never hand-built: `qk.catalog.products.list(query)` (public),
`qk.catalog.staffProducts.list(query)`, `qk.catalog.adminProducts.list(query)`. **Pagination is
server-driven**: the hook returns one page, and the page renders
`<SimplePagination>` guarded by `productsResult.meta.totalPages > 1`. No component paginates a
client-side array.

### H. Loading / empty / error

The list component takes `isLoading` and `isError` **booleans** plus `onRetry` and `onClearFilters`
callbacks, and renders its own skeleton / `EmptyState` / `NotFoundState` internally. It never
receives a pre-formatted error string.

### I. Component style

`export function Name(props: NameProps)` — a named function export, no `React.FC`, no default
export. Page-owned components live in the page's own `components/` folder.

---

## What actually diverges on the storefront today

`Products.tsx` already follows **A, B, C, F, G** — S15 built it that way. The divergences are all in
the four components it renders and in how it talks to them.

| # | Divergence | Where |
|---|---|---|
| 1 | Bare `"all"` magic string as the select sentinel, ~20 occurrences; props typed `string` not `string \| undefined`; the **page** does the `=== "all" ? undefined` conversion (inverted vs D) | `ProductFilters.tsx` |
| 2 | Client-side `filteredModels` re-filter, on top of the server-side scoping the page already does — and its extra `familyIds` rule has no counterpart anywhere else (violates E) | `ProductFilters.tsx` |
| 3 | `sort` typed `string` with a `"default"` sentinel instead of `ProductSort \| undefined` | `ProductFilters.tsx` + page |
| 4 | `React.FC` + default export (violates I) | `ProductFilters`, `ProductGrid`, `ProductListHeader`, `ProductCard` |
| 5 | Single-consumer components parked in `components/shared/` | `ProductFilters`, `ProductListHeader` |
| 6 | `error?: string` instead of `isError: boolean` (violates H) | `ProductGrid` |
| 7 | **Dead client-side pagination**: `enablePagination`, `itemsPerPage`, `paginationClassName`, `currentPage` state, `paginationData` memo, a reset effect and a `SimplePagination` block — **both** call sites pass `enablePagination={false}` (violates G) | `ProductGrid` |
| 8 | **Dead header machinery**: `totalProducts`/`filteredCount` duality, `showStats`, `averageRating`, `featuredCount` (this app has no ratings), the never-rendering banner and badge | `ProductListHeader` |
| 9 | Manual `.replace('{count}', …)` instead of `t(key, vars)` — `lib/i18n.ts`'s `interpolate()` already does this | `ProductListHeader` |
| 10 | **Real bug:** `formatDZD(resolvedPrice)` omits the `language` argument, so storefront card prices always format with the `en` locale even in French | `ProductCard.tsx:218` |
| 11 | **Real bug:** the `React.memo` custom comparator compares only `id`/`inStock`/`inCart`/prices, so a product renamed or re-imaged server-side keeps rendering its stale name and photo after a refetch | `ProductCard.tsx:247-261` |
| 12 | Dead props no caller ever sets: `showPrice`, `showQuickView`, `onAddToCart`, `onViewDetails`, `isLoading`, `error`, `showWishlist` | `ProductCard`, `ProductGrid` |
| 13 | `products = productsResult?.items ?? []` — a fresh array identity every render | `Products.tsx` |
| 14 | `handleSearchChange` is a `useCallback` wrapper that only calls `setSearchInput` | `Products.tsx` |

**Verified safe to delete (#7, #12):** `grep` across `Apps/web/src` and `Apps/web/tests` finds no
caller passing `showPrice`, `showQuickView`, `onAddToCart`, `onViewDetails`, `showWishlist`, or
`ProductCard`'s `isLoading`/`error`; and both `ProductGrid` call sites pass `enablePagination={false}`.

---

## Constraints that must survive — verify each after the refactor

These come from the brief. They are all **already correct today**; the job is not to break them.

1. **Published + enabled only.** Enforced server-side in `catalog.service.ts#listProducts`. The
   frontend sends no such flag and must not start.
2. **No cost / exact stock / reserved / margin.** `ProductWithPricingDto` carries only a boolean
   `inStock`. Do not add fields.
3. **Price visibility is the backend's job.** `currentPrice` / `guestPrice` / `priceHidden` are
   server-resolved per viewer. `ProductCard` may only read them. Removing the `showPrice` override
   (#12) makes this structural — after S20 there is no frontend switch that can override the
   server's decision.
4. **Favorites heart.** `inCart` + `useAddToCart`/`useRemoveFromCart`, hidden from guests via
   `isClient`. `useClientPortal.ts#patchInCartInProductCaches` reaches into the
   `qk.catalog.products.all()` cache and rewrites the matching item as a **new object**. Two things
   must therefore stay true: the query key must remain `qk.catalog.products.list(filters)`, and
   `ProductCard` must re-render when its `product` prop is a new object — which the #11 fix
   guarantees more reliably than today's comparator does.
5. **Client activity beacons** — `SEARCH` on the settled debounced query and `CATALOG_SESSION` on
   unmount, signed-in clients only, fire-and-forget via `useSendClientActivity`. Keep both effects
   and their `eslint-disable-next-line react-hooks/exhaustive-deps` comments verbatim.
6. **Filters stay in the URL**, shareable and refresh-proof; brand change still resets the model.

---

## Guard rail — an existing test file constrains this refactor

`Apps/web/tests/unit/pages/catalog/catalog.test.tsx` renders `Products` and mocks five hook
modules. **Do not modify it and do not run it** — but the refactor must not invalidate it, because
`npm run check` type-checks `tests/**` and the owner may run the suite later.

**Do not rename or remove any of these:**
- The page's default export at `@/pages/Products`.
- The hooks it spies on: `useCatalogProducts`, `useCatalogTaxonomy`, `useObservability`,
  `useSession`, `useClientPortal` — same module paths, same exported names.
- `aria-label={t("products.filters.search")}` on the search input.
- `aria-label={t("products.filters.brand")}` on the brand `SelectTrigger`.
- Translation keys `products.noProductsFound`, `products.filters.clearAll`, `products.signIn`,
  `products.viewPrices`.
- **Two** buttons whose accessible name is `products.filters.clearAll` must render when the empty
  state is showing: `ProductFilters`' own header action **and** `ProductGrid`'s `EmptyState`
  decoration button. Keep both — the test asserts `getAllByRole` on that name.
- Loading must still render elements carrying `.animate-pulse` (the `Skeleton` component).

---

# Actions

Ordered so nothing is left dangling. Create/edit before delete.

## 1 — New `Apps/web/src/pages/products/components/ProductFilters.tsx`

Create the folder `Apps/web/src/pages/products/components/`. Precedent: `pages/product-detail/`
holds `components/RelatedProductsStrip.tsx` while the page file is `pages/ProductDetails.tsx` — so a
root-level page file with a kebab-case sibling folder is the established storefront convention, and
PascalCase filenames match that folder.

Start from the current `components/shared/ProductFilters.tsx` and apply exactly these changes.
**Everything not listed here — the JSX structure, the mobile `Sheet`, the active-filter chip row,
every class name and every translation key — is copied verbatim. The UI must not change.**

**1.1 Sentinels.** Replace the bare `"all"` literal everywhere with a module-level constant, and
restate the existing sort sentinel in the same style:

```ts
// Radix `Select` rejects an empty-string item value, so "no filter" needs a sentinel. It is
// internal to this component: props carry `string | undefined` and the page never sees these
// values. Same constant, same name, same reason as admin-products-filters.tsx and
// StaffProductFilters.tsx — deliberately duplicated rather than shared, so each filter bar reads
// standalone (three copies is the existing convention; extracting it is a separate cleanup).
const ALL = "__all__";
const SORT_DEFAULT = "__default__";
```

**1.2 Props.** Replace the props interface with optional ids and `undefined`-carrying callbacks:

```ts
interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  families: FamilyDto[];
  familyId?: string;
  onFamilyChange: (id: string | undefined) => void;
  brands: BrandDto[];
  brandId?: string;
  onBrandChange: (id: string | undefined) => void;
  /** Pre-scoped to the selected brand by the page (empty when no brand is selected) — this
   *  component never filters the list itself. */
  models: DeviceModelDto[];
  modelId?: string;
  onModelChange: (id: string | undefined) => void;
  inStock: boolean;
  onInStockChange: (inStock: boolean) => void;
  sort?: ProductSort;
  onSortChange: (sort: ProductSort | undefined) => void;
  isLoading?: boolean;
  className?: string;
  onClearFilters: () => void;
}
```

Renames from the old interface: `searchQuery`→`search`, `selectedBrand`→`brandId`,
`selectedCategory`→`familyId`, `selectedModel`→`modelId`, `categories`→`families`. Drop
`showClearFilters` (no caller sets it; the clear button is already conditional on
`hasActiveFilters`).

**1.3 Export style.** `export function ProductFilters({ … }: ProductFiltersProps) { … }`. Delete
`export default ProductFilters` and the `React.FC` annotation. Drop the now-unused `React` import
(keep `useState`, drop `useMemo` — see 1.5).

**1.4 Sentinel conversion at the boundary.** Each select becomes:

```tsx
<Select value={familyId ?? ALL} onValueChange={(v) => onFamilyChange(v === ALL ? undefined : v)} disabled={isLoading}>
  …
  <SelectItem value={ALL}>{t("products.filters.all")}</SelectItem>
```
Brand and model likewise. Model keeps `disabled={isLoading || !brandId}` (was
`isLoading || filteredModels.length === 0` — `!brandId` is the admin/staff rule and is what the
page's `enabled: !!filters.brandId` gate actually expresses).

Sort:
```tsx
<Select
  value={sort ?? SORT_DEFAULT}
  onValueChange={(v) => onSortChange(v === SORT_DEFAULT ? undefined : (v as ProductSort))}
  disabled={isLoading}
>
```
with `sortOptions` typed `Array<{ value: string; label: string }>` and its first entry
`{ value: SORT_DEFAULT, label: t("products.filters.sortDefault") }` — unchanged otherwise.

**1.5 Delete the client-side model re-filter.** Remove the `filteredModels` `useMemo` entirely
(pattern §E) and map over `models` directly in the model `SelectContent`. Remove the `useMemo`
import. Delete its stale comment block ("Models scoped to the selected brand/category — recomputed
on every keystroke…") — it describes work this component no longer does.

**1.6 `hasActiveFilters` and the chip row.** Rewrite the guard against `undefined`:

```ts
const hasActiveFilters =
  familyId !== undefined ||
  brandId !== undefined ||
  modelId !== undefined ||
  search.trim() !== "" ||
  inStock ||
  sort !== undefined;
```
Each chip's condition becomes `{brandId !== undefined && (…)}` etc., and each chip's × calls the
setter with `undefined` (`onBrandChange(undefined)`, `onSortChange(undefined)`). The name lookups
lose their sentinel branch:

```ts
const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "";
const familyName = (id: string) => families.find((f) => f.id === id)?.name ?? "";
const modelName = (id: string) => models.find((m) => m.id === id)?.name ?? "";
const sortLabel = (value: ProductSort) =>
  sortOptions.find((option) => option.value === value)?.label ?? "";
```

**1.7 `handleClearFilters`.** It currently pushes six separate setter calls *and* calls
`onClearFilters?.()` — the page then clears the whole URL anyway, so the six are redundant writes.
Reduce to:

```ts
const handleClearFilters = () => {
  onClearFilters();
  setSheetOpen(false);
};
```

**1.8 Keep verbatim:** the `Sheet` mobile drawer including its `w-[85%] max-w-sm` class and the
"Not w-full: the list must stay partly visible behind the drawer, like the header's burger menu
(S15)" comment (that width is a recorded S15 decision — §4.1 of `plan-S15-public-storefront.md`);
the `Filter` icon header, the `common.status.active` badge, every `products.filters.*` key, and both
`aria-label`s named in the guard-rail section.

## 2 — New `Apps/web/src/pages/products/components/ProductListHeader.tsx`

Create from the current `components/shared/ProductListHeader.tsx`, applying the owner's decision.

**2.1 Props:**
```ts
interface ProductListHeaderProps {
  title: string;
  description: string;
  /** Number of products matching the current filters (`meta.total`). The catalog has no cheap
   *  unfiltered total and never did — the old totalProducts/filteredCount pair was always fed the
   *  same number, so the "showing X of Y" banner and badge never once rendered (S20 decision). */
  count: number;
  isLoading?: boolean;
  className?: string;
}
```

**2.2 Delete:** `totalProducts`, `filteredCount`, `showStats`, `averageRating`, `featuredCount`,
`hasActiveFilters`, `renderStats()`, the entire "Filter Status" block at the end of the component,
and the now-unused `Badge`, `Package`, `TrendingUp`, `Star` imports.

**2.3 Results text** — use `t()`'s own interpolation instead of manual `.replace()`:
```ts
const resultsText = isLoading
  ? t("products.loading")
  : t("products.results.available", { count });
```
`lib/i18n.ts#interpolate` already substitutes `{count}`.

**2.4 Skeleton branch:** keep it, but drop the `showStats &&` sub-block (two of the three
`Skeleton` bars) since there are no stats left to stand in for. The remaining title/description/
count skeletons keep `.animate-pulse` alive for the loading assertion.

**2.5 Export style:** `export function ProductListHeader({ … }: ProductListHeaderProps)`; delete the
`React.FC` annotation and the default export. Drop the `React` import.

## 3 — `Apps/web/src/components/shared/ProductGrid.tsx` (stays shared)

`ProductGrid` has two consumers (`Products.tsx` and `components/sections/landing/products-section.tsx`),
so it **stays in `components/shared/`**. Only its contract changes.

**3.1 Props — replace `error` with `isError`, delete the dead ones:**
```ts
interface ProductGridProps {
  products: ProductWithPricingDto[];
  isLoading?: boolean;
  /** Booleans + callbacks, matching AdminProductsTable/StaffProductsTable — the grid owns its own
   *  error copy rather than receiving a pre-formatted string. */
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
  className?: string;
  columns?: { mobile?: number; tablet?: number; desktop?: number };
  showSkeletons?: boolean;
  skeletonCount?: number;
}
```
Deleted: `error`, `showPrice`, `enablePagination`, `itemsPerPage`, `paginationClassName`.

**3.2 Delete the dead client-side pagination** — `useState` `currentPage`, the `paginationData`
`useMemo`, the `React.useEffect` that resets the page on `products.length`, `handlePageChange`, the
whole `{enablePagination && …}` `SimplePagination` block, and the `SimplePagination`, `useState`,
`useMemo` imports. Both call sites already pass `enablePagination={false}`; pagination on this page
is server-driven (pattern §G). Map directly over `products` where
`paginationData.paginatedProducts` was used, and change the guard to `products.length > 0`.

**3.3 `renderError`** — body becomes `t("products.errorLoadingBody")` unconditionally (that is
exactly what the landing page passes in today, and what the old `error || …` fallback produced).
The render guards become `isError && !isLoading` / `isLoading && !isError` / `!isLoading && !isError
&& products.length === 0`.

**3.4** Drop the `showPrice` pass-through on `<ProductCard>`, and the stray blank line inside that
JSX element.

**3.5 Export style:** `export function ProductGrid({ … }: ProductGridProps)`; delete the `React.FC`
annotation and the default export. Keep the `React` import only if still needed after 3.2 (it is
not — remove it).

**3.6 Do NOT touch** `MOBILE_COLS_CLASS` / `TABLET_COLS_CLASS` / `DESKTOP_COLS_CLASS` or their
comment. Those literal lookup tables exist because Tailwind's JIT scanner cannot see through
`grid-cols-${n}` — a recorded set-03 finding. Rewriting them as template literals would silently
ship a grid with no column classes.

## 4 — `Apps/web/src/components/shared/ProductCard.tsx` (stays shared)

Three consumers (`ProductGrid` ×2 pages, `RelatedProductsStrip`). Keep the change surface small.

**4.1 Fix the locale bug (divergence #10).** `formatDZD(amount, language = "en")` — the call at
line 218 omits the second argument, so every storefront price renders with English grouping even
when the UI is French. Change:
```ts
const { t, language } = useTranslation();
```
```tsx
{formatDZD(resolvedPrice, language)}
```

**4.2 Fix the stale-card bug (divergence #11).** Replace the hand-written `React.memo` comparator
with the default shallow compare — i.e. delete the second argument to `React.memo` entirely. The
custom comparator returns "equal" whenever `id`/`inStock`/`inCart`/prices match, so a product whose
**name, description or image** changed server-side keeps rendering stale content after a refetch.
Default shallow compare still short-circuits the common case (react-query hands back the same
`product` object reference when nothing changed) and correctly re-renders when
`patchInCartInProductCaches` swaps in a new object. Add:
```ts
// Default shallow compare on props: react-query returns a stable `product` reference when nothing
// changed, and hands a *new* object when it did (including the inCart patch in useClientPortal.ts).
// The previous hand-written comparator ignored name/description/images, so a renamed or re-imaged
// product kept rendering its old content until the component happened to unmount (S20).
```

**4.3 Delete the dead props (divergence #12):** `showPrice`, `onAddToCart`, `onViewDetails`,
`isLoading`, `error`, `showQuickView`, `showWishlist`, along with the whole `if (isLoading)` card,
the whole `if (error)` card, the `showQuickView` Eye button, and the `Skeleton` import. Behaviour is
identical because no caller sets any of them.
- `shouldShowPrice` simplifies to `!product.priceHidden && resolvedPrice !== undefined` — the
  server's decision, with no frontend override left (constraint 3).
- The heart's gate becomes `{isClient && (…)}`.
- `onAddToCart?.(product.id)` disappears from the add-to-cart `onSuccess`; keep the toast.
- Update the price-resolution comment, which currently ends "trust it over the showPrice override
  except when a caller explicitly forces it off" — that override no longer exists.

**4.4 Export style:** `export const ProductCard = React.memo(function ProductCard({ … }: ProductCardProps) { … });`
Delete `export default ProductCard`. Keep the named export — all three consumers import it in braces.

**4.5 Do NOT change** any class name, badge, layout, `products.signIn` / `products.viewPrices` copy,
or the `/products/:id` navigation.

## 5 — `Apps/web/src/components/sections/landing/products-section.tsx` (ripple from action 3)

Two lines inside the `<ProductGrid …>` call:
- `error={isError ? t("products.errorLoadingBody") : undefined}` → `isError={isError}`
- delete `enablePagination={false}`

Leave everything else — including the absence of `onClearFilters`, which is what makes the landing
grid's empty state fall back to its "view all products" link instead of a clear-filters button.
Check afterwards whether `t` is still used elsewhere in the file (it is — the section headings); do
not remove the `useTranslation` import.

## 6 — `Apps/web/src/pages/Products.tsx` (the page)

**6.1 Imports:** point at the new locations —
```ts
import { ProductFilters } from "@/pages/products/components/ProductFilters";
import { ProductListHeader } from "@/pages/products/components/ProductListHeader";
```
`ProductGrid`, `SimplePagination` and `ErrorBoundary` keep their `@/components/shared/…` paths. Add
`ProductSort` to the existing `@dragon-telecom/contract` import (it is needed for the sort handler's
type).

**6.2 Memoize the items array (divergence #13):**
```ts
const products = useMemo(() => productsResult?.items ?? [], [productsResult]);
```
(matches `AdminProducts.tsx`, and gives `ProductCard`'s shallow memo a stable array to work against).

**6.3 Handlers — drop every sentinel comparison (pattern §D).** The page no longer knows the string
`"all"` or `"default"` exists:
```ts
const handleFamilyChange = useCallback(
  (familyId: string | undefined) => updateParams({ familyId, page: undefined }),
  [updateParams],
);
const handleBrandChange = useCallback(
  // Brand change resets model (PUB-02).
  (brandId: string | undefined) => updateParams({ brandId, modelId: undefined, page: undefined }),
  [updateParams],
);
const handleModelChange = useCallback(
  (modelId: string | undefined) => updateParams({ modelId, page: undefined }),
  [updateParams],
);
const handleSortChange = useCallback(
  (sort: ProductSort | undefined) => updateParams({ sort, page: undefined }),
  [updateParams],
);
```
`ProductSort` is a string enum, so it drops straight into `updateParams`'s
`Record<string, string | undefined>` with no cast. `handleInStockChange` and `handleClearFilters`
are unchanged.

**6.4 Delete `handleSearchChange` (divergence #14)** and pass `setSearchInput` directly to
`onSearchChange`, as both reference pages do.

**6.5 `handlePageChange`:** change `page === 1` to `page <= 1` to match the reference pages. Keep the
`window.scrollTo({ top: 0, behavior: "smooth" })` — that is storefront-specific and intentional.

**6.6 Render — new prop names:**
```tsx
<ProductListHeader
  title={t("products.page.title")}
  description={t("products.page.description")}
  count={meta?.total ?? 0}
  isLoading={productsLoading}
/>
```
```tsx
<ProductFilters
  search={searchInput}
  onSearchChange={setSearchInput}
  families={families}
  familyId={filters.familyId}
  onFamilyChange={handleFamilyChange}
  brands={brands}
  brandId={filters.brandId}
  onBrandChange={handleBrandChange}
  models={models}
  modelId={filters.modelId}
  onModelChange={handleModelChange}
  inStock={filters.inStock ?? false}
  onInStockChange={handleInStockChange}
  sort={filters.sort}
  onSortChange={handleSortChange}
  isLoading={productsLoading}
  onClearFilters={handleClearFilters}
/>
```
```tsx
<ProductGrid
  products={products}
  isLoading={productsLoading}
  isError={productsIsError}
  onRetry={() => refetchProducts()}
  onClearFilters={handleClearFilters}
  columns={{ mobile: 1, tablet: 2, desktop: 4 }}
  showSkeletons
  skeletonCount={15}
/>
```
`productsError` is no longer read — drop it from the `useCatalogProducts` destructure.

**6.7 Convert the two single-quoted keys** `'products.page.title'` / `'products.page.description'`
to double quotes (the file's own convention everywhere else; `prettier` enforces it).

**6.8 Keep unchanged:** the `filters` memo, `updateParams`, both search effects, both beacon effects
(and their `eslint-disable` comments), `useSession`/`isClient`, the three `ErrorBoundary` wrappers,
the outer `<main>`/container markup, and the `SimplePagination` block. The `ErrorBoundary`s stay
deliberately — they are crash guards, orthogonal to the query-error handling that pattern §H covers,
and removing them would reduce resilience on a public page for no structural gain.

**6.9 Update the page's header comment** to record that filter state now converts to `undefined` at
the component boundary:
```
/**
 * Products (Catalog) page — PUB-02. The URL is the single source of truth for every filter;
 * this page never mirrors it into local state (beyond the debounced search input buffer).
 * S20: filter components own their own "no selection" sentinel, so every handler here passes
 * `undefined` straight through to the URL writer — the page never compares against "all".
 */
```

## 7 — `Apps/web/src/config/translations.json`

Delete these **seven** now-orphaned keys (each had exactly one consumer, all inside the deleted
`ProductListHeader` machinery — verified by grep):

| Key | Current en |
|---|---|
| `products.results.count` | `Showing {count} of {total} products` |
| `products.stats.filteredOf` | `{count} of {total}` |
| `products.stats.featured` | `{count} Featured` |
| `products.stats.avgRating` | `Avg Rating` |
| `public.products.showingCount` | `Showing {shown} of {total} products` |
| `products.filters.applied` | `Filters applied` |
| `products.filters.clearToSeeAll` | `Clear filters to see all products.` |

**No new keys are added by this set.** `products.results.available` (`{count} products available`)
is kept and becomes the header's only count line. Re-validate the file parses as JSON after editing.

## 8 — Delete the two moved files

- `Apps/web/src/components/shared/ProductFilters.tsx`
- `Apps/web/src/components/shared/ProductListHeader.tsx`

Do this **last**, after action 6 has repointed the imports. Confirm with a final grep that nothing
references `components/shared/ProductFilters` or `components/shared/ProductListHeader` — including
`Apps/web/tests/**` (it does not: `catalog.test.tsx` imports the page, not the components).

---

## Validation

Compile and lint only. **Do not modify any test file, and do not run any test suite.**

```
cd Apps/web && npm run check && npm run lint
```

`npm run check` runs `tsc --noEmit` twice — once for the app, once for `tsconfig.test.json` (which
includes `tests/**`). Both must be clean **for the files this set touches**. Note the documented
pre-existing baselines so the executor does not chase them:
- `tsc --noEmit -p tsconfig.test.json` already reports ~48 lines of stale-fixture errors on clean
  `HEAD` in unrelated modules (billing/orders/repairs/sales/settings/inventory). Confirm the count
  does not grow and that no new error names a file from this set.
- `eslint .` already reports ~3.7k pre-existing `prettier/prettier` findings in unrelated legacy
  files. Lint the touched files specifically:

```
npx eslint \
  src/pages/Products.tsx \
  src/pages/products/components/ProductFilters.tsx \
  src/pages/products/components/ProductListHeader.tsx \
  src/components/shared/ProductGrid.tsx \
  src/components/shared/ProductCard.tsx \
  src/components/sections/landing/products-section.tsx
```
This must come back completely clean.

Also grep for stragglers after action 8:
```
grep -rn "shared/ProductFilters\|shared/ProductListHeader" Apps/web/src Apps/web/tests
grep -rn "enablePagination\|showPrice\|filteredCount\|totalProducts" Apps/web/src
```
Both should return nothing (the second may still match `OrderStatusDialog.tsx`'s unrelated local
`showPriceEdit` variable — that is a different identifier and must be left alone).

---

## Manual verification checklist (browser)

The whole point of S20 is that **the page looks and behaves exactly as before**. Steps 1-14 are
"nothing changed" checks; 15-18 are the bug fixes that fall out.

**Filters and URL — as a guest at `/products`**

1. The page renders: title, description, a count line reading "*N* products available", the filter
   bar, a 1/2/4-column grid, and pagination when there is more than one page.
2. Pick a **Family** → the grid narrows, the URL gains `?familyId=…`, and no `all` or `__all__`
   ever appears in the address bar.
3. Pick a **Brand** → URL gains `brandId`; the **Model** select becomes enabled and lists only that
   brand's models.
4. Pick a **Model** → URL gains `modelId`. Now change the **Brand** → `modelId` **disappears** from
   the URL and the model select resets.
5. Set Family back to "All" → `familyId` disappears from the URL entirely (not `familyId=all`).
6. Type in **search** → the grid refetches only once typing settles (~300 ms), and the URL gains
   `?search=…`. Every keystroke must **not** produce a request.
7. Toggle **In stock** → URL gains `inStock=true`; toggle off → the param disappears.
8. Change **Sort** to "Price: low to high" → URL gains `sort=price_asc`; set it back to "Default" →
   the param disappears.
9. With several filters set, **copy the URL, open it in a new tab** → the identical filtered view
   loads, and every control shows its value.
10. Press **browser Back** → the previous filter state is restored *and the search box text updates
    to match* (the buffer re-sync).
11. The **active-filters chip row** lists one chip per active filter; clicking a chip's × removes
    just that filter from the URL.
12. Click **Clear Filters** (header action) → all params vanish, the URL is bare `/products`, and
    the search box empties.
13. Filter down to **no results** → the empty state shows "No Products Found" with a clear-filters
    button that also resets the URL.
14. On a **narrow viewport (<640px)**, the filter controls collapse behind the drawer trigger; the
    drawer opens at ~85% width with the product list still visible behind it, and changing a filter
    inside it works. Selecting **Clear Filters** closes the drawer.

**Bug fixes**

15. Switch the language toggle to **French** → card prices render with French number grouping
    (e.g. `12 500 DZD`, space separator) instead of English `12,500 DZD`. **This is the fix for the
    dropped `formatDZD(…, language)` argument.**
16. In another tab, rename a product in `/admin/products/<id>` and save; return to the catalog tab
    and hard-refresh, or wait for a refetch → the card shows the **new** name and image. Previously
    the memo comparator kept the stale text.
17. The header count line always reads "*N* products available" where *N* is the number matching the
    current filters, and there is **no** "showing X of Y" banner and no filtered badge anywhere
    (they never rendered before either — this just deletes the dead machinery).
18. Paging to page 2 and back works, and the page scrolls to the top on each page change.

**Constraints that must still hold**

19. As a **guest**, a product with no guest price shows the "Sign in to see prices" zone, and **no
    heart icon appears on any card**.
20. Sign in as an **approved client** → cards show that client's category price, and a heart appears
    on hover. Click it → the heart fills immediately, a success toast fires, and the "In cart" badge
    appears **without a page reload**. Click again → it empties. Reload → the state persisted.
21. Confirm no card anywhere shows a cost, a margin, or an exact stock number — only the
    in-stock/out-of-stock badge.
22. As a signed-in client, open DevTools → Network, type a search and let it settle → exactly one
    activity beacon fires with the query. Navigate away from `/products` → a second beacon fires
    with the catalog session duration. As a **guest**, neither fires.
23. The **home page** (`/`) featured products grid still renders, still shows its skeletons while
    loading, and its "view all products" empty-state fallback still appears if the featured list is
    empty — it shares `ProductGrid`, whose props changed.
24. A **product detail page**'s "related products" strip still renders its cards correctly — it
    shares `ProductCard`.
