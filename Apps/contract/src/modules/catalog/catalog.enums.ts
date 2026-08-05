export enum StockStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
}

// Stage-0 page spec PUB-02's four sort keys (audit fix B3) — resolves catalog.query.ts's
// former free-string `sort` (Stage-01 sprint-2 open item).
export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME = 'name',
}

// S21 — admin-only visibility filter for the product list. Disabled products are otherwise
// unreachable: `/admin/products` can disable a row but never list it again. `ENABLED` is the
// default so every existing caller keeps today's behavior.
export enum ProductEnabledFilter {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ALL = 'all',
}
