# Plan S39 — Light asset tiles, home rows, product cards

Execution plan for **set 39** of `Docs/Stage-04-Fixes/sets-37-39.md`, the last set of the S37–S39
storefront overhaul.

It covers:
- **one new public API endpoint**, the new-arrivals row;
- **web UI**: tiles, the home page, `ProductCard`;
- **no** schema change and **no** migration.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

- **S37** (`b88f3f2`) and **S38** (`caecb4f`) are committed. S39 uses:
  - the `highlight` token, the `formatPrice` formatter and `SectionTitle` (S37);
  - the S37 phone-layout breakpoint `md`;
  - `storefront.repairToolsFamilyId` from public settings (S38);
  - the S38 `Logo` (store-name wordmark).
- Leave untouched: the S38 hero, the S38 footer contact logic, and the S37 header, nav and
  category bar.

### 0.2 The alpha check the set asks for first (done during planning)

The set says: if the pipeline flattens transparency, fixing the encoder is action 1. **It does not
flatten.**
- `image-pipeline.service.ts` calls only `.rotate().resize().webp({ quality })`. There is no
  `.flatten()`, no `.removeAlpha()`, and no background option anywhere in `common/media/`.
- **Measured:** an 800×800 PNG, fully transparent with an opaque dark square in the middle, was
  pushed through the **real** `ImagePipelineService.process` (storage stubbed to capture the
  bytes). The result is identical for `BRAND_LOGO`, `FAMILY_ICON`, `STORE_LOGO` and `PRODUCT`, for
  both the main image and the `-thumb` derivative:
  - output format `webp`, `hasAlpha = true`;
  - corner pixel alpha `0`, centre pixel alpha `255`.
- **So there is no encoder action.** Record this in the report.
- One caveat: HEIC uploads are decoded to JPEG first (`heic-decoder.ts`), and JPEG has no alpha.
  That is fine, because HEIC files are photos, not transparent logos.

### 0.3 Findings from reading the code (record them in the report)

- **F1 — alpha is preserved** (§0.2).
- **F2 — nothing renders product names in ALL CAPS here.**
  - No `uppercase` class is on any storefront product-name element.
  - The dev DB holds 16 products, **0** of them all-caps.
  - The set's complaint describes the audited reference site. S39 **guarantees** normal case by
    rendering the stored name with **no text transform** (P1).
- **F3 — the dark-theme invisibility is real.** It sits in these places:
  - the brand tile gradient: `from-primary/10 to-accent/10` on a dark card;
  - the family icon box: a blue gradient behind a dark icon;
  - the product image box: a translucent gradient;
  - the admin Hierarchy previews (`bg-muted`, dark in dark mode);
  - the `Logo` image, which sits directly on the header background.
- **F4 — several classes are no-ops** (carried over from S37 F5): `shadow-card`,
  `from-primary-glow`/`to-primary-glow`, and `text-black-500`. They are removed from every file this
  set rewrites.
- **F5 — the cart patch would miss a plain-array cache.** `patchInCartInProductCaches`
  (`hooks/useClientPortal.ts`) patches the two shapes under `qk.catalog.products.all()`: a
  paginated list, or a single detail DTO. The new-arrivals query returns a **plain array** under
  the same prefix, so the heart on that row would not flip until a refetch. Action 3.3 adds the
  array branch.
- **F6 — the catalog page renders one card per row on phones** (`Products.tsx` columns
  `mobile: 1`). With the compact S39 card (built for a 2.3-per-row strip), one card per row becomes
  a full-width square image per product. Action 5.9 switches the catalog grid to 2 columns on
  phones (P6).
- **F7 — `brands.title`'s `en` value reads "Our Brand"** (singular). Fixed to "Our Brands".
- **F8 — the brands section slices to 8** (`maxBrands = 8`) and pages through them with a
  translate-X carousel. The set drops both: every brand shows in a grid.

### 0.4 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **Product names render exactly as stored, with no CSS text transform** (`uppercase`, `capitalize` and `lowercase` are all avoided). | CSS cannot recover "normal capitalization" from all-caps data without breaking names like "iPhone", "LG" or "OnePlus". The data is already normal case (F2). |
| P2 | **New light-tile tokens:** `--asset-tile` (white in light, near-white `0.96` in dark) and `--asset-tile-foreground` (a dark slate in **both** themes). Exposed as `bg-asset-tile`, `text-asset-tile-foreground` and `border-asset-tile`. | The set says to use tokens, not raw colors. Anything drawn **on** a light tile (fallback letters and icons, the heart button's icon) needs a fixed dark foreground; `text-muted-foreground` turns light grey in dark mode and would vanish. The dark-mode tile is a touch below pure white to avoid glare. |
| P3 | **Home order:** hero → Categories → Featured → New arrivals → Repair tools → Brands. | Categories and the first product row land on the first screen (the S38 hero is about 45% tall). Brands is now an all-brands grid that can be long, so it goes last. |
| P4 | **Every home section gets one compact header:** a `SectionTitle` (left-aligned, `text-xl md:text-2xl`) plus an optional "See all" link on the right. The centred big title + description paragraph goes. | The set's goal is products on the first screen. A description under each title cost about 100px per section. The `*.description` keys stay in the JSON, unused. |
| P5 | **New arrivals: up to 12 products, at most 3 per family** (`NEW_ARRIVALS_PER_FAMILY = 3`). Enabled and published products only; **out-of-stock products are not excluded** (the card shows the badge). The row is ordered by `createdAt` descending. The cap is applied **in SQL** with a window function, and the result is bounded by `LIMIT`. | The set: "capped at 3 per family so one big delivery can't fill the row". It matches the catalog's own default visibility. It is validated on the dev DB (§0.6). |
| P6 | **The catalog grid becomes 2 / 3 / 4 columns** (phone / tablet / desktop), with the same card as the rows. | F6. One card component everywhere; the set's card rules are about "product cards", not one page. |
| P7 | **The card becomes a whole-card link**, using the stretched-link pattern on the name's `<Link>`. The heart and the guest "sign in" link sit above it with `relative z-10`. The "View details" button, the description, and the family/model line are removed. | On a 150px-wide card the only things that fit are the image, the brand, the 2-line name and the price, and the set makes the price dominant. Nesting a button inside an `<a>` is invalid HTML, so the link is stretched instead of wrapping. |
| P8 | **Full name on hover or long-press:** the name gets a `title` attribute (hover, desktop). A **450 ms touch long-press** on the name expands its 2-line clamp in place, and suppresses the click that would follow, so it doesn't navigate. | That is the set's requirement exactly. Native long-press on a link opens the OS link menu, not the name, so the expand needs `-webkit-touch-callout: none` on the name. |
| P9 | **The image box is a light tile in both themes, with `object-contain` and padding** instead of `object-cover`. | The set: "a white inner box behind the image … so photos with transparent or light backgrounds stay consistent in dark mode". Spare-part photos are typically isolated on white, and `contain` never crops the part. |
| P10 | **Card widths in a row:** `w-[42%]` on phones (about 2.3 cards), `sm:w-[29%]`, `md:w-[22%]`, `lg:w-[18%]` (about 5.5). Rows scroll horizontally with snap. **md+ gets prev/next buttons**; phones swipe. | The partial last card tells a thumb the row scrolls (the set). Mouse users get buttons, because a horizontal-only scroller is unreachable without a trackpad. |
| P11 | **The store logo tile:** `Logo` wraps the uploaded image in a small light tile (with `border-border`) **wherever it renders**: the storefront header and footer, and the admin and staff headers. The `Box` fallback icon gets no tile. | The set names the header and footer. `Logo` is one shared component, so the admin headers get the same fix. A dark logo vanishes on a dark admin header too. |
| P12 | **The repair-tools row hides** when the setting is empty, when the family is not in the public (enabled) families list, or when it has no products. | S38 promised in the admin helper that the row is hidden while the family is disabled. The public products endpoint doesn't check the family's flag (S21 Q5), so the row checks the public families list itself. |
| P13 | **Featured products keep the admin's order.** The ids query returns products by `createdAt`; the row re-sorts by position in `featuredProductIds`. | It was always the intent of the admin's ordered picker. It costs no server change. |
| P14 | **Logo and icon upload guidance** is a `CardDescription` under the Families and Brands sub-panel titles in Settings → Hierarchy. Those uploads are compact icon buttons with no room for a hint. | The set: "surfaced in the admin UI". Numbers come from contract constants. |

### 0.5 Accent use in this set (S37 §0.5 still governs)

- `highlight` is used **only** for: product-card badges (already S37); the heart's "in favourites"
  fill; hover rings on tiles and cards (already S37); and the section-title markers.
- **Prices stay `text-foreground`.** Dominance comes from size and weight, never from the accent
  ("never long text; primary buttons stay blue").

### 0.6 SQL validated during planning (read-only, dev DB)

```sql
SELECT r.id FROM (
  SELECT p.id, p."createdAt",
         ROW_NUMBER() OVER (PARTITION BY p."familyId" ORDER BY p."createdAt" DESC, p.id) AS rn
  FROM "Product" p WHERE p."isEnabled" AND p."isPublished"
) r WHERE r.rn <= 3 ORDER BY r."createdAt" DESC, r.id LIMIT 12;
```

The dev DB has these published products per family: Battery 4, Display 3, Charger 3, Accessory 3,
Motherboard 2. The query returned 12 rows, **3 Battery** (its 4th and oldest, "Battery Iphone 15
Pro", was excluded), in `createdAt` order.

### 0.7 Gates (no tests: do not edit or run any test file)

| Package | Command | Must stay |
|---|---|---|
| contract | `tsc --noEmit`, `eslint src` | clean |
| api | `tsc --noEmit` | **0 in `src/`**, and **198** for the whole project |
| api | eslint on the touched files | clean |
| web | `tsc --noEmit` | clean |
| web | `tsc -p tsconfig.test.json` | **53**, compared per file |
| web | eslint per file vs a stashed HEAD (`-f json`, report-S37 §5 method) | no file above its HEAD count. Run `--fix` only on files Prettier-clean at HEAD, or on fully rewritten files. |

---

## §1 — Contract

### Action 1.1 — `Apps/contract/src/modules/catalog/catalog.constants.ts`

Append:

```ts
// S39 — the home page's "New arrivals" row: newest enabled+published products, at most
// NEW_ARRIVALS_PER_FAMILY per family so one big delivery cannot fill the row. Bounded by
// NEW_ARRIVALS_MAX (1GB machine rule); the cap is applied in SQL (window function).
export const NEW_ARRIVALS_PER_FAMILY = 3;
export const NEW_ARRIVALS_DEFAULT_LIMIT = 12;
export const NEW_ARRIVALS_MAX = 24;
```

### Action 1.2 — `catalog.query.ts`

```ts
// S39 — GET /products/new-arrivals.
export const NewArrivalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(NEW_ARRIVALS_MAX).default(NEW_ARRIVALS_DEFAULT_LIMIT),
});
export type NewArrivalsQuery = z.infer<typeof NewArrivalsQuerySchema>;
```

### Action 1.3 — `catalog.routes.ts`

After `PRODUCTS`, add:

```ts
// S39 — the home "New arrivals" row (viewer-priced, ≤ 3 per family). A literal segment under
// "/products", so the api registers it BEFORE PRODUCT_DETAIL — otherwise "new-arrivals" would be
// validated (and 400'd) as a product :id.
PRODUCTS_NEW_ARRIVALS: '/products/new-arrivals',
```

### Action 1.4 — `common/media.ts`

After `LINK_PREVIEW_IMAGE_GUIDANCE`, add:

```ts
/** S39 — upload guidance for brand logos and family icons (shown in Settings → Hierarchy). They
 *  render on a light tile in both themes, so a transparent PNG/WebP is ideal; the pipeline keeps
 *  alpha (verified S39). */
export const LOGO_IMAGE_GUIDANCE = { minSize: 512, paddingPercent: 10 } as const;
```

**Check:** contract `tsc` and lint.

---

## §2 — API (`Apps/api/src/modules/catalog`)

### Action 2.1 — `catalog.service.ts`: extract the viewer-pricing hydration

`getCartProducts` already holds the whole "products → viewer-priced DTOs" block. Extract it into a
private method and call it from `getCartProducts`. The behaviour is identical:

```ts
// S39 — the one "rows → viewer-priced storefront DTOs" step, shared by getCartProducts and
// listNewArrivals (listProducts keeps its own inline copy because it also builds pagination).
private async toViewerPricedProducts(
  products: Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>[],
  viewer: Viewer,
): Promise<ProductWithPricingDto[]> {
  const ctx = await this.resolveViewerContext(viewer);
  const ids = products.map((product) => product.id);
  const [priceMap, cartSet] = await Promise.all([
    this.loadPriceMap(ids, ctx.categoryId),
    this.loadCartSet(ids, ctx.clientId),
  ]);
  return products.map((product) =>
    CatalogMapper.toProductWithPricingDto(product, this.resolvePricing(product, priceMap), {
      inStock: CatalogMapper.availableQuantity(product) > 0,
      inCart: cartSet.has(product.id),
    }),
  );
}
```

`getCartProducts` becomes: the early return, the `findMany`, then
`return this.toViewerPricedProducts(products, viewer);`. Keep its comment.

### Action 2.2 — `catalog.service.ts`: `listNewArrivals`

Add it after `listProducts`. Import `NEW_ARRIVALS_PER_FAMILY` and the `NewArrivalsQuery` type.

```ts
// S39 — home "New arrivals": newest enabled+published products, at most NEW_ARRIVALS_PER_FAMILY
// per family (P5), ranked in SQL so nothing unbounded reaches memory: the window query returns
// ≤ limit ids, then one findMany hydrates them and the viewer-pricing step prices them exactly as
// the catalog list does (price resolution stays server-side). Out-of-stock products are kept —
// the card shows the badge, as the catalog does.
async listNewArrivals(query: NewArrivalsQuery, viewer: Viewer): Promise<ProductWithPricingDto[]> {
  const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM (
      SELECT p."id", p."createdAt",
             ROW_NUMBER() OVER (PARTITION BY p."familyId" ORDER BY p."createdAt" DESC, p."id") AS rn
      FROM "Product" p
      WHERE p."isEnabled" = true AND p."isPublished" = true
    ) r
    WHERE r.rn <= ${NEW_ARRIVALS_PER_FAMILY}
    ORDER BY r."createdAt" DESC, r."id"
    LIMIT ${query.limit}`;
  if (ranked.length === 0) return [];

  const order = new Map(ranked.map((row, index) => [row.id, index]));
  const products = await this.prisma.product.findMany({
    where: { id: { in: ranked.map((row) => row.id) } },
    include: PRODUCT_INCLUDE,
  });
  products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return this.toViewerPricedProducts(products, viewer);
}
```

### Action 2.3 — `catalog.interface.ts`, `catalog.controller.ts` and `catalog.routes.ts`

- **Interface:** add
  `listNewArrivals(query: NewArrivalsQuery, viewer: Viewer): Promise<ProductWithPricingDto[]>;` to
  `ICatalogProductService`.
- **Controller:** add a thin handler, the same shape as `listProducts`:

  ```ts
  listNewArrivals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.listNewArrivals(req.validated.query as NewArrivalsQuery, req.user));
    } catch (error) {
      next(error);
    }
  };
  ```

- **Routes:** register it **between** `PRODUCTS` and `PRODUCT_DETAIL`:

  ```ts
  // S39 — before PRODUCT_DETAIL: "/products/new-arrivals" must not be read as a product :id.
  router.get(
    CATALOG_ROUTES.PRODUCTS_NEW_ARRIVALS,
    optionalViewer,
    validateRequest({ query: NewArrivalsQuerySchema }),
    controller.listNewArrivals,
  );
  ```

**Check:**
- api `tsc` (0 in `src/`) and lint.
- **Smoke run.** Use a temporary `tsx` script **in `Apps/api`, deleted afterwards** (the S38
  method):
  - `listNewArrivals({ limit: 12 }, undefined)` returns 12 items, with no family appearing more
    than 3 times, ordered newest first;
  - `{ limit: 2 }` returns 2;
  - the results equal the §0.6 SQL ids.
- Record the output.

---

## §3 — Web data layer (`Apps/web/src`)

### Action 3.1 — `lib/query-keys.ts`

Under `catalog.products`, add:

```ts
// S39 — the home "New arrivals" row. Under products.all() so the cart's inCart patch and every
// products-wide invalidation reach it (useClientPortal.ts handles the array shape).
newArrivals: (limit: number) => ["catalog", "products", "new-arrivals", limit] as const,
```

### Action 3.2 — `services/catalog.service.ts` and `hooks/useCatalogProducts.ts`

- **Service:** add `listNewArrivals(limit: number): Promise<ProductWithPricingDto[]>`. It is a GET
  of `apiPath(CATALOG_ROUTES.PRODUCTS_NEW_ARRIVALS)` with `params: { limit }`, in the file's
  defensive shape.
- **Hook:**

  ```ts
  // S39 — the home "New arrivals" row (≤ 3 per family, server-side).
  export function useNewArrivals(limit: number = NEW_ARRIVALS_DEFAULT_LIMIT) {
    return useQuery({
      queryKey: qk.catalog.products.newArrivals(limit),
      queryFn: () => catalogService.listNewArrivals(limit),
    });
  }
  ```

### Action 3.3 — `hooks/useClientPortal.ts`: `patchInCartInProductCaches` (F5)

- Widen the `setQueriesData` generic to
  `PaginatedResult<ProductWithPricingDto> | ProductDetailDto | ProductWithPricingDto[] | undefined`.
- Add a first branch:
  `if (Array.isArray(old)) return old.map((p) => (p.id === productId ? { ...p, inCart } : p));`.
- Update the comment: "Handles three cached shapes … a PaginatedResult (list), a plain array (S39
  new arrivals) or a bare DTO (detail)."

### Action 3.4 — `lib/deep-links.ts`

Append:

```ts
// S39 — catalog shortcuts from the home rows / brand grid.
export const CATALOG_BRAND_PARAM = "brandId";
export const catalogBrandLink = (brandId: string): string =>
  `/products?${CATALOG_BRAND_PARAM}=${encodeURIComponent(brandId)}`;
export const catalogNewestLink = (): string => `/products?sort=${ProductSort.NEWEST}`;
```

Import `ProductSort` from the contract.

---

## §4 — Tokens and shared pieces

### Action 4.1 — `Apps/web/src/index.css` and `tailwind.config.ts` (P2)

- **`:root`**, after the highlight pair:

  ```css
  /* S39 — the light tile every transparent asset sits on (brand logos, family icons, the store
     logo, product photos), in BOTH themes: a dark logo can never vanish on a dark surface. The
     foreground is for anything drawn ON the tile (fallback letters/icons) — dark in both themes,
     because text-muted-foreground turns light grey in dark mode and would disappear on it. */
  --asset-tile: 1 0 89.9;
  --asset-tile-foreground: 0.37 0.02 264.4;
  ```

- **`.dark`:**

  ```css
  /* S39 — near-white rather than pure white: a row of tiles in dark mode is intentional (the same
     treatment product photos get), but a full-white block glares. Foreground stays dark. */
  --asset-tile: 0.96 0.003 264.5;
  --asset-tile-foreground: 0.37 0.02 264.4;
  ```

- **`tailwind.config.ts`**, colors:
  `"asset-tile": { DEFAULT: "oklch(var(--asset-tile) / <alpha-value>)", foreground: "oklch(var(--asset-tile-foreground) / <alpha-value>)" }`,
  with an S39 comment.

### Action 4.2 — create `components/shared/AssetTile.tsx`

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// S39 — the ONE light tile behind every transparent asset (brand logos, family icons, the store
// logo, product photos), in both themes. No per-brand override and no admin control exist or
// should be added: the tile is what guarantees no logo can disappear. The border keeps the tile's
// edge visible on a white page in light mode. Children are typically an <img object-contain> or
// a fallback rendered in text-asset-tile-foreground.
export function AssetTile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl border border-border bg-asset-tile text-asset-tile-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

### Action 4.3 — create `hooks/use-long-press.ts` (P8)

```ts
import { useRef } from "react";

// S39 — touch long-press (the product card's "full name on long-press"). Fires `onLongPress`
// after `ms` of an unmoved TOUCH press (mouse users have the title tooltip), and swallows the
// click that follows so the long-press does not also navigate.
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fired.current = false;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove: clear,
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
```

**Two details for the executor:**
- `onPointerMove` clears the timer, so scrolling a row never triggers it. If that proves too
  sensitive on a real phone, a few pixels of movement tolerance is acceptable; note it in the report.
- Calling `e.preventDefault()` in the click capture on a `<Link>` stops the navigation.

### Action 4.4 — `components/shared/Logo.tsx` (P11)

When `logoUrl` is set, wrap the `<img>` in
`<AssetTile className="rounded-md p-1" >…</AssetTile>`, and keep the overall height equal to `size`:
- the img's `height` becomes `size - 8` (the `p-1` and the 1px border);
- `maxWidth` is `size * 3`.

The `Box` fallback is unchanged (no tile). Add one line to the top comment: "S39 — the uploaded
logo sits on the light asset tile in every theme and every header (storefront and back-office)."

---

## §5 — UI

### Action 5.1 — rewrite `components/shared/ProductCard.tsx` (P7, P8, P9, P1, §0.5)

**Keep:** `React.memo`, the heart mutation logic and its toasts, the price-resolution lines and
their comment, and the S20 memo comment.

**Structure:**

```tsx
<Card className={cn("group relative flex h-full flex-col overflow-hidden border-border transition-shadow hover:ring-2 hover:ring-highlight focus-within:ring-2 focus-within:ring-highlight", className)}>
  {/* image box — the light asset tile, both themes (P9) */}
  <AssetTile className="relative aspect-square rounded-none border-0 border-b">
    {primaryImage ? (
      <img src={primaryImage.thumbnailUrl ?? primaryImage.url} alt={primaryImage.alt ?? product.name}
           className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105" loading="lazy" />
    ) : (
      <Package className="h-10 w-10" aria-hidden="true" />   /* inherits text-asset-tile-foreground */
    )}
    {/* badges (S37: highlight / highlightOutline) — top-left, unchanged variants */}
    {/* heart (clients only) — relative z-10, top-right; visible on touch, hover-revealed on md+ */}
  </AssetTile>
  <div className="flex flex-1 flex-col gap-1 p-3">
    <p className="truncate text-xs text-muted-foreground">{product.brand.name}</p>
    <h3 className="text-sm font-medium leading-snug" title={product.name}>
      <Link to={`/products/${product.id}`}
            className={cn("[-webkit-touch-callout:none] after:absolute after:inset-0 focus-visible:outline-none",
                          expanded ? "" : "line-clamp-2")}
            {...longPress}>
        {product.name}
      </Link>
    </h3>
    <div className="mt-auto pt-1">
      {shouldShowPrice && resolvedPrice !== undefined ? (
        <p className="text-lg font-extrabold leading-tight text-foreground sm:text-xl">{formatPrice(resolvedPrice)}</p>
      ) : (
        <p className="relative z-10 text-xs text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">{t("products.signIn")}</Link>{" "}
          {t("products.viewPrices")}
        </p>
      )}
    </div>
  </div>
</Card>
```

**Notes:**
- `const [expanded, setExpanded] = useState(false); const longPress = useLongPress(() => setExpanded(true));`
- **Name height:** the 2-line clamp keeps every card's name area at most 2 lines. Add `min-h-[2.5em]`
  on the `h3` so a 1-line name doesn't shift the price up relative to its neighbours.
- **Heart button:** `className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-asset-tile/90 text-asset-tile-foreground shadow-sm md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"`.
  - When `product.inCart`, the `Heart` icon gets `fill-highlight text-highlight`.
  - Keep its `aria-label` keys.
  - The old `hover:text-red-500`, `fill-red-500` and `text-black-500` go: raw colours, and F4.
- **Badges:** `absolute left-2 top-2 z-10 flex flex-wrap gap-1` (the variants are unchanged from
  S37).
- **Removed:** the description, the family/model line, the "View details" button and its `Eye`
  import (P7), `handleViewDetails` and `useNavigate`, and the `shadow-card` / gradient classes.
- **Header comment:** add an S39 paragraph listing P1, P7, P8 and P9, and why the price uses
  foreground.

### Action 5.2 — create `components/sections/landing/home-section-header.tsx` (P4)

```tsx
// S39 — the one compact header every home section uses (P4): marker title left, optional
// "See all" right. No description paragraph — first-screen height is the point.
export function HomeSectionHeader({ title, seeAllTo }: { title: string; seeAllTo?: string }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <SectionTitle className="min-w-0 text-xl font-bold md:text-2xl">{title}</SectionTitle>
      {seeAllTo && (
        <Link to={seeAllTo} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {t("home.rows.seeAll")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
```

### Action 5.3 — create `components/sections/landing/product-row.tsx` (P10)

Props: `{ title; seeAllTo?; products: ProductWithPricingDto[]; isLoading; isError; onRetry }`.

**States:**
- **Loading:** the header, plus 4 skeleton cards (`Skeleton aspect-square` + two lines) at the
  card widths below.
- **Error:** the header, plus a compact `NotFoundState`
  (`products.errorLoading` / `products.errorLoadingBody`, with a retry button). The same copy as
  `ProductGrid`'s error.
- **Empty:** `return null` (PUB-01: an empty section hides itself).

**Scroller:**

```tsx
<div className="relative">
  <ul ref={scrollerRef}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
    {products.map((p) => (
      <li key={p.id} className="w-[42%] shrink-0 snap-start sm:w-[29%] md:w-[22%] lg:w-[18%]">
        <ProductCard product={p} />
      </li>
    ))}
  </ul>
  {/* md+ only: prev/next — scrollBy one viewport of the row */}
  <Button variant="secondary" size="icon" className="absolute -left-3 top-1/3 hidden rounded-full shadow md:inline-flex"
          aria-label={t("home.rows.scrollPrevious")} onClick={() => scrollBy(-1)}><ChevronLeft …/></Button>
  <Button … className="absolute -right-3 …" aria-label={t("home.rows.scrollNext")} onClick={() => scrollBy(1)}><ChevronRight …/></Button>
</div>
```

- `scrollBy(dir) = scrollerRef.current?.scrollBy({ left: dir * scrollerRef.current.clientWidth * 0.9, behavior: "smooth" })`.
- The `-mx-4 px-4` lets the row bleed to the screen edge on phones (the partial card touches the
  edge), and is cancelled from `md` up.
- **No page overflow:** the `ul` is the only scroller, and its parent section is `min-w-0`. Check
  with the S37 console one-liner.

### Action 5.4 — the three rows. Create them; delete `products-section.tsx`

1. **`featured-products-row.tsx`**
   - Move the data logic from `products-section.tsx` **verbatim**: settings ids first, with the
     `featured: true` fallback, and its S15/F3 comment.
   - Then apply P13:

     ```ts
     const items = featuredIds.length
       ? [...products].sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id))
       : products;
     ```

   - Render `<ProductRow title={t("products.featured")} seeAllTo="/products" …/>`.
   - **Delete** the search input, the family select, the grid/list toggle and their state (the
     set). Delete `components/sections/landing/products-section.tsx`.
2. **`new-arrivals-row.tsx`:** `useNewArrivals()` →
   `<ProductRow title={t("home.rows.newArrivals")} seeAllTo={catalogNewestLink()} …/>`.
3. **`repair-tools-row.tsx`** (P12):
   - Read `usePublicSettings()` and `useCatalogFamilies()` (public, enabled, cached by the header
     bar). Then:

     ```ts
     const familyId = settings?.storefront.repairToolsFamilyId;
     const familyEnabled = !!familyId && (families ?? []).some((f) => f.id === familyId);
     const { data, isLoading, isError, refetch } = useCatalogProducts(
       { familyId, page: 1, limit: NEW_ARRIVALS_DEFAULT_LIMIT },
       { enabled: familyEnabled },
     );
     ```

   - If the family isn't enabled, `return null`.
   - Render `<ProductRow title={t("home.rows.repairTools")} seeAllTo={catalogFamilyLink(familyId)} …/>`.
   - `familyId` is only passed once it's known; build the query object conditionally to satisfy
     `exactOptionalPropertyTypes`.

### Action 5.5 — rewrite `components/sections/landing/categories-section.tsx`

**Keep:**
- the data logic: settings `featuredFamilyIds` first, then the `isFeatured` fallback, 6 tiles;
- its comments;
- the loading and error states, with the skeleton made to match the new layout.

**Layout:**

```tsx
<section className="min-w-0">
  <HomeSectionHeader title={t("categories.title")} seeAllTo="/products" />
  <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
    {items.map((family) => (
      <li key={family.id} className="w-[28%] shrink-0 snap-start sm:w-[20%] md:w-auto">
        <Link to={catalogFamilyLink(family.id)}
              className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-shadow hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
          <AssetTile className="aspect-square w-full max-w-[6rem]">
            {family.iconUrl ? <img src={family.iconUrl} alt="" className="h-full w-full object-contain p-3" loading="lazy" />
                            : <Package className="h-8 w-8" aria-hidden="true" />}
          </AssetTile>
          <span className="line-clamp-2 text-xs font-medium sm:text-sm">{family.name}</span>
          {family.productCount !== undefined && (
            <span className="text-xs text-muted-foreground">{t("categories.productCount", { count: family.productCount })}</span>
          )}
        </Link>
      </li>
    ))}
  </ul>
</section>
```

- The icon `alt` is `""`, because the family name is right below it (no duplicate announcement).
- On phones this is a horizontal row; from `md` up it is a full 6-column row (the set).

### Action 5.6 — rewrite `components/sections/landing/brands-section.tsx` (F8)

- **Delete:** the carousel state and handlers, the `maxBrands` / `showScrollButtons` /
  `showViewAllButton` props, the `BrandCard` "View products" hover button, and the mobile scroll
  indicators.
- **Grid of every brand:**

  ```tsx
  <section className="min-w-0">
    <HomeSectionHeader title={t("brands.title")} />
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8">
      {brands.map((brand) => (
        <li key={brand.id} className="min-w-0">
          <Link to={catalogBrandLink(brand.id)} className="group flex flex-col items-center gap-1.5 rounded-xl p-1 text-center transition-shadow hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
            <AssetTile className="aspect-square w-full">
              {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                             : <span className="text-lg font-bold">{brand.name.charAt(0)}</span>}
            </AssetTile>
            <span className="w-full truncate text-xs font-medium">{brand.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
  ```

- The fallback initial inherits `text-asset-tile-foreground`.
- **Keep:** the loading skeleton (an 8-tile grid) and the error state with retry. They use the
  same header.
- Convert the file to the repo's double-quote style while rewriting it. It is a full rewrite, so
  `--fix` is allowed.
- Update the comments.

### Action 5.7 — `pages/Index.tsx` (P3, P4)

Replace the three lazy sections with five, in this order:

```tsx
<main>
  <ErrorBoundary><HeroSlider /></ErrorBoundary>
  <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:space-y-12">
    {[CategoriesSection, FeaturedProductsRow, NewArrivalsRow, RepairToolsRow, BrandsSection].map(…)}
  </div>
</main>
```

- Write each section explicitly, not via `map`, because each one gets its own lazy import:
  `<ErrorBoundary><Suspense fallback={<RowSkeleton />}>…</Suspense></ErrorBoundary>`.
- `max-w-6xl px-4` aligns the home content with the S37 header and the S38 footer.
- Replace `SectionSkeleton` with a compact `RowSkeleton`: a title bar plus 4 squares, using the row
  widths.
- Keep `memo` and `displayName`.

### Action 5.8 — `pages/admin/settings/components/hierarchy-panel.tsx` (P14, F3)

- Under the **Families** and **Brands** `CardTitle`s, add:

  ```tsx
  <CardDescription>
    {t("admin.settings.hierarchy.assetGuidance", {
      min: LOGO_IMAGE_GUIDANCE.minSize,
      padding: LOGO_IMAGE_GUIDANCE.paddingPercent,
    })}
  </CardDescription>
  ```

  Import `CardDescription`.
- The two 32px preview boxes (`bg-muted`) become `<AssetTile className="h-8 w-8 shrink-0 rounded">`.
  The admin then sees exactly what the storefront shows, and a dark logo stays visible in the dark
  admin theme. The `ImageIcon` fallback inherits the tile foreground.

### Action 5.9 — `pages/Products.tsx` (P6)

Set the `ProductGrid` `columns` to `{ mobile: 2, tablet: 3, desktop: 4 }`, and add a one-line S39
comment. `ProductGrid`'s skeleton and card markup need no change: the card owns its own look.

---

## §6 — Translation keys (`Apps/web/src/config/translations.json`)

Every entry is `{ "en", "fr", "ar": "" }`. Grep first and reuse an existing key with the same
meaning; list each reuse in the report.

| Key | en | fr |
|---|---|---|
| `home.rows.seeAll` | See all | Voir tout |
| `home.rows.newArrivals` | New arrivals | Nouveautés |
| `home.rows.repairTools` | Repair tools | Outils de réparation |
| `home.rows.scrollPrevious` | Scroll back | Défiler vers la gauche |
| `home.rows.scrollNext` | Scroll forward | Défiler vers la droite |
| `admin.settings.hierarchy.assetGuidance` | Logos and icons: square, at least {min} px, trimmed of empty space, with about {padding}% padding inside. Transparent PNG or WebP — they are shown on a light tile in both themes. | Logos et icônes : carrés, au moins {min} px, sans marges vides, avec environ {padding} % de marge intérieure. PNG ou WebP transparent — ils s'affichent sur une tuile claire dans les deux thèmes. |

**Value fix:** `brands.title` `en` → "Our Brands" (F7).

**Reused:**
- `products.featured`, `categories.title`, `categories.productCount`, `brands.title`;
- `products.signIn`, `products.viewPrices`;
- `products.errorLoading`, `products.errorLoadingBody`, `common.actions.tryAgain`;
- the heart's `wishlist.*` keys, and the badges' `products.outStock` / `cart.inCart`.

---

## §7 — Files touched (summary for the report)

**Contract:** `catalog.constants.ts`, `catalog.query.ts`, `catalog.routes.ts`, `common/media.ts`.

**API:** `catalog.service.ts`, `catalog.interface.ts`, `catalog.controller.ts`, `catalog.routes.ts`.

**Web, new:**
- `components/shared/AssetTile.tsx`
- `hooks/use-long-press.ts`
- `components/sections/landing/{home-section-header,product-row,featured-products-row,new-arrivals-row,repair-tools-row}.tsx`

**Web, edited:**
- `index.css`, `tailwind.config.ts`
- `lib/query-keys.ts`, `lib/deep-links.ts`
- `services/catalog.service.ts`, `hooks/useCatalogProducts.ts`, `hooks/useClientPortal.ts`
- `components/shared/{ProductCard,Logo}.tsx`
- `components/sections/landing/{categories-section,brands-section}.tsx`
- `pages/Index.tsx`, `pages/Products.tsx`
- `pages/admin/settings/components/hierarchy-panel.tsx`
- `config/translations.json`

**Web, deleted:** `components/sections/landing/products-section.tsx`.

**Not touched:**
- the Prisma schema (no migration);
- the image pipeline (alpha verified, §0.2);
- the S38 hero and footer logic;
- `ProductGrid` (only its `columns` prop at the call site).

---

## §8 — Manual verification checklist (owner, in the browser)

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
2. **Light theme:** the same tiles are white with a thin border, and their edges are visible on
   the white page.
3. A brand with **no logo** shows its initial letter in dark grey on the tile (readable in both
   themes). A family with no icon shows the package glyph.
4. **Settings → Hierarchy:**
   - the Families and Brands cards show the guidance line (square, ≥ 512 px, trimmed, ~10%
     padding, transparent);
   - the 32px previews are light tiles in dark mode.
5. Upload a transparent PNG logo. On the storefront tile there is **no white rectangle** around the
   logo shape (alpha preserved, §0.2). In light mode it simply blends into the white tile.

### B. Home page structure (phone and desktop)
1. The order is: hero → **Categories** → **Featured products** → **New arrivals** →
   **Repair tools** (only if configured) → **Brands**.
2. There is **no** search box, family select or grid/list toggle on the home page.
3. Every section has a left title with the highlight marker. Categories and each product row have a
   **"See all"** link on the right.
4. On desktop, the categories row and the start of the featured row are visible on the first
   screen under the hero.

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
5. **Repair tools:** with no family set in Settings → Storefront, the row is absent. Set a family →
   its products appear, and "See all" opens that family. Disable that family → the row disappears.
6. A row whose source is empty does not render at all.
7. At 320px there is **no horizontal page scroll** (the S37 one-liner prints `[]`): only the rows
   themselves scroll.

### E. Product cards (home rows **and** the catalog page)
1. The names show in their stored, normal capitalisation (no ALL CAPS), **at most 2 lines** with an
   ellipsis.
2. **Desktop:** hovering a long name shows the full name (native tooltip).
3. **Phone:** a **long-press** (~½ s) on a long name **expands** it to show the full name, and does
   **not** open the product. A normal tap opens the product page.
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

## §9 — Execution protocol

Execute this set, then write `Docs/Stage-04-Fixes/results/report-S39.md`. It covers:
- what changed, file by file;
- F1–F8 and P1–P14 as applied;
- the alpha verification (§0.2);
- the new-arrivals smoke output;
- every translation key reused;
- the gate results (§0.7).

End the report with the verification checklist above. The owner reviews and approves. This closes
the S37–S39 storefront overhaul.
