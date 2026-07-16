# ADM-07 — Suppliers

## Layout
- Admin shell, desktop-first. Routes: `/admin/suppliers`, detail `/admin/suppliers/:id`.

## UI
- List: `StatCard` row (total, totalDue, totalPaid) · search · `DataTable` 10/page: name, contact, phone, email, location, **credit**, invoices count, last delivery, enabled · row actions: Edit → detail, Add invoice → ADM-08 create with the supplier preselected, Disable.
- `AddSupplierDialog` incl. **initialCredit**.
- Detail (edit-mode sections): contact card · financial card (credit, total invoiced, total paid — stored figures) · invoices table · payments ledger · **product history** (product, qty, unit cost, landed cost, date — the re-ordering reference).

## Interactions
- Disable hides from pickers, history intact. Financial card links into ADM-15 payment dialog.

## Forms
- `CreateSupplierCommand` / update subset via RHF + zodResolver → POST/PATCH /api/admin/suppliers.

## Data dependencies
- `useSuppliers(filters)` → `['suppliers',filters]`; `useSupplier(id)` → `['suppliers',id]`; `useSupplierStats()`.
- Mutations invalidate `['suppliers']` (+ id key).

## Access
- Admin only.
