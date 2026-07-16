# ADM-10 — Sales & returns

## Layout
- Admin shell, desktop-first. Route: `/admin/sales`.

## UI
- Filter bar (date range, seller, POS client, status — DRAFT included) · `DataTable`: reference, date, client (or "Comptoir"), seller, total, paid, status; footer totals for the filtered set.
- Detail drawer: lines with **resolved vs charged price**, cost of goods + **profit** per line, serials, credit snapshot (previous → new), invoice link, receipt reprint, **Issue return** button.
- `ReturnDialog`: line picker with per-line qty (≤ sold − already returned), **restock toggle** per line, refund amount (defaults to charged price, reducible), type refund/exchange, reason optional.

## Interactions
- Seller filter powers the "who discounts how much" review together with the resolved/charged columns. Return submits then flips the sale to (PARTIALLY_)RETURNED.

## Forms
- `CreateReturnCommand` via RHF + zodResolver (per-line quantity bounds validated server-side too).

## Data dependencies
- `useAdminSales(filters)` → `['sales','admin',filters]`; `useSale(reference)`.
- Mutation: `useCreateReturn()` invalidates `['sales','admin']`, `['inventory','*']`, `['pos-clients']`.

## Access
- Admin only.
