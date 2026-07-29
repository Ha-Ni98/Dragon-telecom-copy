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
export enum ReportFormat {
  TABLE = 'table',
  CSV = 'csv',
}
