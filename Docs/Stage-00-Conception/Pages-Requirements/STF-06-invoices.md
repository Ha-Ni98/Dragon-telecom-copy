# STF-06 — Staff invoices

## Layout
- Staff shell, desktop-first. Route: `/staff/invoices`.

## UI
- `DataTable` (invoices **he issued** only): number, date, client, source, total, paid, status · invoice snapshot view + PDF · `RecordPaymentDialog`.

## Interactions
- Record a cash payment against an invoice: the dialog previews **previous credit → new credit** before submit and shows both after.

## Forms
- `CreateClientPaymentCommand` (RHF + zodResolver): amount > 0, invoice preselected; submit → POST /api/staff/client-payments.

## Data dependencies
- `useStaffInvoices(filters)` → `['invoices','staff',filters]`; `useRecordClientPayment()` invalidates `['invoices','staff']` and `['pos-clients']`.

## Access
- Staff — `RoleGuard(STAFF_INVOICES)`.
