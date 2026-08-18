// S14/F4 — report rows are open records (ReportDto.rows), so their column headers were rendered
// as raw field names ("posClientId", "resolvedRevenue"). One flat field-name map is enough — the
// field names are already consistent across every report method in statistics.service.ts. A
// field with no entry falls back to its own name (report-picker.tsx), so a new backend column
// never crashes the table, it just reads unlabeled until this map is extended.
export const REPORT_COLUMN_KEY: Record<string, string> = {
  productId: "admin.statistics.reports.columns.productId",
  productName: "admin.statistics.reports.columns.productName",
  quantity: "admin.statistics.reports.columns.quantity",
  revenue: "admin.statistics.reports.columns.revenue",
  cost: "admin.statistics.reports.columns.cost",
  profit: "admin.statistics.reports.columns.profit",
  discount: "admin.statistics.reports.columns.discount",
  resolvedRevenue: "admin.statistics.reports.columns.resolvedRevenue",
  posClientId: "admin.statistics.reports.columns.posClientId",
  clientName: "admin.statistics.reports.columns.clientName",
  categoryId: "admin.statistics.reports.columns.categoryId",
  categoryName: "admin.statistics.reports.columns.categoryName",
  salesCount: "admin.statistics.reports.columns.salesCount",
  staffId: "admin.statistics.reports.columns.staffId",
  staffName: "admin.statistics.reports.columns.staffName",
  supplierId: "admin.statistics.reports.columns.supplierId",
  supplierName: "admin.statistics.reports.columns.supplierName",
  spend: "admin.statistics.reports.columns.spend",
  status: "admin.statistics.reports.columns.status",
  count: "admin.statistics.reports.columns.count",
  totalAmount: "admin.statistics.reports.columns.totalAmount",
  type: "admin.statistics.reports.columns.type",
  totalQuantity: "admin.statistics.reports.columns.totalQuantity",
  movementCount: "admin.statistics.reports.columns.movementCount",
  flagged: "admin.statistics.reports.columns.flagged",
  bucket: "admin.statistics.reports.columns.bucket",
  clientOutstanding: "admin.statistics.reports.columns.clientOutstanding",
  supplierOutstanding: "admin.statistics.reports.columns.supplierOutstanding",
  query: "admin.statistics.reports.columns.query",
  viewCount: "admin.statistics.reports.columns.viewCount",
  kind: "admin.statistics.reports.columns.kind",
  // S24 (A4/A5) — added when reports' `totals` started rendering and reportRepairs' row shape
  // changed (`totalAmount` -> `accruedAmount`, `revenue`/`cost`/`profit` dropped from rows).
  accruedAmount: "admin.statistics.reports.columns.accruedAmount",
  totalRevenue: "admin.statistics.reports.columns.totalRevenue",
  totalDiscount: "admin.statistics.reports.columns.totalDiscount",
  totalSpend: "admin.statistics.reports.columns.totalSpend",
  recognizedRevenue: "admin.statistics.reports.columns.recognizedRevenue",
  recognizedCost: "admin.statistics.reports.columns.recognizedCost",
  recognizedProfit: "admin.statistics.reports.columns.recognizedProfit",
  totalClientOutstanding: "admin.statistics.reports.columns.totalClientOutstanding",
  totalSupplierOutstanding: "admin.statistics.reports.columns.totalSupplierOutstanding",
  movementTypeCount: "admin.statistics.reports.columns.movementTypeCount",
  totalRepairs: "admin.statistics.reports.columns.totalRepairs",
  topSearchCount: "admin.statistics.reports.columns.topSearchCount",
  zeroPurchaseProductCount: "admin.statistics.reports.columns.zeroPurchaseProductCount",
};

// S24 (A8) — report cells were rendered with a bare `toLocaleString()`: no currency, and no
// locale argument, so money followed the browser rather than the app language (the same defect
// S14/F5 fixed in the stat cards). These keys render through formatDZD; everything else stays an
// integer count.
export const REPORT_MONEY_KEYS = new Set([
  "revenue",
  "cost",
  "profit",
  "discount",
  "resolvedRevenue",
  "spend",
  "totalAmount",
  "accruedAmount",
  "clientOutstanding",
  "supplierOutstanding",
  "totalRevenue",
  "totalDiscount",
  "totalSpend",
  "recognizedRevenue",
  "recognizedCost",
  "recognizedProfit",
  "totalClientOutstanding",
  "totalSupplierOutstanding",
]);
