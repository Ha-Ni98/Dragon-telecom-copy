// Each "(/:number)(/pdf)" row expands to three literal paths (base, base/:number,
// base/:number/pdf); CLIENT_PAYMENTS is dual-mounted "(staff|admin)" — same
// route-splitting pattern as sprints 2, 5, and 6.
export const BILLING_ROUTES = {
  MY_INVOICES: '/api/clients/me/invoices',
  MY_INVOICE_BY_NUMBER: '/api/clients/me/invoices/:number',
  MY_INVOICE_PDF: '/api/clients/me/invoices/:number/pdf',
  STAFF_INVOICES: '/api/staff/invoices',
  STAFF_INVOICE_BY_NUMBER: '/api/staff/invoices/:number',
  STAFF_INVOICE_PDF: '/api/staff/invoices/:number/pdf',
  ADMIN_INVOICES: '/api/admin/invoices',
  ADMIN_INVOICE_BY_NUMBER: '/api/admin/invoices/:number',
  ADMIN_INVOICE_PDF: '/api/admin/invoices/:number/pdf',
  CANCEL: '/api/admin/invoices/:number/cancel',
  STAFF_CLIENT_PAYMENTS: '/api/staff/client-payments',
  ADMIN_CLIENT_PAYMENTS: '/api/admin/client-payments',
  CLIENT_PAYMENTS_LIST: '/api/admin/client-payments',
} as const;
