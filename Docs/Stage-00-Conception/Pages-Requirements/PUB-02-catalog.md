# PUB-02 — Catalog

## Layout
- Public shell, mobile-first. Route: `/products` (filters in the query string).

## UI
- `ProductListHeader`: title, total vs filtered count.
- `ProductFilters` (drawer on mobile): search, Brand select, Family multi-select, Model select (cascades from brand), in-stock toggle, sort, clear.
- `ProductGrid`: 1/2/4 columns, 15/page, `Pagination`, card = image, name, badges, price zone (resolved price / "Sign in to see the price"), heart (clients).

## Interactions
- Every filter writes the URL (`?search=&brandId=&familyId=&modelId=&sort=&page=`); back/refresh restores state. Brand change resets model.
- Heart toggles the server cart (clients only; hidden for guests). Card → `/products/:id`.
- Signed-in client activity beaconed: each executed search (`SEARCH`) and catalog session duration on unmount (`CATALOG_SESSION`).

## Forms
- Filter bar only — `ProductListQuery` validates the parsed URL params before the query fires.

## Data dependencies
- `useProducts(filters)` → `['products', filters]` → GET /api/products. Skeleton grid / `EmptyState` with reset / error retry.
- `useFamilies()`, `useBrands()`, `useModels(brandId)` (enabled only with a brand).
- Mutations: `useToggleCart()` invalidates `['cart']`; beacon `useClientActivityBeacon()` — fire-and-forget, no invalidation.

## Access
- Public.
