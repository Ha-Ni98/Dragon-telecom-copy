# Stage 02 · Sub-02 — Identity Module Sprint Plan (set 01)

Dependency-ordered decomposition of [`plan-identity.md`](./plan-identity.md) into sprints, following
the phase-02 backbone **foundation (mapper/interface) → logic (service) → API (controller/wiring)**.
**No code in this document.** Each sprint ends green (compiles + tests pass) and is committed before
the next begins.

## Sprint sequence & rationale

The phase file's suggested 3-sprint shape (Foundation / Logic / API) is **adjusted** because `identity`
is the merged, first-in-repo module (auth + users/roles/pages + refresh tokens + technicians) and
carries real prerequisites outside the 6 files:

| # | Sprint | Layer | Why separate |
|---|---|---|---|
| 1 | Prerequisites & contract additions | *pre-foundation* | Contract `PageKey`/`PageGroup` enums, Argon2id util swap, refresh/rate-limit infra, page seed — all must exist before the module builds on them (plan §7). |
| 2 | Foundation — mapper, interface, factories | foundation | Pure transforms + service contract + test data; no logic. |
| 3 | Logic A — auth & sessions | logic | login / refresh / logout / me + refresh-token crypto — cohesive, heavily-tested slice. |
| 4 | Logic B — admin management | logic | users / roles / pages / technicians + guards + injected `resetPassword`. Split from A to keep each service sprint reviewable and green. |
| 5 | API — controller, routes, wiring, integration & conformance | API | HTTP surface + mount + end-to-end/contract proof. |

**Gate rule:** a sprint starts only when the previous one is green and committed. Integration tests
(`test:int`) first run in Sprint 5 (once routes are wired + the test DB is up + pages seeded); every
earlier sprint runs `test:unit` (+ contract conformance).

**Commit style** (per project convention): `git add .` then a short `api: sub-02 sprint N — <topic>`
message (contract-only changes may be a separate `contract:` commit); **no** `Co-Authored-By`.

---

### Sprint 1: Prerequisites & contract additions   — Status: ⬜ Pending

**Goals**
- Land every enabling change the module depends on, on a green base: contract page-key enums, the
  Argon2id password-util swap, refresh-token TTL + login rate-limit infra, and the seeded `Page` registry.

**Tasks**
- [ ] Impl (contract): add `PageKey` + `PageGroup` enums to `Apps/contract/src/modules/identity/identity.enums.ts`; confirm the identity barrel re-exports them. (plan §7.1 Step A, §1.3)
- [ ] Impl (contract, optional): tighten `PageDto.key` → `z.enum(PageKey)` (leave `RoleDto.pageKeys` / `UserDto.effectivePages` as `z.string()`). (plan §1.3)
- [ ] Impl (foundation): rewrite `Apps/api/src/common/utils/password.utils.ts` with `argon2` (Argon2id); add `argon2`, drop `bcrypt` + `@types/bcrypt`. Keep `hashPassword`/`comparePassword` signatures. (plan §7.5, §8 item 1)
- [ ] Impl (env): add `REFRESH_TOKEN_TTL_DAYS` (default `7`) to `src/env.ts` (or a documented module constant). (plan §7.3)
- [ ] Impl (rate-limit): add a minimal login rate-limiter (keyed by IP + username → `ErrorCode.RATE_LIMITED` / 429), **or** record explicit deferral per plan §7.2. (owner decision)
- [ ] Impl (seed): `Apps/api/prisma/seed.ts` — canonical `Page` rows built from `PageKey`/`PageGroup`/`PageScope` (sweep every `staff(KEY)` annotation + `Pages-Requirements/`); upsert by `key`. Wire `prisma db seed` (`package.json` `"prisma": { "seed": "tsx prisma/seed.ts" }` + a `db:seed` script). (plan §7.1 Step B)
- [ ] Chore: ensure the `Page` table migration is applied (`npm run prisma:migrate`).
- [ ] Test: update `Apps/api/test/unit/common/utils/password.utils.spec.ts` for Argon2id (hash verifies, wrong password fails, hash ≠ plaintext).

**Validation**
- [ ] Contract: `npm --prefix Apps/contract run validate` green (tsc `--noEmit` + madge cycles + eslint + conformance).
- [ ] API: `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (updated password-util spec; contract conformance still green).
- [ ] `npm run db:seed` succeeds; `Page` rows exist for both scopes; re-running is idempotent.
- [ ] No magic strings — seed references `PageKey`/`PageGroup`/`PageScope` only.
- [ ] Committed on green (`api: sub-02 sprint 1 — identity prerequisites`; contract enums may be a separate `contract:` commit).

---

### Sprint 2: Foundation — mapper, interface, factories   — Status: ⬜ Pending

**Goals**
- Pure Entity⇄DTO transformation, the service contract, and contract-shaped test data — no business logic.

**Tasks**
- [ ] Impl: `src/modules/identity/identity.mapper.ts` — `toUserDto(user, allPageKeys)`, `toStaffProfileDto`, `toRoleDto`, `toPageDto`, `toTechnicianDto`, `toAuthType`, and a pure `effectivePages(userRoles, allPageKeys, type)` helper. Never spread the entity; each `toDto` ends with `XxxResponseSchema.parse(...)`. (plan §1, §5)
- [ ] Impl: `src/modules/identity/identity.interface.ts` — `IIdentityService` with all methods (plan §2.1); returns contract DTOs only.
- [ ] Test (factories): extend `test/data/user.factory.ts` (`createUserPayload`, `seedUser` with hashed password); add `role.factory.ts`, `page.factory.ts` (from the canonical `PageKey` list), `technician.factory.ts`, `refresh-token.factory.ts`, `login.factory.ts`. (plan §4.1)
- [ ] Test: `test/unit/modules/identity/identity.mapper.spec.ts` — excludes `passwordHash`/token fields; `lastLoginAt` Date→ISO; `effectivePages` unions enabled roles only; disabled role drops; ADMIN → all pages; `RoleDto.pageKeys`; each DTO parses its `*ResponseSchema`. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green (mapper spec + conformance).
- [ ] Mapper excludes sensitive fields and returns contract DTOs (parses `*ResponseSchema`); interface methods return DTOs, never entities.
- [ ] Committed on green (`api: sub-02 sprint 2 — identity foundation`).

---

### Sprint 3: Logic A — auth & sessions   — Status: ⬜ Pending

**Goals**
- Stand up `IdentityService` (constructor DI) and implement login / refresh / logout / effective-pages,
  with refresh-token crypto and the `auth.loggedIn` emit.

**Tasks**
- [ ] Impl: `src/modules/identity/identity.service.ts` — `class IdentityService implements IIdentityService`; `constructor(prisma)`; private refresh-token helpers (`node:crypto` `randomBytes(32)` + deterministic sha-256/HMAC; TTL from `REFRESH_TOKEN_TTL_DAYS`). (plan §5, §7.3)
- [ ] Impl `login`: three-way resolve (username | email | phone→Client); Argon2id `comparePassword`; **one generic 401** `AUTH_INVALID_CREDENTIALS` + dummy compare (no timing/enumeration oracle); set `lastLoginAt`; mint access JWT (`generateToken`, `JWTPayload { sub, type, staffId?/clientId? }`); mint refresh (hash stored, `expiresAt`); emit `auth.loggedIn` after commit; apply login rate-limit if implemented. (plan §3.1)
- [ ] Impl `refresh`: hash-lookup; rotate (revoke old, `replacedByTokenId`, new pair, rebuild payload from user + staff/client); **reuse-of-revoked → chain-kill**; expired/not-found → 401. (plan §3.2)
- [ ] Impl `logout` (revoke caller's active tokens) and `getEffectivePages` (STAFF union / ADMIN all). (plan §3.2–3.3)
- [ ] Test: `test/unit/modules/identity/identity.service.spec.ts` (part A) — mock Prisma; spy `eventBus`/token/crypto: three-way routing; **identical** 401 for unknown/wrong/disabled; `lastLoginAt` + `auth.loggedIn`; rotation (`revokedAt`+`replacedByTokenId`); reuse → chain-kill; expired → 401; effective-pages staff-union vs admin-all. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green.
- [ ] Service throws `AppError` subclasses; emits typed events **after commit**; returns DTOs (never entities/hashes).
- [ ] Committed on green (`api: sub-02 sprint 3 — identity auth/sessions`).

---

### Sprint 4: Logic B — admin management   — Status: ⬜ Pending

**Goals**
- Complete the service: users, roles, pages, technicians, guards, and the injected `resetPassword`.

**Tasks**
- [ ] Impl users: `listUsers` (paginated via `paginated()`), `getUser`, `createUser(cmd, tx?)` (tx-aware: `User`+`Staff`+`UserRole` in one transaction; `hashPassword`; `P2002` → `ConflictError`; emit `user.created`), `updateUser` (`isEnabled` + **last-admin guard** 409 + revoke tokens; `password` → hash + revoke; `profile`; `roleIds` replace; emit `user.updated`, and `user.roleChanged` when roles change). (plan §3.5–3.6, §2.1)
- [ ] Impl roles/pages: `listRoles`, `createRole`, `updateRole`, `setRolePages` (validate keys exist **and** are STAFF-scope against the DB → `VALIDATION_ERROR`/400; replace `RolePage` rows in a transaction), `listPages(scope?)`. (plan §3.4, §2.1)
- [ ] Impl technicians: `listTechnicians`, `createTechnician`, `updateTechnician` (`isEnabled` toggle — no delete). (plan §3.7)
- [ ] Impl `resetPassword(userId, newPassword, tx?)` — hash + revoke all the user's tokens (injected surface for the clients module). (plan §2.1, §3.2)
- [ ] Test: `identity.service.spec.ts` (part B) — last-admin guard blocks disabling the last enabled ADMIN (409); disabling revokes tokens; `createUser` conflict + `user.created`; `updateUser` `user.updated`/`user.roleChanged`; `setRolePages` rejects ADMIN-scope/unknown key (400) and replaces on success; `resetPassword` revokes tokens. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run test:unit` green.
- [ ] Multi-row writes run in transactions; Prisma `select`/`include` scoped to needed fields; DTOs parse their schemas.
- [ ] Committed on green (`api: sub-02 sprint 4 — identity admin management`).

---

### Sprint 5: API — controller, routes, wiring, integration & conformance   — Status: ⬜ Pending

**Goals**
- Expose the service over HTTP, mount it at the app extension point, and prove it end-to-end and contract-bound.

**Tasks**
- [ ] Impl: `src/modules/identity/identity.controller.ts` — thin handlers; `try/catch → next(error)`; read `req.validated` (and `req.user` for `logout`/`me`); `sendSuccess` with status `201` create / `200` read-update / `200`+`null` logout / `200` `string[]` for `me/permissions`. (plan §5)
- [ ] Impl: `src/modules/identity/identity.routes.ts` — composition root: manual DI (`new IdentityService(prisma)` → `new IdentityController(service)`); one registration per `IDENTITY_ROUTES` constant + per-segment `validateRequest` + the guard from the plan §5.1 table (`checkDB:true` on admin routes). `export { router }`.
- [ ] Impl (wiring): mount at the `src/app.ts` `EXTENSION POINT (modules)` — recommended via a new `src/modules/index.ts` aggregator. (plan §6)
- [ ] Test: `test/integration/identity.integration.spec.ts` (real test DB, real prefix, envelope asserted) — three-way login; **byte-identical** 401 bodies; refresh rotation + chain-kill; users create(201)/list(paginated)/update(200); last-admin 409; disabling revokes tokens; roles CRUD; `setRolePages` STAFF-only (ADMIN-scope → 400); disabled role's pages drop from `me/permissions`; staff-union vs admin-all; technicians toggle; guards (non-admin 403, missing token 401). Pages seeded + `NODE_ENV=test`. (plan §4.3)
- [ ] Test: extend `test/contract/routes.conformance.spec.ts` — every `IDENTITY_ROUTES` path resolves on `app` (not 404, correct method + auth); parse representative `res.body.data` through `UserResponseSchema`, `RoleResponseSchema`, `PageResponseSchema`, `TechnicianResponseSchema`, `LoginResultResponseSchema`, `RefreshResultResponseSchema`, `paginated(UserResponseSchema)`. (plan §4.4)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (unit + conformance).
- [ ] `npm run test:int` green (test DB up + migrated + seeded).
- [ ] Routes use contract constants only (no string literals); responses go through `sendSuccess`; each segment validated via `validateRequest`; every identity path resolves.
- [ ] Committed on green (`api: sub-02 sprint 5 — identity API + wiring`).

---

## Definition of done (module)

All of [`plan-identity.md`](./plan-identity.md) §9, in particular:
- 5 module files present (mapper, interface, service, controller, routes) — **no** listener; router mounted at the `app.ts` extension point.
- `PageKey`/`PageGroup` enums in the contract; `prisma/seed.ts` populates the `Page` registry from them (no magic strings), `prisma db seed` wired + idempotent.
- Password hashing is Argon2id; every service method returns a DTO that parses its `*ResponseSchema`; events `auth.loggedIn`/`user.created`/`user.updated`/`user.roleChanged` emit after commit.
- Unit + integration + conformance suites green; prerequisites §7.2 (rate-limit) resolved or explicitly deferred.
