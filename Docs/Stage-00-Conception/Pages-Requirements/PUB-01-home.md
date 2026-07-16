# PUB-01 — Home

## Layout
- Public shell (Header + Footer), mobile-first. Route: `/`.

## UI
- `HeroSection`: static i18n title/subtitle, two CTAs, trust badges.
- `CategoriesSection`: 6 featured family cards from the backend, each with iconUrl + name (+ product count).
- `BrandsSection`: horizontal brand-logo carousel from the backend.
- `ProductsSection`: featured `ProductGrid` (8 cards), inline search input, family select, grid/list toggle.
- Footer: **front-end static** contact info + socials (types file) — no API.

## Interactions
- Category card → `/products?familyId=`; brand logo → `/products?brandId=`; product card → `/products/:id`.
- Search submit → `/products?search=`. Heart on cards (clients only) toggles favorites.

## Forms
- None (search input navigates only).

## Data dependencies
- `useFeaturedFamilies()` → `['families','featured']` → GET /api/families?featured=true&limit=6&withCount=true.
- `useBrands()` → `['brands']`; `useFeaturedProducts()` → `['products','featured']`.
- Per-section skeletons; each section fails independently (ErrorBoundary per section); empty section hides itself.
- Mutations: `useToggleCart()` invalidates `['cart']` and patches `inCart` in product caches.

## Access
- Public. No guard.
