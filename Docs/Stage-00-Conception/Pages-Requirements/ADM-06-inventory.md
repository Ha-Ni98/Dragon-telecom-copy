# ADM-06 — Inventory

## Layout
- Admin shell, desktop-first, four tabs. Route: `/admin/inventory`.

## UI
- **Stock levels**: `DataTable` — product, on hand, reserved, available, avg cost, stock value, threshold; low rows highlighted; low-only filter; CSV export button.
- **Movement ledger**: append-only table — date, product, type chip (IN/OUT/PENDING color-coded), signed qty, remaining qty (IN), cost of goods + profit (OUT), balance after, clickable reference, staff, reason. Filters: product, type, date range, staff.
- **Pending / reserved**: product, qty, holder chip (order/repair reference, clickable), **age**.
- **Adjustments**: `AdjustmentForm` — reason select, optional note, line editor (product picker, counted vs system qty, live delta chip; IN deltas reveal a unitCost field prefilled with avg cost and an optional collapsed reprice sub-form prefilled with current prices).

## Interactions
- Reference links resolve to the causing document (sale, order, supplier invoice, repair, return, adjustment) — this is the "where did those four batteries go" page. Export streams the filtered stock table.

## Forms
- `CreateAdjustmentCommand` via RHF + zodResolver (unitCost required per IN-delta line via refine). Submit → POST /api/admin/inventory/adjustments; success toast with the ADJ reference; per-line errors inline.

## Data dependencies
- `useStock(filters)` → `['inventory','stock',filters]`; `useMovements(filters)` → `['inventory','movements',filters]`; `useReservations()` → `['inventory','reservations']`.
- Mutation: `useCreateAdjustment()` invalidates all three + `['admin','products']`.

## Access
- Admin only.
