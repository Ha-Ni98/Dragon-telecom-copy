export enum ReportType {
  SALES_BY_PRODUCT = 'sales-by-product',
  SALES_BY_CLIENT = 'sales-by-client',
  SALES_BY_CATEGORY = 'sales-by-category',
  SALES_BY_SELLER = 'sales-by-seller',
  STOCK_MOVEMENTS = 'stock-movements',
  REPAIRS = 'repairs',
  SUPPLIER_SPEND = 'supplier-spend',
  AGEING = 'ageing',
  CLIENT_BROWSING = 'client-browsing',
}

// From the CHARTS route note ("revenue | orders | clients | sales-by-family").
export enum ChartType {
  REVENUE = 'revenue',
  ORDERS = 'orders',
  CLIENTS = 'clients',
  SALES_BY_FAMILY = 'sales-by-family',
}

// Only "csv" is confirmed (Test Scenarios: "CSV shape = rows"); "table" is the inferred
// complement (the default JSON table + chart response).
// S25 adds PDF: the same rows, rendered server-side through pdf.utils.ts's renderTablePdf with
// the report's chart and totals. CSV is unchanged and stays alongside it.
export enum ReportFormat {
  TABLE = 'table',
  CSV = 'csv',
  PDF = 'pdf',
}

// S24 — the statistics page's revenue-source filter. PRODUCTS = sales + orders (goods sold);
// REPAIRS = repairs, whose revenue is parts + labour (owner decision Q3). Labour has no product
// and therefore no family, so a REPAIRS/ALL figure combined with a familyId filter necessarily
// excludes it.
export enum RevenueSource {
  ALL = 'all',
  PRODUCTS = 'products',
  REPAIRS = 'repairs',
}
