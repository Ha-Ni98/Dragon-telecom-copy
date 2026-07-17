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

### Sprint 1: Prerequisites & contract additions   — Status: ✅ Done

**Goals**
- Land every enabling change the module depends on, on a green base: contract page-key enums, the
  Argon2id password-util swap, refresh-token TTL + login rate-limit infra, and the seeded `Page` registry.

**Tasks**
- [x] Decision (owner, asked 2026-07-17): Page seed scope = **STAFF-scope only** (7 spec-quoted keys); no invented ADMIN-scope keys. (plan §7.1)
- [x] Decision (owner, asked 2026-07-17): login rate-limiting = **explicitly deferred**, not implemented in this module. (plan §7.2)
- [x] Impl (contract): add `PageKey` (7 STAFF-scope members) + `PageGroup` (6 groups) enums to `Apps/contract/src/modules/identity/identity.enums.ts`; confirm the identity barrel re-exports them. (plan §7.1 Step A, §1.3)
- [x] Impl (foundation): rewrite `Apps/api/src/common/utils/password.utils.ts` with `argon2` (Argon2id); add `argon2`, drop `bcrypt` + `@types/bcrypt`. Keep `hashPassword`/`comparePassword` signatures. (plan §7.5, §8 item 1)
- [x] Impl (env): add `REFRESH_TOKEN_EXPIRATION` (default `7`) to `src/env.ts`; renamed from the plan's `REFRESH_TOKEN_TTL_DAYS` to match `env-template.md`'s existing precedent (see report). (plan §7.3)
- [x] Impl (seed): `Apps/api/prisma/seed.ts` — 7 canonical `Page` rows built from `PageKey`/`PageGroup`/`PageScope.STAFF`; upsert by `key`. Wired `prisma db seed` (`package.json` `"prisma": { "seed": "tsx prisma/seed.ts" }` + a `db:seed` script). (plan §7.1 Step B)
- [x] Chore: `Page` table migration created and applied (`20260717103221_init`, first migration in the repo) against dev + test DBs.
- [x] Test: updated `Apps/api/test/unit/common/utils/password.utils.spec.ts` for Argon2id (hash verifies, wrong password fails, hash ≠ plaintext, `$argon2id$` prefix); updated `test/unit/env.spec.ts` for the renamed var.

**Validation**
- [x] Contract: `npm --prefix Apps/contract run validate` green (tsc `--noEmit` + madge cycles + eslint + conformance).
- [x] API: `npx tsc --noEmit` clean; `npm run lint` clean. (Added `prisma` to `tsconfig.json`/lint `include` — it was previously unchecked.)
- [x] `npm run test:unit` green (36/36; updated password-util spec; contract conformance still green).
- [x] `npm run db:seed` succeeds; 7 STAFF-scope `Page` rows exist; re-running is idempotent (verified against a local Postgres — see report for environment notes).
- [x] No magic strings — seed references `PageKey`/`PageGroup`/`PageScope` only.
- [x] Committed on green (`api: identity sprint 1 — prerequisites`; contract enums included in the same commit — see report for rationale).

**Report:** [`results-identity-01/report-sprint-01-01.md`](./results-identity-01/report-sprint-01-01.md)

---

### Sprint 2: Foundation — mapper, interface, factories   — Status: ✅ Done

**Goals**
- Pure Entity⇄DTO transformation, the service contract, and contract-shaped test data — no business logic.

**Tasks**
- [x] Impl: `src/modules/identity/identity.mapper.ts` — `toUserDto(user, allPageKeys)`, `toStaffProfileDto`, `toRoleDto`, `toPageDto`, `toTechnicianDto`, `toAuthType`, and a **public** `effectivePages(userRoles, allPageKeys, type)` helper (made public, not private — Sprint 3's `getEffectivePages` needs to call it directly without building a full `UserDto`). Never spreads the entity; each `toDto` ends with `XxxResponseSchema.parse(...)`. (plan §1, §5)
- [x] Impl: `src/modules/identity/identity.interface.ts` — `IIdentityService` with all methods (plan §2.1); returns contract DTOs only.
- [x] Test (factories): extended `test/data/user.factory.ts` (`createUserPayload`, `seedUser` with Argon2id-hashed password); added `role.factory.ts`, `page.factory.ts` (from the canonical `PageKey` list via the new shared `prisma/pages.registry.ts`), `technician.factory.ts`, `refresh-token.factory.ts`, `login.factory.ts`. (plan §4.1)
- [x] Test: `test/unit/modules/identity/identity.mapper.spec.ts` (18 tests) — excludes `passwordHash`/token fields; `lastLoginAt` Date→ISO; `effectivePages` unions enabled roles only; disabled role drops; ADMIN → all pages; `RoleDto.pageKeys`; each DTO parses its `*ResponseSchema`. (plan §4.2)
- [x] Unplanned addition: `src/common/utils/refresh-token.utils.ts` (`generateRefreshToken`/`hashRefreshToken`, sha-256) — extracted as a shared pure util so `refresh-token.factory.ts` (this sprint) and `identity.service.ts` (Sprint 3) hash refresh tokens identically instead of duplicating the algorithm in two places. Sprint 3's task list below is updated accordingly. Has its own unit test (4 tests).
- [x] Unplanned addition: `prisma/pages.registry.ts` — extracted the Sprint-1 `PAGES` array out of `prisma/seed.ts` into a standalone, side-effect-free module so `page.factory.ts` can reuse the exact same canonical list without duplicating it (importing `seed.ts` directly was unsafe — its `main()` runs on import).

**Validation**
- [x] `npx tsc --noEmit` clean.
- [x] `npm run test:unit` green — 58/58 tests, 12 files (mapper: 18, refresh-token.utils: 4, conformance: 2, pre-existing: 34).
- [x] Mapper excludes sensitive fields and returns contract DTOs (parses `*ResponseSchema`); interface methods return DTOs, never entities.
- [x] `npm run lint` clean — also fixed a real, pre-existing environment bug hit while validating this sprint: ESLint 10.7's stylish formatter calls `util.styleText` (Node ≥20.12 only) whenever there's ≥1 finding to print, crashing outright on this sandbox's Node 18.18. Added `--no-color` to the `lint` script (harmless on Node ≥20 too) so the script no longer crashes instead of reporting real findings. See report.
- [x] Committed on green (`api: identity sprint 2 — foundation`).

**Report:** [`results-identity-01/report-sprint-02-01.md`](./results-identity-01/report-sprint-02-01.md)

---

### Sprint 3: Logic A — auth & sessions   — Status: ✅ Done

**Goals**
- Stand up `IdentityService` (constructor DI) and implement login / refresh / logout / effective-pages,
  with refresh-token crypto and the `auth.loggedIn` emit.

**Tasks**
- [x] Impl: `src/modules/identity/identity.service.ts` — `class IdentityService implements IIdentityService`; `constructor(prisma)`; refresh-token crypto via the shared `generateRefreshToken`/`hashRefreshToken`; TTL from `env.REFRESH_TOKEN_EXPIRATION` (days). Implements the full `IIdentityService` interface now (required to compile `implements`) — the 13 methods out of scope this sprint (users/roles/pages/technicians) are typed stubs that throw `"...not implemented yet (see Sprint 4)"`, replaced one-by-one next sprint. (plan §5, §7.3)
- [x] Impl `login`: three-way resolve (username | email | phone→Client, only for approved/`userId`-linked clients); Argon2id `comparePassword`; **one generic 401** `AUTH_INVALID_CREDENTIALS` + dummy compare against a precomputed Argon2id hash (no timing/enumeration oracle); sets `lastLoginAt` + creates the refresh token in one `$transaction`; mints access JWT (`JWTPayload { sub, type, staffId? | clientId? }` depending on which relation is populated); emits `auth.loggedIn` after commit. Login rate-limiting remains explicitly deferred (plan §7.2). (plan §3.1)
- [x] Impl `refresh`: hash-lookup; rotates in an interactive `$transaction` (revoke old with `replacedByTokenId`, create new); **reuse-of-revoked → chain-kill** (`updateMany` revokes every active token for that user); expired/not-found/disabled-user → 401. (plan §3.2)
- [x] Impl `logout` (revokes the caller's active tokens) and `getEffectivePages` (STAFF/CLIENT → union of enabled roles' pages via `IdentityMapper.effectivePages`; ADMIN → every `Page.key`, same mapper function). (plan §3.2–3.3)
- [x] Test: `test/unit/modules/identity/identity.service.spec.ts` (16 tests) — mocks Prisma via constructor DI (no `@common/db/prisma` mock needed) + `vi.mock`s `@common/events/event-bus`, `@common/utils/password.utils`, `@common/utils/token.utils`, `@common/utils/refresh-token.utils`. Covers: three-way routing (direct + phone, including the pending-client-no-userId case); byte-identical 401 for unknown/wrong-password/disabled (same statusCode+code+message); dummy-compare-still-runs on the unknown-user path; `lastLoginAt` set + `auth.loggedIn` emitted with the right payload; JWT payload carries `staffId` vs `clientId` correctly; rotation (`revokedAt`+`replacedByTokenId`); reuse → chain-kill; expired → 401; disabled-user refresh (defense-in-depth, not explicitly required by the plan but a real code branch) → 401; logout revokes active tokens; effective-pages staff-union vs admin-all. (plan §4.2)

**Validation**
- [x] `npx tsc --noEmit` clean.
- [x] `npm run test:unit` green — 74/74 tests, 13 files.
- [x] `npm run lint` clean.
- [x] Service throws `AppError` subclasses (`invalidCredentialsError()` — no dedicated subclass exists for `AUTH_INVALID_CREDENTIALS`, per plan §8 item 5); emits typed events **after commit** (inside/after the `$transaction`); returns DTOs via `.parse()` against `LoginResultResponseSchema`/`RefreshResultResponseSchema` (never entities/hashes).
- [x] Committed on green (`api: identity sprint 3 — auth and sessions`).

**Report:** [`results-identity-01/report-sprint-03-01.md`](./results-identity-01/report-sprint-03-01.md)

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
