# Module: identity
Merges: auth (sessions), user (users/roles/pages), refresh tokens, technicians registry.

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `IDENTITY_ROUTES.LOGIN` | POST `/api/auth/login` | public | username accepts username / email / phone |
| `IDENTITY_ROUTES.REFRESH` | POST `/api/auth/refresh` | public | rotation |
| `IDENTITY_ROUTES.LOGOUT` | POST `/api/auth/logout` | any authed | revoke |
| `IDENTITY_ROUTES.ME_PERMISSIONS` | GET `/api/me/permissions` | staff\|admin | effective page keys |
| `IDENTITY_ROUTES.USERS` | GET/POST/PATCH `/api/admin/users(/:id)` | admin | |
| `IDENTITY_ROUTES.ROLES` | GET/POST/PATCH `/api/admin/roles(/:id)` | admin | |
| `IDENTITY_ROUTES.ROLE_PAGES` | PUT `/api/admin/roles/:id/pages` | admin | STAFF-scope pages only |
| `IDENTITY_ROUTES.PAGES` | GET `/api/admin/pages?scope=staff` | admin | seeded registry |
| `IDENTITY_ROUTES.TECHNICIANS` | GET/POST/PATCH `/api/admin/technicians(/:id)` | admin | no user account |

```
LoginCommand { username; password }
LoginResultDto { authType: 'client'|'staff'|'admin'; accessToken; refreshToken; profile }
RefreshCommand { refreshToken } → RefreshResultDto { accessToken; refreshToken }
JwtPayload { sub: userId; type: 'CLIENT'|'STAFF'|'ADMIN'; clientId?; staffId? }     // contract common/
CreateUserCommand { username; email?; password; type: 'ADMIN'|'STAFF';
                    profile { firstName; lastName; phone?; jobTitle? };
                    roleIds?: uuid[] }    // required non-empty iff STAFF; forbidden iff ADMIN
UpdateUserCommand { isEnabled?; roleIds?; profile?; password? }
UserDto { id; username; email?; type; isEnabled; lastLoginAt?; profile; roles: RoleDto[]; effectivePages: string[] }
RoleDto { id; code; name; description?; isEnabled; pageKeys: string[] }
PageDto { key; label; group; scope: 'ADMIN'|'STAFF' }
TechnicianDto { id; name; phone?; isEnabled }
```

## Events [CONTRACT]
- Emits `auth.loggedIn { userId; authType; ipAddress? }`, `user.created`, `user.updated`, `user.roleChanged` — audit listens.
- Listens: none. Client approval and admin client-password-reset call the **injected `UserService`** (`createUser`, `resetPassword`) so credentials are atomic with the caller's transaction.

## Business Logic [BACKEND]
1. Login: enabled user by username/email/phone (phone joins Client) → Argon2id verify → access JWT 15 min + refresh 7 d (random 256-bit, **hash stored**) → `lastLoginAt` → emit. One generic 401 for unknown / wrong / disabled — no enumeration oracle. Rate-limit per IP + username.
2. Refresh rotates (revoke old, `replacedByTokenId`, new pair); reuse of a revoked token kills the whole chain. Disabling a user revokes all his tokens immediately. `UserService.resetPassword` also revokes the user's tokens.
3. Effective pages = union of enabled roles' pages; ADMIN ignores the matrix, resolved **per request** (not baked into the JWT). `role_pages` accepts STAFF-scope pages only (`VALIDATION_ERROR`).
4. Guard `LAST_ADMIN_PROTECTED`: the last enabled ADMIN cannot be disabled or demoted.
5. Technicians: plain rows (name, phone?, isEnabled) — never linked to users.

## Data Mapping [BACKEND]
Never expose passwordHash / token hashes / token ids. `effectivePages` computed in the mapper.

## Test Scenarios [BACKEND]
Three-way login routing. Identical 401 bodies. Rotation + chain-kill. Role-page union; ADMIN-scope page on a role → 400. Last-admin guard. resetPassword revokes tokens. Disabled role's pages drop immediately.
