# STF-07 — Staff repairs

## Layout
- Staff shell, desktop-first. Route: `/staff/repairs`.

## UI / Interactions / Forms
- Identical components to ADM-13 (board, intake, ticket detail) — see ADM-13. Differences: the list is scoped to tickets **he created**; profit/cost columns are absent from his mapping.

## Data dependencies
- `useRepairs(filters)` → `['repairs',filters]` against /api/staff/repairs; mutations shared with ADM-13.

## Access
- Staff — `RoleGuard(STAFF_REPAIRS)` (optional page in the matrix).
