# PUB-06 — Login

## Layout
- Public shell, centered card, mobile-first. Route: `/login`.

## UI
- One card for clients, staff, and admin: username field (accepts username / email / phone), password, submit, register link (clients).

## Interactions
- Success routes by `authType`: admin → `/admin`, staff → `/staff` (first permitted page from `useMyPermissions`), client → back-target or `/`. Auth provider stores the pair and silently refreshes (access 15 min / refresh 7 d).
- Failure: one generic message — never distinguishes unknown user / wrong password / disabled.

## Forms
- `LoginCommand` via RHF + zodResolver; submit → POST /api/auth/login; loading state on the button; server error banner.

## Data dependencies
- `useLogin()` mutation → invalidates `['session']`; staff/admin then `useMyPermissions()` → `['permissions']`.

## Access
- Public; authenticated visitors are redirected to their home surface.
