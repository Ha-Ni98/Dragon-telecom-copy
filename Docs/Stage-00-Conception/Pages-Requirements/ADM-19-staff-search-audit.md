# ADM-19 — Staff search audit

## Layout
- Admin shell, desktop-first. Route: `/admin/activity/staff-searches` (linked from Inventory and Audit pages).

## UI
- Filter bar (user, date range, query text) · `DataTable`: date, user, query, matched product (link). The inventory-count companion: "someone looked this part up and never rang it up."

## Interactions
- Product link → ADM-04 movements tab for cross-checking.

## Forms
- None.

## Data dependencies
- `useStaffSearches(filters)` → `['activity','staff-searches',filters]`.

## Access
- Admin only.
