# ADM-12b — Client detail

## Layout
- Admin shell, desktop-first. Route: `/admin/clients/:id`.

## UI
- Header: name, code, status badge, category, member-since.
- Tabs: **Overview** (contact card, credit + total paid + total sold via the POS client, quick actions) · Orders · Invoices · Payments · **Browsing** — the price-snooping audit: last searches (query, date), **time spent per product page** (product, duration, date), catalog sessions; date-range + type filters.
- Quick actions: **Reset password** (`ResetPasswordDialog`: new password + confirm; on success the client is logged out everywhere), Disable/Enable.

## Interactions
- Browsing rows link to the product. Reset password confirms with a warning that active sessions die.

## Forms
- `ResetClientPasswordCommand` via RHF + zodResolver (min length + confirm refine) → POST /api/admin/clients/:id/reset-password.

## Data dependencies
- `useAdminClient(id)` → `['clients','admin',id]`; `useClientActivity(id, filters)` → `['clients','activity',id,filters]` (lazy per tab).
- Mutations: reset-password (no invalidation), update (invalidates detail + list).

## Access
- Admin only.
