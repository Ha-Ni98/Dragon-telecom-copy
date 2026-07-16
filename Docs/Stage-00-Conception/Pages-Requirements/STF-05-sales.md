# STF-05 — Staff sales

## Layout
- Staff shell, desktop-first. Route: `/staff/sales`.

## UI
- Status filter (DRAFT / COMPLETED / …) · `DataTable`: reference, date, POS client (or "Comptoir"), total, paid, status. Detail drawer: lines with resolved vs charged price, serials, receipt figures, reprint button. **No profit/cost columns, no return action.**

## Interactions
- DRAFT rows open in the POS to finish. Reprint renders the stored receipt.

## Forms
- None.

## Data dependencies
- `useMySales(filters)` → `['sales','me',filters]`; `useSale(reference)` → `['sales',reference]` (403 view if not his — defense in depth; the API already scopes).

## Access
- Staff — `RoleGuard(STAFF_SALES)`.
