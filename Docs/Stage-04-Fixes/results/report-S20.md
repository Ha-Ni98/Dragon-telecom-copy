# Report — Set 20: Storefront products page — align to the admin/staff pattern

Executed against `Docs/Stage-04-Fixes/plans/plan-S20-storefront-products-alignment.md` on
`version-1-1-1`, 2026-08-05. Frontend only — no contract, backend or schema change.

Owner decision confirmed before execution: the header shows the **result count only**
(`t("products.results.available", { count })`); the dead `totalProducts`/`filteredCount` duality,
banner and badge are deleted rather than made to work, since they had never once rendered
(`filteredCount` was always fed the same number as `totalProducts`).

## What changed

- **New `pages/products/components/ProductFilters.tsx`** — moved out of `components/shared/`
  (single consumer). Sentinel handling (`"all"` / `"default"`) moved from the page into the
  component, matching `StaffProductFilters`/`admin-products-filters`'s `ALL = "__all__"` pattern;
  props now carry `string | undefined` ids and a real `ProductSort | undefined` for `sort`. Deleted
  the client-side `filteredModels` re-filter — the parent already scopes `models` to the selected
  brand (`useCatalogModels({ brandId }, false, { enabled: !!brandId })`), so this component now
  only renders what it's given, like its two siblings. `handleClearFilters` reduced to a single
  `onClearFilters()` call instead of six redundant setter calls. Named function export, no
  `React.FC`, no default export. JSX, classes, the mobile `Sheet` (including its recorded `w-[85%]
  max-w-sm` S15 decision), the active-filter chip row and every `products.filters.*` translation
  key are unchanged.
- **New `pages/products/components/ProductListHeader.tsx`** — moved out of `components/shared/`
  (single consumer). Deleted `totalProducts`, `filteredCount`, `showStats`, `averageRating`,
  `featuredCount`, `hasActiveFilters`, `renderStats()`, and the "Filter Status" banner block. New
  `count: number` prop feeds `t("products.results.available", { count })` via `lib/i18n.ts`'s own
  interpolation instead of manual `.replace()`. Named function export, no `React.FC`, no default
  export.
- **`components/shared/ProductGrid.tsx`** (stays shared — two consumers) — `error?: string`
  replaced with `isError?: boolean` (the grid now owns its own error copy, matching
  `AdminProductsTable`/`StaffProductsTable`'s boolean+callback contract). Deleted the entire dead
  client-side pagination engine: `currentPage` state, the `paginationData` memo, the page-reset
  effect, `handlePageChange`, the `SimplePagination` block, and the `enablePagination`/
  `itemsPerPage`/`paginationClassName` props — both call sites already passed
  `enablePagination={false}`, since pagination on this page is server-driven. Dropped the dead
  `showPrice` pass-through to `ProductCard`. Named function export, no `React.FC`, no default
  export. The Tailwind JIT column-class lookup tables (`MOBILE_COLS_CLASS` etc.) and their
  comment are untouched, as instructed — they exist because `grid-cols-${n}` template literals
  are invisible to Tailwind's scanner.
- **`components/shared/ProductCard.tsx`** (stays shared — three consumers) — two real bugs fixed:
  - `formatDZD(resolvedPrice)` was missing its `language` argument, so every storefront card price
    rendered with English number grouping even in French. Now `formatDZD(resolvedPrice, language)`.
  - The hand-written `React.memo` comparator only compared `id`/`inStock`/`inCart`/prices, so a
    product whose name, description or image changed server-side kept rendering stale content
    after a refetch. Replaced with the default shallow-prop comparator — safe because react-query
    hands back a stable object reference when nothing changed, and a new one when it did (including
    `useClientPortal.ts#patchInCartInProductCaches`'s heart-toggle patch).
  - Deleted the dead props (`showPrice`, `onAddToCart`, `onViewDetails`, `isLoading`, `error`,
    `showQuickView`, `showWishlist`) and their branches — no caller set any of them (grepped across
    `src` and `tests`). `shouldShowPrice` simplifies to `!product.priceHidden && resolvedPrice !==
    undefined`, with no frontend override left. Kept the named export (all three consumers import
    it in braces); dropped the default export.
- **`components/sections/landing/products-section.tsx`** — ripple from the `ProductGrid` prop
  rename: `error={isError ? t(...) : undefined}` → `isError={isError}`; dropped the now-nonexistent
  `enablePagination={false}`.
- **`pages/Products.tsx`** — repointed imports to the two moved components; new prop names
  (`count` on the header; `familyId`/`brandId`/`modelId`/`sort` as `string | undefined` /
  `ProductSort | undefined` on the filters; `isError` on the grid). Every filter handler dropped its
  sentinel comparison — `handleFamilyChange`/`handleBrandChange`/`handleModelChange`/
  `handleSortChange` now pass `undefined` straight through to `updateParams`, since the filter
  component owns "no selection" internally. Deleted the redundant `handleSearchChange` wrapper —
  `setSearchInput` is passed directly, as both reference pages do. `products` is now memoized
  (`useMemo(() => productsResult?.items ?? [], [productsResult])`) instead of a fresh array every
  render. `handlePageChange`'s guard changed from `page === 1` to `page <= 1` to match the reference
  pages. `productsError` dropped (unused once the grid took a boolean). Both single-quoted
  translation-key calls converted to double quotes. Header comment updated to record the
  sentinel-ownership change.
- **`config/translations.json`** — deleted 7 orphaned keys whose only consumer was the deleted
  `ProductListHeader` machinery: `products.results.count`, `products.stats.filteredOf`,
  `products.stats.featured`, `products.stats.avgRating`, `public.products.showingCount`,
  `products.filters.applied`, `products.filters.clearToSeeAll`. Verified zero remaining references
  before deleting. **No new keys added** — `products.results.available` (already existed) is now
  the header's only count string.
- **Deleted** `components/shared/ProductFilters.tsx` and `components/shared/ProductListHeader.tsx`
  (moved to `pages/products/components/`), after confirming (grep, `src` + `tests`) nothing else
  referenced the old paths.

## Deviations from the plan

None in scope or logic. One mechanical addition not spelled out action-by-action in the plan: after
the structural edits, `ProductCard.tsx` and `ProductGrid.tsx` still carried the original files'
pre-existing single-quote/JSX-formatting style (266 pre-existing `prettier/prettier` findings across
those two files alone, confirmed present on clean `HEAD` before this set touched them — the same
"pre-existing lint noise" pattern already documented elsewhere in this codebase). Since the plan's
own validation section says the touched-file lint pass "must come back completely clean," and
`eslint --fix` on formatting-only rules (quote style, trailing commas, JSX line wraps) is
mechanical and carries no logic risk, `--fix` was run once, scoped to exactly the 6 touched/created
files, and the result re-verified with `tsc --noEmit` and a second lint pass. No JSX structure,
class name, or translation key changed as a result — confirmed by re-reading the fixed files.

## Post-review fix — search input lost focus while typing

Found by the owner while verifying this set in the browser: on `/products`, the search field lost
focus after 2–5 characters and would not accept further typing until re-clicked. Diagnosed as
**two** distinct defects, both **pre-existing** (present identically on `HEAD` before S20 — this set
had copied the offending line verbatim under its "the UI does not change" instruction), the second
of which was masked by the first.

**Defect 1 — a disabled input is blurred by the browser (the reported symptom).**
`ProductFilters`' search `<Input>` carried `disabled={isLoading}`, and the page passed
`isLoading={productsLoading}`. Every settled keystroke writes the URL → `filters` becomes a new
object → `qk.catalog.products.list(filters)` is a **new query key** → `useCatalogProducts` has no
cached data for it and no `placeholderData`, so `isLoading` flips back to `true` for the whole
fetch. The browser blurs a focused element the instant it becomes disabled, and React does not
restore focus when it is re-enabled. The 2–5 character count was just typing speed against the
300 ms debounce window. **Fix:** removed `disabled` from the search input — a debounced search must
stay typable while its results load. This also matches the reference pattern: neither
`StaffProductFilters` nor `admin-products-filters` disables its search input (both use `disabled`
only on the model select, as `disabled={!brandId}`). `isLoading` still gates the selects and the
clear button, so the prop remains meaningful.

**Defect 2 — the page adopted the echo of its own URL write (latent, and unmasked by fix 1).**
The re-sync effect ran `setSearchInput(filters.search ?? "")` on *every* change of `filters.search`,
including the page's own debounced write. The debounced value lands in the URL a render after it
settles, so any character typed in that gap was reverted. This was previously unreachable — focus
was already gone at that moment — so fixing defect 1 alone would have traded "cannot type" for
"keystrokes silently vanish". **Fix:** a `lastWrittenSearch` ref records what the page pushed, and
the re-sync effect skips exactly one matching echo before falling through to the normal
external-change path. Verified by trace against all five paths: normal typing, Back, Forward,
Clear Filters, and the search chip's × button.

Both fixes are in `pages/products/components/ProductFilters.tsx` and `pages/Products.tsx`, with
comments recording the reasoning at each site.

**Note, not changed:** the same `isLoading`-flips-on-every-query-key mechanism still greys out the
three filter *selects* during each fetch, which briefly blocks rapid successive filter changes.
That is not a focus bug and was not reported; the reference pages avoid it by not taking an
`isLoading` prop at all. Say the word and I will remove it for parity.

**Also latent elsewhere, not touched:** `AdminProducts.tsx` and `StaffProducts.tsx` carry the same
unguarded re-sync effect (defect 2). They never disable their search input, so defect 1 does not
apply and the race is much harder to hit there. Flagged rather than fixed, to keep this set's diff
scoped to the storefront.

## Validation gate (no test file read, edited, or run)

| Check | Result |
|---|---|
| `Apps/web` `tsc --noEmit` (app) | clean |
| `Apps/web` `tsc --noEmit -p tsconfig.test.json` | 47 pre-existing errors, confirmed identical on clean `HEAD` before this set (via `git stash`); none reference any file this set touched (`settings-primitives.test.tsx`'s `StorefrontSettingsProps` mismatches are unrelated to catalog) |
| `eslint` on the 6 touched/created files | 0 errors, 1 pre-existing warning (`Products.tsx`'s catalog-session-duration ref-cleanup pattern — identical code existed before this set, confirmed against `HEAD`) |
| `grep -rn "shared/ProductFilters\|shared/ProductListHeader" src tests` | no matches |
| `grep -rn "enablePagination\|showPrice\|filteredCount\|totalProducts" src` | no matches referring to anything this set deleted (remaining hits are unrelated identifiers: dashboard stats' own `totalProducts`, `OrderStatusDialog`'s local `showPriceEdit`, and this set's own explanatory comment) |
| `translations.json` still valid JSON after key removal | confirmed; diff is exactly the 7 removed keys (35 lines), no reformatting |

No test file was read, edited, or run.

## Manual verification checklist (browser)

Reproduced from the plan's checklist for the reviewer's convenience. The goal of this set is that
the page **looks and behaves identically** to before, except for the two bug fixes and the header's
count line.

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
6a. **(focus regression check)** Type a long query slowly — at least 10 characters, pausing ~1 s
    between several of them so the debounce fires and the grid reloads more than once mid-typing.
    The caret must **stay in the search box the whole time**: no re-click needed, and every
    character you typed must still be there (nothing reverts as results land). Repeat quickly
    without pauses — same result.
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
    (e.g. `12 500 DZD`, space separator) instead of English `12,500 DZD`.
16. In another tab, rename a product in `/admin/products/<id>` and save; return to the catalog tab
    and hard-refresh, or wait for a refetch → the card shows the **new** name and image.
17. The header count line always reads "*N* products available" where *N* is the number matching
    the current filters, and there is **no** "showing X of Y" banner and no filtered badge anywhere.
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
    empty — it shares `ProductGrid`.
24. A **product detail page**'s "related products" strip still renders its cards correctly — it
    shares `ProductCard`.

## Handoffs

None. S20 is independent of S19 and S21 and touches no file either of them touches.
