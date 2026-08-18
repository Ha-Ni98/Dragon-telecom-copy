# Module: catalog
Merges: taxonomy (brands / device models / families + m2m), product (products, images, prices, resolution), client-category.

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `CATALOG_ROUTES.BRANDS` | GET `/api/brands` | public | enabled; logos for Home |
| `CATALOG_ROUTES.FAMILIES` | GET `/api/families?featured=&limit=&withCount=` | public | icons; featured=6 feeds Home |
| `CATALOG_ROUTES.MODELS` | GET `/api/models?brandId=` | public | cascade source |
| `CATALOG_ROUTES.PRODUCTS` | GET `/api/products` | public | viewer-resolved pricing |
| `CATALOG_ROUTES.PRODUCT_DETAIL` | GET `/api/products/:id` | public | + related ids |
| `CATALOG_ROUTES.STAFF_PRODUCTS` | GET `/api/staff/products` | staff(STAFF_PRODUCTS)\|admin | qty + 4 prices, read-only |
| `CATALOG_ROUTES.ADMIN_PRODUCTS` | GET/POST/PATCH `/api/admin/products(/:id)` | admin | POST multipart w/ initial stock |
| `CATALOG_ROUTES.PRICING` | PATCH `/api/admin/products/:id/pricing` | admin | also the reprice-prompt target |
| `CATALOG_ROUTES.IMAGES` | POST/PATCH `/api/admin/products/:id/images` | admin | |
| `CATALOG_ROUTES.PRODUCT_STATS` | GET `/api/admin/products/stats` | admin | total/in/low/out |
| `CATALOG_ROUTES.ADMIN_TAXONOMY` | GET/POST/PATCH `/api/admin/{brands|families|models}(/:id)` | admin | disable only; inline create |
| `CATALOG_ROUTES.MODEL_FAMILIES` | PUT `/api/admin/models/:id/families` | admin | `{ familyIds: uuid[] }` |
| `CATALOG_ROUTES.CATEGORIES` | GET `/api/admin/client-categories` | staff\|admin | POS + forms need it |
| `CATALOG_ROUTES.CATEGORIES_CUD` | POST/PATCH `/api/admin/client-categories(/:id)` | admin | **name only** |

```
ProductListQuery { search?; familyId?; brandId?; modelId?; inStock?; featured?; sort?; page?; limit=15 }
ProductWithPricingDto { id; name; description?; barcode?; createdAt;
  brand{id;name}; model?{id;name}; family{id;name;iconUrl?}; images: ImageDto[];
  currentPrice?; guestPrice?; priceHidden: boolean; inStock: boolean; inCart: boolean }
StaffProductDto { id; name; barcode?; family; brand; model?; availableQuantity;
  defaultSalePrice?; categoryPrices: { categoryId; categoryName; price }[] }
AdminProductDto { ...core; quantityOnHand; quantityReserved; availableQuantity; avgStockPrice; avgPrice;
  reorderThreshold; stockStatus: 'in_stock'|'low_stock'|'out_of_stock'; isPublished; isEnabled }
CreateProductCommand { barcode?; name; description?;
  familyId|newFamilyName; brandId|newBrandName; modelId?|newModelName?;
  initialQuantity: int.min(0); initialUnitCost?;            // required iff initialQuantity>0
  guestPrice?; defaultSalePrice?; categoryPrices?: {categoryId;price}[];  // allowed iff initialQuantity>0
  reorderThreshold? }
UpdatePricingCommand { guestPrice?: number|null; defaultSalePrice?; categoryPrices?: {categoryId;price}[] }
ClientCategoryDto { id; name; isEnabled; memberCount; pricedProductCount }
BrandDto / FamilyDto (incl. iconUrl, isFeatured) / DeviceModelDto (incl. familyIds) — as in the DB description
```

## Events [CONTRACT]
- Emits `product.created`, `product.repriced`, `taxonomy.changed`, `clientCategory.changed` (audit); `product.searched { userId; query; matchedProductId? }` (activity/observability listens — fired by staff/admin list searches).
- Listens: none critical. Calls **injected `InventoryService.addLayer(INITIAL_STOCK)`** when `initialQuantity > 0`.

## Business Logic [BACKEND]
1. **Price resolution** (one function reused by storefront, POS, orders): viewer's POS-client category tier row → storefront `guestPrice` / POS `defaultSalePrice` → `priceHidden` / "price on request". Guests with null guestPrice: hidden and unorderable.
2. Product creation: `initialQuantity = 0` ⇒ pricing fields rejected (`PRICING_REQUIRES_STOCK`), product born price-less; `> 0` ⇒ `initialUnitCost` required, first FIFO layer created in the same transaction, pricing unlocked.
3. `inCart` joined from ClientCart for CLIENT tokens; always false otherwise. Storefront never leaks cost, exact quantities (boolean inStock only), reserved, or margins; staff DTO adds availableQuantity + the 4 sale prices, still no cost.
4. Taxonomy: names unique (model per brand); slugs generated; one family nesting level; **disable only** — disabled entities vanish from public lists and pickers, products keep references and stay sellable. Featured families capped at 6 enabled. Model↔family PUT replaces the set.
5. Categories: name unique; disable requires zero enabled POS-client members (`CATEGORY_IN_USE` + count); creating one creates **no** prices; `pricedProductCount` warns of sparse tiers. Nothing assumes three categories — that cap is front-end.
6. quantity/avgStockPrice/avgPrice columns are **owned by inventory** — this module never writes them.

## Test Scenarios [BACKEND]
Resolution matrix (client+tier / client no-tier / guest priced / guest null). initialQuantity 0 + prices → 400; >0 without cost → 400; >0 creates the layer. Guest DTO leak check. Duplicate model in brand 409. Disabled brand hidden but its products' DTOs resolve. Category disable with members 409. Search emits `product.searched` with userId.
