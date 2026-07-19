// Each "(/:number)(/pdf)" row expands to three literal paths (base, base/:number,
// base/:number/pdf); CLIENT_PAYMENTS is dual-mounted "(staff|admin)" — same
// route-splitting pattern as sprints 2, 5, and 6.
export const BILLING_ROUTES = {
  MY_INVOICES: '/clients/me/invoices',
  MY_INVOICE_BY_NUMBER: '/clients/me/invoices/:number',
  MY_INVOICE_PDF: '/clients/me/invoices/:number/pdf',
  STAFF_INVOICES: '/staff/invoices',
  STAFF_INVOICE_BY_NUMBER: '/staff/invoices/:number',
  STAFF_INVOICE_PDF: '/staff/invoices/:number/pdf',
  ADMIN_INVOICES: '/admin/invoices',
  ADMIN_INVOICE_BY_NUMBER: '/admin/invoices/:number',
  ADMIN_INVOICE_PDF: '/admin/invoices/:number/pdf',
  CANCEL: '/admin/invoices/:number/cancel',
  STAFF_CLIENT_PAYMENTS: '/staff/client-payments',
  ADMIN_CLIENT_PAYMENTS: '/admin/client-payments',
  CLIENT_PAYMENTS_LIST: '/admin/client-payments',
} as const;
