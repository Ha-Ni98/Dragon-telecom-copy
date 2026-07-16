# ADM-18 — Audit logs

## Layout
- Admin shell, desktop-first. Route: `/admin/logs`.

## UI
- `StatCard` row (total, today, this week, this month) · filter bar (search, user select, action-type select, date from/to) · `DataTable` 20/page: date, user, action label, entity, **description** — one narrated string containing the before/after values.

## Interactions
- Filters refetch; entity cell links to the document where a route exists. **No mutation UI exists** — append-only, no delete, no purge.

## Forms
- None.

## Data dependencies
- `useAuditLogs(filters)` → `['logs',filters]`; `useLogStats()` → `['logs','stats']`. Skeleton rows / empty state / retry.

## Access
- Admin only.
