export const PURCHASING_ROUTES = {
  SUPPLIERS: '/admin/suppliers',
  SUPPLIER_BY_ID: '/admin/suppliers/:id',
  SUPPLIER_DETAIL: '/admin/suppliers/:id',
  SUPPLIER_STATS: '/admin/suppliers/stats',
  INVOICES: '/admin/supplier-invoices',
  INVOICE_BY_ID: '/admin/supplier-invoices/:id',
  CONFIRM: '/admin/supplier-invoices/:id/confirm',
  CANCEL: '/admin/supplier-invoices/:id/cancel',
  PAYMENTS: '/admin/supplier-payments',
} as const;
