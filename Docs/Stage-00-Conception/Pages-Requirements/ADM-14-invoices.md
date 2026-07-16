# ADM-14 — Invoices & payments

## Layout
- Admin shell, desktop-first, three tabs. Route: `/admin/invoices`.

## UI
- **Outgoing**: `DataTable` — number, date, client, source (sale | order), total, paid, status; filters client/status/source/date. Invoice view rendered from **snapshot lines** with serials, cost + profit per line, previous/new credit, and the **current avg cost** joined beside each product row; PDF + print; Record payment; Cancel (reason optional; numbers never reused).
- **Incoming**: read-only accounting view over supplier invoices (supplier, date, total, paid, outstanding, due date, overdue flag).
- **Payments**: two ledgers (client / supplier) — reference, counterpart, invoice or "on account", amount, **previous credit → new credit**, date, staff.

## Interactions
- Payment dialogs preview the credit movement before submit and echo it after.

## Forms
- `CreateClientPaymentCommand` and `CreateSupplierPaymentCommand` via RHF + zodResolver (amount > 0).

## Data dependencies
- `useAdminInvoices(filters)` → `['invoices','admin',filters]`; `useInvoice(number)`; `useClientPayments()` / `useSupplierPayments()` ledgers.
- Mutations: payments invalidate `['invoices','admin']`, `['pos-clients']` / `['suppliers']`; cancel invalidates the invoice keys.

## Access
- Admin only.
