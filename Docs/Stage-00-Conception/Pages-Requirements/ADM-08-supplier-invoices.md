# ADM-08 — Supplier invoices (goods receipt)

## Layout
- Admin shell, desktop-first. Routes: `/admin/supplier-invoices`, editor `/admin/supplier-invoices/:id`.

## UI
- List: internal ref, supplier ref, supplier, date, total, paid, status chip (DRAFT/CONFIRMED/CANCELLED), overdue flag; filters supplier/status/date.
- Editor (DRAFT): header form (supplier, supplier ref?, invoice date, due date?, shipping cost, note?) · **amount-only switch** (collapses the line editor into a single amount field) · line editor: product combobox with **inline create-product dialog** (a delivery must never be blocked by a missing catalog entry), qty, unit cost, serials?, line total; live footer: subtotal + shipping = total, per-line **landed unit cost** and **projected new avg cost**.
- Confirm bar → after success, the **reprice prompt**: one collapsible price form per received product, prefilled with current guest/default/category prices, per-product Apply / Skip and a Skip-all.

## Interactions
- DRAFT saves freely; PATCH after confirm → 409 surface. Cancel (reason optional) reverses credit; a banner explains stock reversal is a deliberate adjustment, with a shortcut to ADM-06.
- Record payment dialog: previews **previous credit → new credit**.

## Forms
- `CreateSupplierInvoiceCommand` via RHF + zodResolver (amountOnly XOR lines refine; per-line positive qty/cost). Reprice forms submit `UpdatePricingCommand` per product to the catalog endpoint. Payment: `CreateSupplierPaymentCommand`.

## Data dependencies
- `useSupplierInvoices(filters)` → `['supplier-invoices',filters]`; `useSupplierInvoice(id)`.
- Mutations: create/update draft; `useConfirmSupplierInvoice()` invalidates `['supplier-invoices']`, `['suppliers']`, `['inventory','*']`, `['admin','products']`; `useSupplierPayment()` invalidates invoices + suppliers.

## Access
- Admin only.
