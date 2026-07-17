export const PURCHASING_ROUTES = {
  SUPPLIERS: '/api/admin/suppliers',
  SUPPLIER_BY_ID: '/api/admin/suppliers/:id',
  SUPPLIER_DETAIL: '/api/admin/suppliers/:id',
  SUPPLIER_STATS: '/api/admin/suppliers/stats',
  INVOICES: '/api/admin/supplier-invoices',
  INVOICE_BY_ID: '/api/admin/supplier-invoices/:id',
  CONFIRM: '/api/admin/supplier-invoices/:id/confirm',
  CANCEL: '/api/admin/supplier-invoices/:id/cancel',
  PAYMENTS: '/api/admin/supplier-payments',
} as const;
