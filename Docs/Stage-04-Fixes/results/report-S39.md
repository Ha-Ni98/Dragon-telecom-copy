# Report S39 — Light asset tiles, home rows, product cards

Status: **executed, gates green except one expected test compile error (see §3), awaiting owner
review.** Plan: `Docs/Stage-04-Fixes/plans/plan-S39-tiles-home-rows-product-cards.md`. This closes the
S37–S39 storefront overhaul. One new public API endpoint, no schema change, no migration. Nothing
is committed.

**Not verified by me:** every visual and browser behaviour (tiles in both themes, row scrolling,
the long-press, the card layout). There is no browser here. The owner checklist at the end is the
only check of the UI.

---

## 1. What changed

### 1.1 Alpha check (the set's "first action")

The pipeline does **not** flatten transparency, so there was no encoder work. This was measured
during planning and is recorded here: an 800×800 PNG, fully transparent with an opaque dark square
in the middle, went through the real `ImagePipelineService.process` (storage stubbed). For
`BRAND_LOGO`, `FAMILY_ICON`, `STORE_LOGO` and `PRODUCT`, in both the main image and the `-thumb`
derivative: format `webp`, `hasAlpha = true`, corner alpha `0`, centre alpha `255`. HEIC uploads
decode to JPEG first (no alpha), which is fine for photos.

### 1.2 Contract

- `catalog.constants.ts`: `NEW_ARRIVALS_PER_FAMILY` (3), `NEW_ARRIVALS_DEFAULT_LIMIT` (12),
  `NEW_ARRIVALS_MAX` (24).
- `catalog.query.ts`: `NewArrivalsQuerySchema` / `NewArrivalsQuery`.
- `catalog.routes.ts`: `PRODUCTS_NEW_ARRIVALS` (`/products/new-arrivals`).
- `common/media.ts`: `LOGO_IMAGE_GUIDANCE` (512 px minimum, 10% padding).

### 1.3 API (catalog module)

- `listNewArrivals(query, viewer)`:
  - ranks in SQL with `ROW_NUMBER() OVER (PARTITION BY familyId ORDER BY createdAt DESC)`, keeps
    `rn <= 3`, `LIMIT ≤ 24`;
  - then one `findMany` hydrates those ids and the shared viewer-pricing step prices them;
  - out-of-stock products are kept (the card shows the badge).
- The "rows → viewer-priced DTOs" block was extracted from `getCartProducts` into the private
  `toViewerPricedProducts`, with identical behaviour, and is shared by both.
- Interface, a thin controller handler, and the route registered **before** `PRODUCT_DETAIL`, so
  `new-arrivals` is never read as a product id.

### 1.4 Web — tokens and shared pieces

- `index.css` / `tailwind.config.ts`: `--asset-tile` (white in light, `0.96` near-white in dark) and
  `--asset-tile-foreground` (dark slate in **both** themes, for anything drawn on the tile), exposed
  as `bg-asset-tile`, `text-asset-tile-foreground`, `border-asset-tile`.
- New `AssetTile`: the one light tile behind every transparent asset.
- New `use-long-press.ts`: a 450 ms touch long-press that swallows the click that follows it.
- `Logo`: the uploaded logo sits on the light tile in every header (storefront and back-office).
  The tile's padding and border are subtracted from the image height, so the overall size is
  unchanged. The `Box` fallback icon has no tile.

### 1.5 Web — product card (`ProductCard` rewrite)

- **Whole-card link:** a stretched link on the product name. The heart and the guest "sign in" link
  sit above it (`z-10`). Removed: the "View details" button, the description, the family/model line.
- **Name:** rendered exactly as stored, with no CSS text transform. Clamped to 2 lines, with
  `title` (full name on hover) and a touch long-press that expands it in place instead of opening
  the product.
- **Image:** the light tile in both themes, `object-contain` with padding. Fallback is a `Package`
  icon in the tile foreground.
- **Price:** the largest, boldest text (`text-lg`/`sm:text-xl`, `font-extrabold`), `text-foreground`,
  in the S37 `3 200 DA` format. Not the accent.
- **Heart:** visible on touch, hover-revealed from md up, on a light chip. The "in favourites" fill
  is `highlight`. The raw `red-500` / `black-500` classes are gone.
- Badges keep the S37 `highlight` / `highlightOutline` variants.
- Price visibility rules are unchanged (still server-resolved).

### 1.6 Web — home page

- **Order:** hero → Categories → Featured products → New arrivals → Repair tools → Brands.
- **New:** `HomeSectionHeader` (marker title + "See all" link, no description paragraph), and
  `ProductRow` (snapping horizontal strip; about 2.3 cards in view on a phone, widening with the
  viewport; prev/next buttons from md up; its own loading, error and hide-when-empty states).
- **Three rows:**
  - `FeaturedProductsRow`: the old data logic verbatim, now ordered by the admin's picker order. The
    inline search input, family select and grid/list toggle are gone.
  - `NewArrivalsRow`: `useNewArrivals()`.
  - `RepairToolsRow`: the family chosen in Settings → Storefront. It hides when nothing is chosen,
    when the family is not in the public (enabled) families list, or when it has no products.
- **Categories:** a horizontal row on phones, a full 6-column row from md up, icons on `AssetTile`.
- **Brands:** every enabled brand in a grid (4 per row on a phone, up to 8 on desktop), logos on
  `AssetTile`. The carousel, its 8-brand cap and the hover "view products" button are gone.
- `pages/Index.tsx` rewritten with `max-w-6xl px-4` (aligned with the header and footer) and a
  compact `RowSkeleton`.
- **Deleted:** `products-section.tsx`.

### 1.7 Web — other

- `useNewArrivals` hook, service function, query key, and the `catalogBrandLink` /
  `catalogNewestLink` deep links.
- `patchInCartInProductCaches` now also patches a **plain array** (the new-arrivals cache shape), so
  the heart flips there without a reload.
- Settings → Hierarchy: the Families and Brands cards show the upload guidance, and their 32px
  previews are `AssetTile`s (a dark logo stays visible in the dark admin theme).
- `Products.tsx`: the catalog grid is now 2 / 3 / 4 columns (phone / tablet / desktop).

### 1.8 Translation keys

6 keys added (`home.rows.seeAll`, `newArrivals`, `repairTools`, `scrollPrevious`, `scrollNext`,
`admin.settings.hierarchy.assetGuidance`), plus a value fix: `brands.title` `en` is now "Our
Brands" (it read "Our Brand"). **Reused:** `products.featured`, `categories.title`,
`categories.productCount`, `brands.title`, `products.signIn`, `products.viewPrices`,
`products.errorLoading`, `products.errorLoadingBody`, `common.actions.tryAgain`, the `wishlist.*`
keys, `products.outStock`, `cart.inCart`. The now-unused `*.description` and `products.gridView` /
`listView` keys stay in the JSON (harmless, the S37/S38 convention).

---

## 2. Findings and decisions as applied

- **F1–F8 and P1–P14** hold as written in the plan. Deviations:
  - The **Repair tools** `Suspense` fallback is `null`, not the skeleton the plan implied: that row
    often hides entirely, and a skeleton that vanishes is a layout jump.
  - The `useLongPress` movement rule is "any pointer movement cancels". If that proves too touchy
    on a real phone (a thumb tremor cancelling a real long-press), a few pixels of tolerance is the
    fix; I could not test it.
- **No ALL CAPS in the data or the code:** the dev DB has 16 products and none is all-caps, and
  nothing styled names as uppercase. The set's complaint described the audited reference site. The
  card guarantees normal case by applying no text transform.

---

## 3. Verification I ran, and one expected break

| Check | Result |
|---|---|
| contract `tsc` and eslint | clean |
| api `tsc --noEmit` | **0 errors in `src/`**; whole project **198** (baseline unchanged) |
| api eslint on `modules/catalog` | clean |
| web `tsc --noEmit` | clean |
| web `tsc -p tsconfig.test.json` | **54**, the baseline 53 **+1, expected** (below) |
| web eslint, per file vs a stashed HEAD (`-f json`) | **0 errors** on the touched files (HEAD had 31 on the same files); the 7 new files have 0. `eslint --fix` was run only on files that were clean at HEAD (`useClientPortal.ts`) or fully rewritten (`Index.tsx`). |
| translation-key audit | every `t()` key in the touched files exists |
| production build | builds; the five new lazy chunks and the `asset-tile` utilities are in the output |
| API smoke, real service against the dev DB | route order: `new-arrivals` registered before `:id`; query schema: default 12, `limit=0` and `limit=25` rejected; 12 items, **per family `Battery 3, Motherboard 2, Charger 3, Accessory 3, Display 1`** (max ≤ 3); newest first; `limit=2` returns the same two newest; the ids equal the plan's §0.6 SQL; marking the newest product unpublished removes it and the list refills to 12 (restored afterwards) |

**The +1 test error:** `tests/unit/pages/home/home.test.tsx` imports
`@/components/sections/landing/products-section`, which S39 deletes (the set drops the home search
bar, filter and view toggle). Beyond the missing import, that test also asserts the **old** home
sections' behaviour: skeletons, family-card and brand-card click targets, the wishlist heart on
`ProductsSection`, and its empty state. I did **not** edit it (hard rule 3) and did not keep a stub
file just to silence the compile error. **It needs rewriting for the new sections** — the S36
precedent of an expected, reported test break from an unedited file.

**NOT verified:** the UI itself (both themes, phone and desktop), the long-press on a real touch
device, row scrolling and snapping, the stretched-link click behaviour, and the real HTTP route with
a viewer token.

---

## 4. Manual verification checklist (owner, in the browser)

**Set-up:**
- Upload a **dark, transparent** brand logo (for example a black Apple logo PNG) and a dark family
  icon in Settings → Hierarchy.
- "Phone" means **375px and 320px**. "Desktop" means **≥ 1280px**.
- Run **every** step in **light and dark**.

### A. Light tiles (the core rule)
1. **Dark theme:**
   - the black brand logo sits on a **near-white tile** and is clearly visible;
   - the family icon likewise;
   - in the header and footer, the uploaded **store logo** sits on a small light tile;
   - in the admin and staff headers too.
2. **Light theme:** the same tiles are white with a thin border, and their edges are visible on the
   white page.
3. A brand with **no logo** shows its initial letter in dark grey on the tile (readable in both
   themes). A family with no icon shows the package glyph.
4. **Settings → Hierarchy:**
   - the Families and Brands cards show the guidance line (square, ≥ 512 px, trimmed, ~10% padding,
     transparent);
   - the 32px previews are light tiles in dark mode.
5. Upload a transparent PNG logo. On the storefront tile there is **no white rectangle** around the
   logo shape (alpha preserved). In light mode it simply blends into the white tile.

### B. Home page structure (phone and desktop)
1. The order is: hero → **Categories** → **Brands** → **Featured products** → **New arrivals** →
   the chosen repair family's row (only if configured). *(Updated after owner review, see §5.)*
2. There is **no** search box, family select or grid/list toggle on the home page.
3. Every section has a left title with the highlight marker. Categories and each product row have a
   **"See all"** link on the right.
4. On desktop, the categories row and the start of the featured row are visible on the first screen
   under the hero.

### C. Categories and brands
1. **Phone:** categories form a **horizontal scrolling row** (about 3.5 tiles visible) that you
   swipe. **Desktop:** all (up to 6) in one full row, with no scrollbar.
2. A category tile opens the catalog filtered to that family.
3. Brands: a **grid of every brand** (not 8 max, no carousel arrows or dots), **4 per row on
   phone**, 7–8 on desktop. A brand tile opens the catalog filtered by brand.
4. Hover a tile on desktop → highlight ring. Tab to it → highlight ring.

### D. Product rows
1. **Phone:** each row shows **2 full cards and a partial third** at the right edge. Swipe scrolls
   with snap.
2. **Desktop:** about 5 cards and a partial one, with **round prev/next buttons** at the row's
   edges that scroll it.
3. **Featured:** the products appear in the **same order** as chosen in Settings → Storefront.
   Change the order there and the row follows.
4. **New arrivals:** the newest products, with **no family more than 3 times**. (Dev data: only 3
   of the 4 batteries appear.) "See all" opens the catalog sorted newest first.
5. **Repair-tools row:** with no family set in Settings → Storefront, the row is absent. Set a family →
   its products appear, **titled with that family's name** (not "Repair tools"), and "See all" opens
   that family. Rename the family in Settings → Hierarchy → the title follows. Disable that family →
   the row disappears. *(Updated after owner review, see §5.)*
6. A row whose source is empty does not render at all.
7. At 320px there is **no horizontal page scroll** (the S37 console one-liner prints `[]`): only
   the rows themselves scroll.

### E. Product cards (home rows **and** the catalog page)
1. The names show in their stored, normal capitalisation (no ALL CAPS), **at most 2 lines** with an
   ellipsis.
2. **Desktop:** hovering a long name shows the full name (native tooltip).
3. **Phone:** a **long-press** (~½ s) on a long name **expands** it to show the full name, and does
   **not** open the product. A normal tap opens the product page. If the long-press never
   registers on a real phone, tell me — the movement rule may need a small tolerance (§2).
4. The **price is the largest, boldest text** on the card, in `3 200 DA`, and is not scarlet.
5. A guest on a product whose price is hidden sees "**Se connecter** pour voir les prix". The link
   goes to login, and tapping elsewhere on the card opens the product.
6. Badges: out-of-stock is the outlined highlight; in-cart is the filled highlight. Both are
   readable in dark mode.
7. As a client: the heart is visible on phones, and appears on hover on desktop. Tapping it toggles
   favourites, the filled heart is **highlight**-coloured, and the cart count bubble updates. On
   the **New arrivals** row too, the heart flips immediately without a reload.
8. The image box is a light tile in **both themes**, and the photo is shown whole (not cropped)
   with a little padding.
9. The whole card is clickable. Keyboard: Tab focuses the card link (highlight ring), and Enter
   opens it.
10. **Catalog page:** **2 cards per row on phone**, 3 on tablet, 4 on desktop. Filters and
    pagination work as before.
11. Product page → related products show the same new card.

### F. Regression
1. The S38 hero, footer and metadata are unchanged. The S37 header, category bar and bottom nav are
   unchanged.
2. The cart page, order placement and price visibility rules are unchanged (guest, approved client,
   hidden price).

---

## 5. After owner review (three changes, same day)

The owner confirmed S39 works and asked for three adjustments:

1. **Home link in the desktop category bar.** `StorefrontCategoryBar` now starts with "Accueil" /
   "Home" (`header.home`, an existing key), before "All products". It carries the highlight
   underline on `/`. On phones the bottom nav already has Home, so nothing changes there.
2. **Brands moved back to just after Categories.** The home order is now hero → Categories →
   **Brands** → Featured → New arrivals → the repair-tools row (S39 had put Brands last; the plan's
   P3 is superseded by this).
3. **The repair-tools row is titled with the chosen family's name.** `RepairToolsRow` looks the
   family up in the public families list (it already did, to check the family is enabled) and
   passes `family.name` as the title. Renaming the family in Settings → Hierarchy renames the row.
   The `home.rows.repairTools` key is now unused and was left in the JSON (the S37/S38 convention
   for dead keys).

Gates after the change: web `tsc` clean; eslint on the three touched files 0 errors. Only those
three files changed. No API, contract or translation changes.

### 5.1 Second follow-up (same day)

4. **Hover ring no longer clipped.** The product-row strip is `overflow-x-auto`, which also clips on
   the vertical axis, so the card's 2px hover/focus ring was cut off at the top and bottom (and,
   from md up, at the first card's left edge). The strip now has room around the cards: `pt-1.5 pb-3`
   vertically, and `md:px-2` cancelled by `md:-mx-2` horizontally so the cards still line up with the
   section title. The loading skeleton uses the same padding (no layout jump). The categories strip
   on phones got the same vertical room.
5. **"Featured" / "New" label on the cards.** First built as a small line above the section title
   (a misreading — corrected the same day, and that heading label was removed). The owner meant a
   marker on the product cards themselves, at the top-left where "Out of stock" shows. `ProductCard`
   gained an optional `label` prop, rendered first in the top-left badge stack as a filled
   `highlight` badge; `ProductRow` takes `cardLabel` and passes it to every card in the row. The
   Featured row passes `home.rows.featuredLabel` ("Featured" / "En vedette") and the New arrivals row
   `home.rows.newLabel` ("New" / "Nouveau"). It shows alongside "In cart" when that applies. Other rows and
   the catalog show no such label.
6. **Out of stock hides every other badge.** An out-of-stock product shows ONLY its light outlined
   "Out of stock" badge: no "Featured" / "New" marker and no "In cart" (the heart still shows the
   favourite state for a signed-in client). This applies to every `ProductCard` (home rows, the
   catalog, related products), not just the two labelled rows. The French Featured label is now
   "À la une" (was "En vedette").

Gates: web `tsc` clean; eslint 0 on all eight touched files. Checklist additions: in §D, hover a
card in each row (phone with a mouse-emulated hover, and desktop) — the full ring is visible on all
four sides, including the first card; every card in the Featured row shows a "Featured" badge and
every card in the New arrivals row a "New" badge at its top-left, in both languages and both
themes, readable in dark mode (near-black text on vermilion), and an out-of-stock product shows
ONLY its "Out of stock" badge (no Featured/New, no In cart).
