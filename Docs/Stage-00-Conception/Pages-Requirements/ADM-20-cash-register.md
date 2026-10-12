# ADM-20 — Cash register (Caisse)

## Layout
- Admin shell, desktop-first. Route: `/admin/cash-register`. Sidebar entry **Cash register**, after Sales.

## UI
- Header: title, a note that days run midnight to midnight Algiers time, a date picker (no future dates), a **Today** button and **Refresh**.
- Five sections of stat cards, one Africa/Algiers day:
  - **Sales** (by `soldAt`): number of sales · total sold · total paid · new client credit (total − paid).
  - **Returns** (sale and order returns, by `returnedAt`): number of returns · total refunded.
  - **Repairs** (by `pickedUpAt`): repairs picked up · paid (gross, incl. anything refunded since) · unpaid · and, only when there were any that day, refunded (cancelled/returned repairs, dated on the cancellation/return).
  - **Orders**: confirmed (`confirmedAt`) · sent out for delivery (`inDeliveryAt`) · completed (`deliveredAt`) · paid on completed orders.
  - **Suppliers**: invoices confirmed (`confirmedAt`) · total invoiced · paid to suppliers (payments made that day, by `paidAt`) · new supplier credit (invoiced − paid).
- Count cards (and supplier payments) are clickable: a dialog lists the documents behind the figure — reference, local time, client/supplier (or "Comptoir"), amount, and paid / source document where relevant — 20 per page.

## Interactions
- Changing the date or pressing Today reloads every section; Refresh refetches. Every figure and its drill list use the same day bounds and the same filter, so the list always adds up to the figure.

## Data dependencies
- `useCashRegister({ date })` → `['stats','cash-register',{date}]`; `useCashRegisterDocuments({ date, drill, page, limit })` → `['stats','cash-register','documents',…]`. Both `staleTime: 0`.

## Access
- Admin only (API `adminOnly`; web route behind a nested `RoleGuard allow={[ADMIN]}`).
