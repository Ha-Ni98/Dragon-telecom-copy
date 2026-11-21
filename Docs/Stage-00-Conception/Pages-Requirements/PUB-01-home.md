# PUB-01 — Home

## Layout
- Public shell (Header + Footer), mobile-first. Route: `/`.

## UI
- `HeroSlider` (S38): up to 5 live `HeroSlide`s from GET /api/hero-slides; ~45% of viewport height; `<picture>` desktop/mobile art direction; 5 s autoplay (off under reduced motion), swipe, highlight-token dots; every slide after the first lazy-loads. No live slide → no hero. Suggested slide: "Vous êtes réparateur ?" → `/register` (professional pricing comes from client categories; there is no separate account type).
- `CategoriesSection`: the families chosen in Settings → Storefront (`featuredFamilyIds`, any number, in that order), each with iconUrl + name (+ product count); none chosen → section hidden.
- `BrandsSection`: grid of the brands chosen in Settings → Storefront (`featuredBrandIds`, in that order); none chosen → section hidden.
- Desktop header bar: Home · All products · the families chosen as `navFamilyIds` (plain links, in that order). Header and footer carry `id="header"` / `id="footer"` so `/#header` and `/#footer` land on them.
- `ProductsSection`: featured `ProductGrid` (8 cards), inline search input, family select, grid/list toggle.
- Footer (S38): store name, address, repair/sales phones (`tel:`), WhatsApp (`wa.me`), email (`mailto:`) and Facebook/Instagram/TikTok links — all from GET /api/settings/public, each shown only when set.

## Interactions
- Category card → `/products?familyId=`; brand logo → `/products?brandId=`; product card → `/products/:id`.
- Search submit → `/products?search=`. Heart on cards (clients only) toggles favorites.

## Forms
- None (search input navigates only).

## Data dependencies
- `useFeaturedFamilies()` → `['families','featured']` → GET /api/families?featured=true&limit=6&withCount=true.
- `useHeroSlides()` → `['platform','hero-slides','public']` → GET /api/hero-slides (S38).
- `useBrands()` → `['brands']`; `useFeaturedProducts()` → `['products','featured']`.
- Per-section skeletons; each section fails independently (ErrorBoundary per section); empty section hides itself.
- Mutations: `useToggleCart()` invalidates `['cart']` and patches `inCart` in product caches.

## Access
- Public. No guard.
