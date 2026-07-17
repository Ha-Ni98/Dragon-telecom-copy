# Sprint 1: Foundation — Report

**Status:** ✅ Done
**Scope:** `apps/api` zero-dependency layer — workspace scaffold, strict TS, validated `env`, error hierarchy, Prisma singleton.

---

## 0. Prerequisite: template cleanup

The existing `Apps/api` tree was the generic `@your-app` starter template — full `auth`/`delivery-company` feature modules, a Socket.IO realtime subsystem, rate-limiting middleware, and an admin seed script, all bound to a **different, nonexistent contract** (`@your-app/contract` exporting `AUTH_ROUTES`/`DELIVERY_COMPANY_ROUTES`/`UserRole`, none of which exist in `@dragon-telecom/contract`). None of it belongs to Sub-01 per `plan.md`/`sprints.md` (no feature modules, no realtime), and it would have kept `tsc --noEmit`/`test:unit` broken through every future sprint regardless of what got built.

Removed (git-tracked, reversible via history):
- `src/modules/{auth,delivery-company,user}`, `src/modules/index.ts`
- `src/common/realtime/` (all 6 files)
- `src/common/middlewares/rate-limit.middleware.ts`, `src/common/utils/password-generator.util.ts`, `src/common/http/pagination.ts`
- `scripts/create-admin.ts`
- All matching tests/factories/fixtures for the above (auth/delivery-company factories, integration specs, realtime gateway spec, module unit specs, pagination/password-generator specs)
- Sprint 2/3/4-owned files that were template-shaped and incompatible with the real contract (`logger.ts`, `response.ts`, `event-bus.ts`, `password.utils.ts`, `token.utils.ts`, `user.factory.ts`, `db.fixture.ts`, `express.d.ts`, the three middlewares, `auth.fixture.ts`, `app.ts`, `server.ts`, `health.spec.ts`, `routes.conformance.spec.ts`, and their specs/test-helpers) — deleted now rather than patched, to be rebuilt fresh in their owning sprint per `sprints.md`, exactly as a greenfield build would produce them.

This was confirmed with the user before executing (broader than the literal Sprint 1 task list, but a precondition for it).

---

## 1. Work done

- **`package.json`** → renamed to `@dragon-telecom/api`; deps rebound to `@dragon-telecom/contract` (file dependency); `argon2` → `bcrypt` (+ `@types/bcrypt`), `socket.io`/`socket.io-client`/`express-rate-limit`/`ms`/`madge` dropped (no realtime, no rate-limit module, no cycle-check need yet); `eslint`/`typescript-eslint` added; new `lint` script.
- **`tsconfig.json`** — alias `@your-app/contract` → `@dragon-telecom/contract` (unchanged: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- **`vitest.config.ts` / `vitest.integration.config.ts`** — same alias rebind.
- **`eslint.config.js`** (new) — mirrors `Apps/contract/eslint.config.js` (`typescript-eslint` recommended + `no-explicit-any`, `no-unused-vars`, `consistent-type-imports`), since no lint tooling existed for `apps/api` yet and the phase file requires lint-clean validation.
- **`.env.example`** — keys per plan §3: `NODE_ENV`, `PORT`, `API_PREFIX` (now `/api`, not `/api/v1`), `DATABASE_URL`, `TEST_DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRATION`, `LOG_LEVEL`. Dropped `REFRESH_TOKEN_EXPIRATION` and the `WS_*`/`REDIS_URL` realtime keys (no realtime this project).
- **`docker-compose.test.yml`** — kept the disposable-Postgres pattern (port 5433, tmpfs, healthcheck), renamed the DB to `dragon_telecom_test`.
- **`src/env.ts`** — Zod 4 schema exactly per plan §3 (`API_PREFIX` default `/api`; `TEST_DATABASE_URL` optional `z.url()`; no `WS_*`/`REFRESH_TOKEN_EXPIRATION`); `safeParse` → `console.error(z.treeifyError(...))` + `process.exit(1)` on failure; sole reader of `process.env`.
- **`src/common/errors/app-error.ts` + `index.ts`** — unchanged logic, import rebound to `@dragon-telecom/contract`. `AppError` + `AuthError`(401/`AUTH_UNAUTHORIZED`), `ForbiddenError`(403/`AUTH_FORBIDDEN`), `NotFoundError`(404/`RESOURCE_NOT_FOUND`), `ConflictError`(409/`RESOURCE_CONFLICT`), `BadRequestError`(400/`VALIDATION_ERROR`) — all bound to the real contract `ErrorCode`.
- **`src/common/db/prisma.ts`** — unchanged; single exported `PrismaClient`.

## 2. Tests created/updated

- **`test/unit/env.spec.ts`** — rewritten: valid-env parse now asserts `API_PREFIX === '/api'` and no `WS_PATH`/`REFRESH_TOKEN_EXPIRATION` fields; crash cases cover missing `JWT_SECRET`, sub-32-char `JWT_SECRET`, missing `DATABASE_URL`, and (added) an invalid `DATABASE_URL` string — 5 tests.
- **`test/unit/common/errors.spec.ts`** — import rebound to `@dragon-telecom/contract`; all 5 error subclasses + base `AppError` behavior otherwise unchanged — 8 tests.
- **`test/setup.ts`** — no changes needed (already contract-agnostic; provides minimum valid env for any test importing `src/env.ts`).

**Result:** 2 files, 13 tests, all passing.

## 3. Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean |
| `npm run lint` (`eslint src test`) | Clean |
| `npm run test:unit` | 13/13 passing (`env.spec.ts` ×5, `errors.spec.ts` ×8) |
| Every `env.X` used exists in the schema | Yes (only `env.ts` itself reads `process.env`) |
| No `console.*` in app code | Only `env.ts`'s boot-crash log (sanctioned) |
| No `process.env` outside `env.ts` | Confirmed via repo-wide grep |
| Test files in correct folders; no hardcoded data | Yes |
| `npm install` reconciled `package-lock.json` | Yes (47 added / 150 removed on first pass; +79 for eslint tooling) |

Not run this sprint: `npm run test:int` (no routes/app exist yet to exercise; first meaningful integration test — `health.spec.ts` — is a Sprint 4 deliverable).

## 4. Notes for later sprints

- Local Node is v18.18.0; `package.json` `engines` requires `>=20` per back-end-rules.md — `npm install`/`tsc`/`vitest` all ran fine (warning only), but flagging in case CI enforces `engine-strict`.
- `npm audit` reports 3 high-severity advisories in transitive deps (not investigated — pre-existing in the template's dependency tree, unrelated to this sprint's changes; worth a look before shipping but not a Sprint 1 blocker).
- Sprint 2 (Framework) now starts from a clean slate for `logger.ts`, `response.ts`, `event-bus.ts`, `password.utils.ts`, `token.utils.ts`, `user.factory.ts`, `db.fixture.ts` — none of these exist yet; they are net-new work, not edits.
