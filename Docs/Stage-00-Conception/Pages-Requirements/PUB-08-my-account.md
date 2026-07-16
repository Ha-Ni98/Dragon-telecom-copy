# PUB-08 — My Account

## Layout
- Public shell, mobile-first, two tabs. Route: `/my-account`.

## UI
- **Profile tab**: personal-info card (firstName, lastName, **phone read-only**; email, storeName, wilaya/commune, address editable via Edit/Save/Cancel), password card, status card (badge **"Active"** only, member-since — **category never rendered**).
- **Billing tab**: `MoneyStatusCard` — credit (owed), total paid, **total sold** (lifetime purchases) — from the linked POS client; shortcuts to My Orders and My Invoices.

## Interactions
- Edit toggles the profile card into a form; Cancel restores; Save patches. Password form is independent.

## Forms
- Profile: `UpdateMeCommand` (RHF + zodResolver) — phone excluded from the schema entirely. Submit → PATCH /api/clients/me.
- Password: `ChangePasswordCommand` (current + new + confirm with a refine) → POST /api/clients/me/password; success toast, form reset.

## Data dependencies
- `useMe()` → `['me']` → GET /api/clients/me (skeleton cards / error retry).
- Mutations: `useUpdateMe()` invalidates `['me']`; `useChangePassword()` (no invalidation).

## Access
- Clients only — `ProtectedRoute(client)`.
