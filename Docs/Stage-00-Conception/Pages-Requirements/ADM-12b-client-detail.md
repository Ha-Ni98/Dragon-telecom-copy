# ADM-12b — Client detail

## Layout
- Admin shell, desktop-first. Route: `/admin/clients/:id`.

## UI
- Header: name, code, status badge, category, member-since.
- Tabs: **Overview** (contact card, credit + total paid + total sold via the POS client, quick actions) · Orders · Invoices · Payments · **Browsing** — the price-snooping audit: last searches (query, date), **time spent per product page** (product, duration, date), catalog sessions; date-range + type filters. · **Products bought** (S36): product, qty bought, total amount, qty returned, amount refunded — returns shown separately, never netted; paginated (10). Clicking a row opens the documents behind the product (each sale/order line and each return: type, date, reference, quantity, unit price, line total / refunded); every reference links to its sale (`/admin/sales?sale=REF`, opens its drawer) or order (`/admin/orders?search=REF`), a return to the document it came from. A note explains amounts are line totals before a whole-sale discount and "refunded" is the cash handed back.
- Quick actions: **Reset password** (`ResetPasswordDialog`: new password + confirm; on success the client is logged out everywhere), Disable/Enable.

## Interactions
- Browsing rows link to the product. Reset password confirms with a warning that active sessions die.

## Forms
- `ResetClientPasswordCommand` via RHF + zodResolver (min length + confirm refine) → POST /api/admin/clients/:id/reset-password.

## Data dependencies
- `useAdminClient(id)` → `['clients','admin',id]`; `useClientActivity(id, filters)` → `['clients','activity',id,filters]` (lazy per tab).
- Mutations: reset-password (no invalidation), update (invalidates detail + list).
- S36 — `usePurchasedProducts({kind:'client', id}, {page,limit})` → `['purchase-history','products',owner,query]`; `usePurchasedProductDocuments(owner, productId, …)` → `['purchase-history','documents',…]` (fetched when the tab / a row opens).

## Access
- Admin only.
