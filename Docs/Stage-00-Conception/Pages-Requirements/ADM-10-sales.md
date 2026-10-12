# ADM-10 — Sales & returns

## Layout
- Admin shell, desktop-first. Route: `/admin/sales`.

## UI
- Filter bar (date range, seller, POS client, status — DRAFT included; S32: product search by name/barcode and a **Today's sales** toggle, both also on the staff twin; dates are Africa/Algiers days on soldAt) · `DataTable`: reference, date, client (or "Comptoir"), seller, total, paid, status; footer totals for the filtered set.
- Detail drawer: lines with **resolved vs charged price**, cost of goods + **profit** per line, serials, credit snapshot (previous → new), invoice link, receipt reprint, **Issue return** button.
- `ReturnDialog`: line picker with per-line qty (≤ sold − already returned), **restock toggle** per line, refund amount (S32: starts empty; walk-in must equal the sold price; for a client any difference opens a confirmation showing previous → new credit), type refund/exchange, reason optional. S32: a **Return whole sale** action returns every remaining line with one refund field under the same rules.

## Interactions
- Seller filter powers the "who discounts how much" review together with the resolved/charged columns. Return submits then flips the sale to (PARTIALLY_)RETURNED.

## Forms
- `CreateReturnCommand` via RHF + zodResolver (per-line quantity bounds validated server-side too).

## Data dependencies
- `useAdminSales(filters)` → `['sales','admin',filters]`; `useSale(reference)`.
- Mutation: `useCreateReturn()` invalidates `['sales','admin']`, `['inventory','*']`, `['pos-clients']`.

## Access
- Admin only.
