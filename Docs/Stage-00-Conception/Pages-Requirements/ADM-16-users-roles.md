# ADM-16 — Users & roles

## Layout
- Admin shell, desktop-first, two tabs. Route: `/admin/users`.

## UI
- **Users**: `DataTable` — username, full name, job title, **type badge (admin | staff)**, roles, enabled, last login; filters type/role/status. `UserDialog`: credentials, staff profile, isEnabled, **type switch** — Admin hides the role matrix ("all pages"); Staff shows a role multi-select and renders the **resulting effective page list live**.
- **Roles**: role list + `RoleDialog` with the **page-permission matrix** over the **staff registry only**, grouped by section with select-all per group. System role rows read-only.

## Interactions
- Toggling type between admin/staff swaps the role section with client-side validation matching the server rule (roleIds required iff STAFF). Last-admin guard errors surface as a banner.

## Forms
- `CreateUserCommand` / `UpdateUserCommand` and role forms + `SetRolePagesCommand` — RHF + zodResolver with the type/roleIds refine.

## Data dependencies
- `useUsers(filters)` → `['users',filters]`; `useRoles()` → `['roles']`; `usePages('staff')` → `['pages','staff']`.
- Mutations invalidate `['users']` / `['roles']`; permission changes need no session refresh (resolved per request server-side).

## Access
- Admin only.
