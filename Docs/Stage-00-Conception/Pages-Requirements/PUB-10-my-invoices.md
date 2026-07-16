# PUB-10 — My Invoices

## Layout
- Public shell, mobile-first. Route: `/invoices`.

## UI
- `DataTable`: number, date, source (sale | order — repairs never appear), total, paid, status badge. Row → read-only invoice view rendered from snapshot lines, with a PDF download button.

## Interactions
- Row opens the invoice view; PDF downloads via the pdf endpoint.

## Forms
- None.

## Data dependencies
- `useMyInvoices(page)` → `['invoices','me',page]`; `useMyInvoice(number)` → `['invoices','me',number]`. Loading skeletons / empty state / 404 view on foreign numbers.

## Access
- Clients only — `ProtectedRoute(client)`.
