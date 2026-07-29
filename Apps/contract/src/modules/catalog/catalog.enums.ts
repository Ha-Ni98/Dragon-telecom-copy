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
