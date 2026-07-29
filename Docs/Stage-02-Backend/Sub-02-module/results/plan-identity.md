# Stage 02 · Sub-02 — Module Implementation Plan: `identity`

> **Scope of this document:** the plan only (no code). It maps the `identity` module's
> contract + Prisma schema onto the strict file architecture, defines every method, the
> business logic, the test strategy, and the wiring. Output per the user's constraint:
> `plan-identity.md` (the phase file suffixes `-[setnumber]`; identity is treated as its own set).

`identity` merges **auth/sessions + users/roles/pages + refresh tokens + technicians registry**
(spec `Docs/Stage-00-Conception/Module-Contracts/identity.md`). It is the **first API module** in
`Apps/api/src/modules/` — see the note below.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

I read the real contract package `@dragon-telecom/contract` (`Apps/contract/src/…`). Every
route/schema/DTO/event this module needs already exists (table below). **One deliberate addition**
is introduced per the owner's decision: a `PageKey` (and `PageGroup`) enum in the identity contract,
so the seeded page registry and its backend/test references carry **no magic strings** (rules
anti-pattern #4 — "enums and route constants only"); see §7.1. Nothing else is added to the contract.
Confirmed already present:

| Kind | Already in `@dragon-telecom/contract` |
|---|---|
| Routes | `IDENTITY_ROUTES.{LOGIN, REFRESH, LOGOUT, ME_PERMISSIONS, USERS, USER_BY_ID, ROLES, ROLE_BY_ID, ROLE_PAGES, PAGES, TECHNICIANS, TECHNICIAN_BY_ID}` |
| Enums | `UserType`, `PageScope`, `AuthType` (lowercase login discriminator) |
| Commands | `LoginSchema/Command`, `RefreshSchema/Command`, `CreateUserSchema/Command`, `UpdateUserSchema/Command`, `CreateRoleSchema/Command`, `UpdateRoleSchema/Command`, `SetRolePagesSchema/Command`, `CreateTechnicianSchema/Command`, `UpdateTechnicianSchema/Command` |
| Queries / params | `UserListQuerySchema/Query`, `PagesQuerySchema/Query`, `UserIdParamsSchema/Params`, `RoleIdParamsSchema/Params`, `TechnicianIdParamsSchema/Params` |
| DTOs + response schemas | `LoginResultResponseSchema/Dto`, `RefreshResultResponseSchema/Dto`, `StaffProfileResponseSchema/Dto`, `RoleResponseSchema/Dto`, `PageResponseSchema/Dto`, `TechnicianResponseSchema/Dto`, `UserResponseSchema/Dto` |
| Events | `IdentityEvents` = `{ 'auth.loggedIn', 'user.created', 'user.updated', 'user.roleChanged' }` |
| Common | `ApiResponse<T>`, `PaginationMeta`, `paginated()`, `JWTPayload/Schema`, `ErrorCode`, `BooleanQuerySchema` |

Foundations confirmed to exist and reused verbatim (never redefined): `prisma` (`@common/db/prisma`),
`sendSuccess` (`@common/http/response`), `eventBus` (`@common/events/event-bus`, already keyed by
`IdentityEvents`), `requireAuth` (`@common/middlewares/auth.middleware`), `validateRequest`
(`@common/middlewares/validate-request.middleware`), error classes (`@common/errors`:
`AppError/AuthError/ForbiddenError/NotFoundError/ConflictError/BadRequestError`), `generateToken`
(`@common/utils/token.utils`). **Password hashing** uses `hashPassword`/`comparePassword`
(`@common/utils/password.utils`) — but its internals are to be **switched from bcrypt to Argon2id**
per the owner's decision (§7.5 / §8 item 1); the util's signatures stay the same, so module code is unaffected.

> **⚠ Template-baseline mismatch (noted, not blocking).** The phase file says `auth` and
> `delivery-company` are pre-implemented reference modules and that new routers mount into
> `Apps/api/src/modules/index.ts`. **Neither exists** — `Apps/api/src/modules/` holds only
> `.gitkeep`, and the marked mount point is `apiRouter` in `Apps/api/src/app.ts:22`
> (`// EXTENSION POINT (modules)`). Identity is the first module; there is no in-repo module to
> mirror, so the plan follows `module-implementation-rules.md` + the contract as the shape
> authority. This matches the recorded source-of-truth (template `auth`/`delivery-company`
> modules are superseded examples).

---

## 1. Step 1 — Contract & Schema analysis

### 1.1 Prisma model ⇄ contract DTO mapping (the mapper's job)

| Prisma model | → contract DTO | Include (returned) | Exclude / transform |
|---|---|---|---|
| `User` (+ `Staff`, `userRoles→role→rolePages→page`) | `UserDto` | `id, username, email?, type, isEnabled, lastLoginAt?, profile, roles[], effectivePages[]` | **Exclude** `passwordHash, createdAt, updatedAt`. **Transform** `lastLoginAt: Date → ISO`. `type` Prisma-enum → contract `UserType` (identical values; nominal cast). `effectivePages` **computed** (§1.2). |
| `Staff` | `StaffProfileDto` | `firstName, lastName, phone?, jobTitle?` | Exclude `id, userId, createdAt, updatedAt` |
| `Role` (+ `rolePages→page`) | `RoleDto` | `id, code, name, description?, isEnabled, pageKeys[]` | Exclude timestamps. `pageKeys` = `rolePages.map(rp → rp.page.key)` |
| `Page` | `PageDto` | `key, label, group, scope` | Exclude `id`. `scope` Prisma `PageScope` → contract `PageScope` |
| `Technician` | `TechnicianDto` | `id, name, phone?, isEnabled` | Exclude timestamps |
| `RefreshToken` | *(never a DTO)* | — | Internal only; `tokenHash`, `id`, `replacedByTokenId` **never** leave the service |

Assembled-in-service DTOs (not a 1:1 row map): `LoginResultDto` = `{ authType, accessToken, refreshToken, profile }`
and `RefreshResultDto` = `{ accessToken, refreshToken }`. Raw tokens are the sanctioned exception
(returned once to their owner; see `identity.dtos.ts` comment).

### 1.2 `effectivePages` (computed in the mapper, pure)

- **STAFF:** union of `page.key` across the user's **enabled** roles only (`role.isEnabled === true`),
  de-duplicated. Disabled roles' pages drop immediately (BL 3 / "disabled role's pages drop").
- **ADMIN:** ignores the role matrix → **all** page keys. The mapper is pure and cannot query, so
  the service passes the full key list in as an argument (`allPageKeys: string[]`); the mapper
  returns it for ADMIN and ignores it for STAFF.
- `roles: RoleDto[]` carries **all** assigned roles (each with its own `isEnabled` + `pageKeys`);
  only the union that feeds `effectivePages` filters on enabled.

### 1.3 Enum conversions

- `UserType` (Prisma) → `UserType` (contract) — same strings, nominal cast (as the auth middleware already does).
- `UserType` → `AuthType` for the login result: `ADMIN→'admin'`, `STAFF→'staff'`, `CLIENT→'client'`
  (a pure `toAuthType()` helper in the mapper — avoids a magic string).
- `PageScope` (Prisma) → `PageScope` (contract) — same strings.
- **New (owner-approved, scope narrowed during Sprint 1 — see §7.1):** `PageKey` + `PageGroup` enums
  added to `identity.enums.ts`, covering **only the 7 spec-quoted STAFF-scope keys** (no invented
  ADMIN-scope keys — nothing in Stage-00 gates an admin route on a page key, so there is no
  authoritative ADMIN-scope naming to encode). DB `Page.key`/`Page.group` values equal the enum
  values. DTO fields stay `z.string()` (page keys travel as strings; `RoleDto.pageKeys`/
  `UserDto.effectivePages` unchanged); `PageDto.key` is **not** tightened to `z.enum(PageKey)` since
  that would incorrectly close off the `ADMIN`-scope half of `Page.scope` that the schema still
  supports. See §7.1.

---

## 2. Step 2 — Component definition

### 2.1 Interface `IIdentityService` (methods derived from the routes)

One cohesive service per module (strict 6-file rule). Methods return **contract DTOs** only.
The user-management subset (`createUser`, `resetPassword`) is the injectable surface the spec's
connection rule calls "the injected `UserService`".

| Method | Serves route(s) | Signature (design, not code) |
|---|---|---|
| `login` | POST `LOGIN` | `login(cmd: LoginCommand, ctx: { ipAddress?; userAgent? }): Promise<LoginResultDto>` |
| `refresh` | POST `REFRESH` | `refresh(cmd: RefreshCommand, ctx): Promise<RefreshResultDto>` |
| `logout` | POST `LOGOUT` | `logout(userId: string): Promise<void>` |
| `getEffectivePages` | GET `ME_PERMISSIONS` | `getEffectivePages(user: JWTPayload): Promise<string[]>` |
| `listUsers` | GET `USERS` | `listUsers(q: UserListQuery): Promise<PaginatedResult<UserDto>>` |
| `getUser` | GET `USER_BY_ID` | `getUser(id: string): Promise<UserDto>` — *detail view; inferred from `USER_BY_ID`, see §8* |
| `createUser` | POST `USERS` (+ injected) | `createUser(cmd: CreateUserCommand, tx?): Promise<UserDto>` |
| `updateUser` | PATCH `USER_BY_ID` | `updateUser(id: string, cmd: UpdateUserCommand): Promise<UserDto>` |
| `listRoles` | GET `ROLES` | `listRoles(): Promise<RoleDto[]>` |
| `createRole` | POST `ROLES` | `createRole(cmd: CreateRoleCommand): Promise<RoleDto>` |
| `updateRole` | PATCH `ROLE_BY_ID` | `updateRole(id: string, cmd: UpdateRoleCommand): Promise<RoleDto>` |
| `setRolePages` | PUT `ROLE_PAGES` | `setRolePages(id: string, cmd: SetRolePagesCommand): Promise<RoleDto>` |
| `listPages` | GET `PAGES` | `listPages(q: PagesQuery): Promise<PageDto[]>` |
| `listTechnicians` | GET `TECHNICIANS` | `listTechnicians(): Promise<TechnicianDto[]>` |
| `createTechnician` | POST `TECHNICIANS` | `createTechnician(cmd: CreateTechnicianCommand): Promise<TechnicianDto>` |
| `updateTechnician` | PATCH `TECHNICIAN_BY_ID` | `updateTechnician(id: string, cmd: UpdateTechnicianCommand): Promise<TechnicianDto>` |
| `resetPassword` | *(injected only — no route)* | `resetPassword(userId: string, newPassword: string, tx?): Promise<void>` |

`tx?` = optional `Prisma.TransactionClient` so the **clients** module can call `createUser`/
`resetPassword` atomically inside its own transaction (spec connection rule). The service uses
`tx ?? this.prisma`.

### 2.2 Events

- **Emits (out):** `auth.loggedIn` (after successful login), `user.created` (createUser),
  `user.updated` (updateUser), `user.roleChanged` (updateUser when `roleIds` changes). Emitted
  **after commit**; `audit` (later module) listens.
- **Events (in):** **none** → **no `identity.listener.ts`** (5 files, not 6).

---

## 3. Business logic (the HOW behind the methods) — spec §Business Logic

1. **Login (three-way routing, no enumeration oracle).**
   - Resolve the enabled user by `username` **or** `email` (on `User`), else by `phone` (join
     `Client.phone → Client.userId → User`). Phone login only resolves for approved clients (userId set).
   - Verify with `comparePassword` (**Argon2id** — the foundation util is switched from bcrypt to
     Argon2id per the owner's decision; see §7.5 / §8 item 1). New/updated passwords hash via `hashPassword` (Argon2id).
   - **One generic 401** (`ErrorCode.AUTH_INVALID_CREDENTIALS`) for unknown / wrong / disabled —
     identical body; do a dummy compare on the not-found path to avoid a timing oracle.
   - On success: set `lastLoginAt = now`; mint access JWT (`generateToken`, 15 min via
     `env.JWT_EXPIRATION`) with `JWTPayload { sub, type, staffId? (STAFF/ADMIN), clientId? (CLIENT) }`;
     mint refresh token (random 256-bit, **hash stored**, `expiresAt = now + 7d`, capture
     `userAgent`/`ipAddress`). Return `LoginResultDto`; `profile` = `StaffProfileDto` for staff/admin,
     minimal/unknown for client (the `clients` module owns the client profile shape — DTO field is `z.unknown()`).
   - Emit `auth.loggedIn { userId, authType, ipAddress? }` after commit.
   - **Rate-limit per IP + username** — see gap §7.2.

2. **Refresh (rotation + chain-kill).**
   - Hash the presented token (same deterministic hash) → look up `RefreshToken.tokenHash`.
   - Not found / expired → generic 401. **Revoked → reuse detected → kill the whole chain**
     (revoke every still-active token for that user) → 401.
   - Else, in one transaction: revoke the old (`revokedAt = now`, `replacedByTokenId = new.id`),
     issue a new refresh + a fresh access JWT (reload user + staff/client to rebuild the payload).
   - `logout` revokes the caller's active refresh token(s) by `req.user.sub`.
   - Disabling a user (§updateUser) and `resetPassword` both **revoke all** the user's tokens immediately.

3. **Effective pages** — resolved **per request** (never baked into the JWT). STAFF = union of
   enabled roles' pages; ADMIN = all pages (§1.2).

4. **`setRolePages` — STAFF-scope only.** Look up `Page` rows by the given keys; if any key is
   unknown **or** resolves to an `ADMIN`-scope page → `BadRequestError` (`VALIDATION_ERROR`, 400).
   Otherwise replace the role's `RolePage` rows in a transaction; return the updated `RoleDto`.

5. **Last-admin guard (`LAST_ADMIN_PROTECTED`).** On `updateUser`, if `isEnabled === false` and the
   target is the **last enabled ADMIN**, refuse. `type` is not in `UpdateUserCommand`, so "demote"
   is not reachable via this route; the guard reduces to "cannot disable the last enabled admin."
   No `LAST_ADMIN_PROTECTED` error code exists → map to `ConflictError` (`RESOURCE_CONFLICT`, 409) (§9).

6. **Users create/update.**
   - `createUser`: schema already enforces `roleIds` (required-non-empty iff STAFF, forbidden iff
     ADMIN). Transaction: create `User` + `Staff` (from `cmd.profile`) + `UserRole` rows (STAFF).
     `passwordHash` via `hashPassword`. Both ADMIN and STAFF get a `Staff` profile row (the command
     requires `profile` for both; `UserDto.profile` is required). Dup `username`/`email` (Prisma
     `P2002`) → `ConflictError`. Emit `user.created`. `201`.
   - `updateUser`: apply `isEnabled?` (false → revoke tokens + last-admin guard), `password?`
     (hash + revoke tokens), `profile?` (update `Staff`), `roleIds?` (replace `UserRole` rows).
     Emit `user.updated`; if roles changed also emit `user.roleChanged { userId, roleIds }`. `200`.

7. **Technicians:** plain rows, never linked to a user. No delete — `isEnabled` toggle via PATCH.

---

## 4. Step 3 — Test strategy (`test-rules.md`)

### 4.1 Factories (`test/data/`, contract-shaped; the single source of truth)

- Extend `user.factory.ts`: add `createUserPayload(overrides): CreateUserCommand` (username/email/
  password/type/profile/roleIds) and a persistence helper `seedUser({type,isEnabled,password,roleIds})`
  that writes `User`+`Staff` with a **hashed** password (for login/integration).
- New: `role.factory.ts` (`CreateRoleCommand` + `seedRole`), `page.factory.ts` (`seedPages` from the
  canonical `PageKey`/`PageGroup` list — both scopes), `technician.factory.ts` (`CreateTechnicianCommand`),
  `refresh-token.factory.ts` (`seedRefreshToken` for rotation/chain tests). `login.factory.ts` → `LoginCommand`.

### 4.2 Unit (`test/unit/modules/identity/`, mock Prisma + spy `eventBus`/token/crypto)

- `identity.mapper.spec.ts`: `passwordHash`/token fields excluded; `lastLoginAt` Date→ISO;
  `effectivePages` union of enabled roles; disabled role drops; ADMIN → all pages; `RoleDto.pageKeys`;
  each DTO parses its `*ResponseSchema`.
- `identity.service.spec.ts`: three-way login routing; **identical** 401 for unknown/wrong/disabled;
  `lastLoginAt` set + `auth.loggedIn` emitted; refresh rotation (old revoked + `replacedByTokenId`);
  reuse-of-revoked → chain-kill; expired → 401; `createUser` hashes + emits `user.created` + conflict
  on dup; `updateUser` last-admin guard, disabling revokes tokens, `user.updated`/`user.roleChanged`;
  `setRolePages` rejects ADMIN-scope/unknown key (400) and replaces on success; `resetPassword`
  revokes tokens; `getEffectivePages` staff-union vs admin-all.

### 4.3 Integration (`test/integration/identity.integration.spec.ts`, real test DB, real prefix, envelope asserted)

Three-way login → 200 + `ApiResponse` + tokens; **byte-identical** 401 bodies (unknown vs wrong vs
disabled); refresh rotation + chain-kill; admin users create(201)/list(paginated)/update(200);
last-admin guard 409; disabling revokes tokens (old refresh now fails); roles CRUD; `setRolePages`
STAFF-only (ADMIN-scope page → 400); disabled role's pages drop from `me/permissions`; staff-union
vs admin-all permissions; technicians CRUD + `isEnabled` toggle (no delete); guard checks (non-admin
→ 403, missing token → 401). Requires the **Page registry seeded** (§7.1) and `NODE_ENV=test` DB.

### 4.4 Contract conformance (`test/contract/`)

Extend the existing `routes.conformance.spec.ts` (it already enumerates `IDENTITY_ROUTES` and notes
"once Sub-02 mounts routers, extend with live supertest requests asserting each composed path
resolves (not 404)"): assert every `IDENTITY_ROUTES` path resolves on `app` (correct method + auth,
not 404). Response-shape: parse representative `res.body.data` through `UserResponseSchema`,
`RoleResponseSchema`, `PageResponseSchema`, `TechnicianResponseSchema`, `LoginResultResponseSchema`,
`RefreshResultResponseSchema`, and `paginated(UserResponseSchema)`.

---

## 5. Step 4 — File checklist (create only what the module needs)

Inside `Apps/api/src/modules/identity/`, in order:

1. **`identity.mapper.ts`** — pure/static. `toUserDto(user, allPageKeys)`, `toStaffProfileDto(staff)`,
   `toRoleDto(role)`, `toPageDto(page)`, `toTechnicianDto(tech)`, `toAuthType(userType)`, and a pure
   `effectivePages(userRoles, allPageKeys, type)` helper. Never spreads the entity; each `toDto`
   ends with `XxxResponseSchema.parse(dto)` (dev/test conformance guard).
2. **`identity.interface.ts`** — `IIdentityService` (§2.1). Methods return contract DTOs only.
3. **`identity.service.ts`** — `class IdentityService implements IIdentityService`; injects
   `PrismaClient`; throws `AppError` subclasses; emits `IdentityEvents` after commit; holds all
   business logic (§3). Uses `hashPassword`/`comparePassword` (Argon2id — §7.5), `generateToken`,
   `node:crypto` for refresh tokens.
4. *(no `identity.listener.ts` — identity listens to nothing.)*
5. **`identity.controller.ts`** — thin; `try/catch → next(error)`; reads `req.validated`
   (and `req.user` for `logout`/`me`); `sendSuccess` with status: `201` create, `200` read/update,
   `200` + `null` for `logout`.
6. **`identity.routes.ts`** — composition root: manual DI (`new IdentityService(prisma)` →
   `new IdentityController(service)`), then one registration per route using the `IDENTITY_ROUTES`
   constant + `validateRequest({…})` per segment + the guard from the table below. `export { router }`.

### 5.1 Route registration map (guards + validation)

| Route const | Method | Guard | `validateRequest` |
|---|---|---|---|
| `LOGIN` | POST | public | `{ body: LoginSchema }` |
| `REFRESH` | POST | public | `{ body: RefreshSchema }` |
| `LOGOUT` | POST | `requireAuth()` (any authed) | — |
| `ME_PERMISSIONS` | GET | `requireAuth({ types: [STAFF, ADMIN] })` | — |
| `USERS` | GET | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ query: UserListQuerySchema }` |
| `USERS` | POST | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ body: CreateUserSchema }` |
| `USER_BY_ID` | GET | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ params: UserIdParamsSchema }` |
| `USER_BY_ID` | PATCH | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ params: UserIdParamsSchema, body: UpdateUserSchema }` |
| `ROLES` | GET | `requireAuth({ types: [ADMIN], checkDB: true })` | — |
| `ROLES` | POST | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ body: CreateRoleSchema }` |
| `ROLE_BY_ID` | PATCH | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ params: RoleIdParamsSchema, body: UpdateRoleSchema }` |
| `ROLE_PAGES` | PUT | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ params: RoleIdParamsSchema, body: SetRolePagesSchema }` |
| `PAGES` | GET | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ query: PagesQuerySchema }` |
| `TECHNICIANS` | GET | `requireAuth({ types: [ADMIN], checkDB: true })` | — |
| `TECHNICIANS` | POST | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ body: CreateTechnicianSchema }` |
| `TECHNICIAN_BY_ID` | PATCH | `requireAuth({ types: [ADMIN], checkDB: true })` | `{ params: TechnicianIdParamsSchema, body: UpdateTechnicianSchema }` |

`checkDB: true` on admin routes closes the "disabled admin's still-valid 15-min access token" window
(refresh tokens are already revoked on disable). `requireAuth` covers **type**-level access; identity
has no page-key-gated routes of its own, so no page guard is needed here.

---

## 6. Wiring (the real extension point)

Mount the router at `Apps/api/src/app.ts:22` (`// EXTENSION POINT (modules)`), inside `apiRouter`
(which is already mounted at `env.API_PREFIX` = `/api`). The `IDENTITY_ROUTES` paths begin at
`/auth`, `/me`, `/admin`, so composing under `/api` yields `/api/auth/login`, `/api/me/permissions`,
`/api/admin/users`, … exactly matching the spec.

- **Recommended:** add a small `Apps/api/src/modules/index.ts` aggregator (`registerModules(apiRouter)`
  or an exported combined router) and invoke it once at the extension point — this honors the phase
  file's `modules/index.ts` intent and keeps `app.ts` stable as later modules arrive. Identity's
  `routes.ts` stays the module's composition root per the rules.
- **Alternative (minimal):** `apiRouter.use(identityRouter)` directly at the extension point.

---

## 7. Prerequisites / dependencies outside the 6 files (flagged)

1. **Page registry: contract enum → seed (owner-approved, two steps, scope narrowed to STAFF-only).**
   - *What it is:* the `Page` table is a **fixed catalog of permission keys** (`key/label/group/scope`),
     not user-editable — no create-page endpoint. The spec calls it a "seeded registry": rows are
     inserted once by a seed script, the same way the platform's wilayas/communes are seeded.
   - *Why identity needs it:* `GET /admin/pages` reads it; `setRolePages` validates submitted
     `pageKeys` against `Page.scope`; `me/permissions` unions them. Empty table ⇒ `PAGES` returns
     `[]` and every role-page assignment fails ⇒ the roles→pages→permissions system is inert.
   - *Investigated during Sprint 1 execution:* searched all 12 module contracts for an `admin(PAGE_KEY)`
     gating pattern analogous to `staff(PAGE_KEY)` — **none exists**; every admin route's access level
     is the bare word `admin` (bypasses the page-key matrix entirely, per spec line 8). The only
     `ADMIN_XXX`-shaped tokens found (`ADMIN_LIST`, `ADMIN_DASHBOARD`, …) are **route-constant names**
     (e.g. `ClientRoutes.ADMIN_LIST`), not page keys — a false lead. So, unlike the 7 STAFF-scope keys
     (each directly quoted verbatim in a contract's access column), **no ADMIN-scope key naming is
     defined anywhere in Stage-00** — inventing 19 identifiers for the `ADM-*` pages would be authoring
     new domain data, not reading it.
   - **Owner decision (asked, resolved 2026-07-17): STAFF-scope only.** Seed only the 7 keys actually
     used by role/permission gating; do not seed ADMIN-scope rows. Nothing reads `Page.scope === ADMIN`
     today (admin bypasses the check), so this is not a functional gap — ADMIN-scope rows can be added
     later if a real requirement introduces an `admin(PAGE_KEY)` gate. `Page.scope` in Prisma still
     supports `ADMIN`; only the seed's *current* member list is narrowed.
   - **Step A — contract enums first (no magic strings).** Add `PageKey` and `PageGroup` enums to
     `Apps/contract/src/modules/identity/identity.enums.ts` (already re-exported by the identity
     barrel). `PageKey` = the 7 STAFF-scope keys quoted in the contracts: `STAFF_POS`, `STAFF_PRODUCTS`,
     `STAFF_ORDERS`, `STAFF_SALES`, `STAFF_INVOICES`, `STAFF_REPAIRS`, `STAFF_POS_CLIENTS`. `PageGroup`
     = the functional groupings for their sidebar sections (a display/UI concern, not gated by any
     business rule, so grouped pragmatically by module boundary): `POS` (`STAFF_POS`, `STAFF_POS_CLIENTS`),
     `CATALOG` (`STAFF_PRODUCTS`), `ORDERS` (`STAFF_ORDERS`), `SALES` (`STAFF_SALES`), `BILLING`
     (`STAFF_INVOICES`), `REPAIRS` (`STAFF_REPAIRS`).
   - **Step B — seed referencing the enums.** `Apps/api/prisma/seed.ts` inserts one `Page` row per
     `PageKey` (scope `STAFF` for all seven), using `PageKey`/`PageGroup`/`PageScope` (labels stay
     plain display strings). Wire `prisma db seed` (`package.json` → `"prisma": { "seed": "tsx
     prisma/seed.ts" }` + a `db:seed` script). Requires the `Page` table migration applied. Upsert by
     `key` so re-runs are idempotent. Tests reuse the same canonical list (seed export or `page.factory.ts`).
2. **Login rate-limiting — explicitly deferred (owner decision, asked, resolved 2026-07-17).** Spec
   BL 1 wants "rate-limit per IP + username"; no limiter middleware/dependency/env knob exists in the
   foundation. **Decision: defer, not implemented in this module.** Rationale: rate limiting is
   cross-cutting infra — an in-process (Map-based) limiter would silently stop working correctly
   under any multi-instance deployment (each instance has its own counters), and a correct
   implementation needs a shared store (e.g. Redis) that doesn't exist yet. Tracked as follow-up infra
   work, out of identity's 6-file scope; **not** blocking Sprint 1 or the module's definition of done.
3. **Refresh-token crypto + TTL.** `token.utils` only signs/verifies the **access** JWT. The service
   generates the refresh secret with `node:crypto` (`randomBytes(32)`) and stores a **deterministic**
   hash (`sha-256`/HMAC-SHA256 — required for `tokenHash` `@unique` lookup; bcrypt is unsuitable
   here). TTL from `env.REFRESH_TOKEN_EXPIRATION` (days) — the exact name+shape `Docs/Stage-02-Backend/env-template.md`
   already prescribes for this variable; found and matched during Sprint 1 execution (was
   `REFRESH_TOKEN_TTL_DAYS` in the original plan — renamed per the rules doc precedent).
4. **Conformance test extension** in `test/contract/routes.conformance.spec.ts` (§4.4) — already
   flagged in-file as Sub-02 work.
5. **Password hashing → Argon2id (owner decided).** Reimplement `@common/utils/password.utils.ts`
   with the `argon2` library (`argon2.hash` with `type: argon2id` / `argon2.verify`); add the
   `argon2` dependency and drop `bcrypt` (+ `@types/bcrypt`). The exported `hashPassword`/
   `comparePassword` **signatures are unchanged**, so identity's service code is unaffected — this is
   a one-file foundation swap + a dependency change. Update `test/unit/common/utils/password.utils.spec.ts`
   accordingly. (Argon2id is for **passwords** only; refresh-token hashing stays sha-256/HMAC per §7.3.)

---

## 8. Deviations & open decisions (resolved toward the rules; noted per standing rules)

| # | Item | Resolution |
|---|---|---|
| 1 | **Argon2id (spec) vs bcrypt (foundation).** `password.utils` ships `hashPassword`/`comparePassword` (bcrypt, 10 rounds). | **Owner decided: Argon2id.** Reimplement `password.utils.ts` with the `argon2` library (Argon2id) and drop `bcrypt`; the `hashPassword`/`comparePassword` signatures stay identical, so no identity module code changes. Tracked as prerequisite §7.5. |
| 2 | **`PaginationInfo` (spec prose) vs `PaginationMeta` + `paginated()` (contract).** | Contract wins (WHICH). Use `paginated(UserResponseSchema)` → `{ items, meta }`. |
| 3 | **Rules say "always paginate lists"; contract defines a list query only for users.** | Paginate `USERS` only; `ROLES`/`PAGES`/`TECHNICIANS` return plain arrays (no list-query schema exists in the contract). Deviation noted. |
| 4 | **`LAST_ADMIN_PROTECTED` is not an `ErrorCode`.** | Map the guard to `ConflictError` (`RESOURCE_CONFLICT`, 409). |
| 5 | **`AUTH_INVALID_CREDENTIALS` has no `AppError` subclass.** | Construct `new AppError(401, ErrorCode.AUTH_INVALID_CREDENTIALS, …)` directly for the generic login/refresh 401. |
| 6 | **No `LogoutCommand` in the contract.** | `logout` takes no body; revokes the caller's active refresh token(s) by `req.user.sub`. `200` + `data: null`. |
| 7 | **`GET USER_BY_ID` (detail).** Spec writes "GET/POST/PATCH `/admin/users(/:id)`"; the `USER_BY_ID` constant exists. | Include `getUser(id)` as the detail view. **Confirm if the intent was list-only** — if so, drop the method and its route registration. |
| 8 | **`LoginResultDto.profile` is `z.unknown()`.** | staff/admin → `StaffProfileDto`; client → minimal/unknown (the `clients` module owns the full client-profile shape; identity does not depend on it). |
| 9 | **Injected `UserService` for the `clients` module.** Spec: client approval + admin client-password-reset call injected `createUser`/`resetPassword` atomically. But `CreateUserCommand.type` is `ADMIN\|STAFF` only — it can't express a CLIENT user. | Expose `createUser`/`resetPassword` with an optional `tx`. The **CLIENT-user provisioning variant** (type CLIENT, `clientId` link, no roles/Staff) needs an internal input shape — **defer its exact signature to the `clients` module plan**; identity's own routes only create ADMIN/STAFF. **Flagged.** |
| 10 | **Extension point / `modules/index.ts`.** | Wire at `app.ts` extension point; optionally add `modules/index.ts` aggregator (§6). |

No item rises to a genuine authority-vs-authority conflict, so per the standing rules I did not stop
to ask — each is resolved toward the rules/contract and flagged above for the owner's review.

---

## 9. Definition of done

- `Apps/api/src/modules/identity/` has the 5 files (mapper, interface, service, controller, routes);
  no listener.
- Router mounted at the `app.ts` extension point; every route uses an `IDENTITY_ROUTES` constant
  (no string literals) and validates each segment against the contract schema.
- Every service method returns a DTO that parses against its `*ResponseSchema` (mapper-enforced).
- Events `auth.loggedIn` / `user.created` / `user.updated` / `user.roleChanged` emit after commit.
- Unit + integration + conformance suites (§4) pass; `routes.conformance` asserts all identity paths
  resolve and representative payloads parse against their contract schemas.
- `PageKey`/`PageGroup` enums (7 STAFF-scope keys) exist in the contract; `prisma/seed.ts` populates
  the `Page` registry from them (no magic strings) and `prisma db seed` is wired + idempotent.
- Prerequisites resolved or explicitly deferred: §7.1 (page-key contract enums + seed, STAFF-scope
  only), §7.2 (rate-limit — explicitly deferred), §7.5 (Argon2id util swap).
