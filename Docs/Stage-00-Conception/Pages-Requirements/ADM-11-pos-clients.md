# ADM-11 — POS clients

## Layout
- Admin shell, desktop-first. Route: `/admin/pos-clients`.

## UI
- `DataTable`: code, name, phone, category, **credit**, total paid, **total sold**, linked web account (username or —), enabled.
- `AddPosClientDialog` — **the only manual client creation in the app**: name*, phone?, category?, initialCredit?.
- Detail drawer: sales history, payments ledger, credit history.

## Interactions
- Record payment shortcut (ADM-15 dialog). Category change re-resolves future prices only (helper text says so).

## Forms
- `CreatePosClientCommand` / `UpdatePosClientCommand` via RHF + zodResolver.

## Data dependencies
- `usePosClients(filters)` → `['pos-clients',filters]`; `usePosClient(id)`.
- Mutations invalidate `['pos-clients']`.

## Access
- Admin only.
