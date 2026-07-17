# Sprint 2: Framework — Report

**Status:** ✅ Done
**Scope:** Framework services on top of the foundation — logging, `ApiResponse` envelope, typed event bus, pure utils — plus the test foundations (guarded DB reset, user factory) later sprints reuse.

---

## 1. Work done

- **`src/common/config/logger.ts`** — Pino from `env.LOG_LEVEL`; `pino-pretty` transport only in `development` (built via a conditional spread rather than `transport: undefined`, required by `exactOptionalPropertyTypes`); redacts `req.headers.authorization` and `req.body.password`.
- **`src/common/http/response.ts`** — `sendSuccess<T>(res, data, status = 200, message?)`. Builds the `ApiResponse<T>` object conditionally (omits `message` entirely rather than setting it to `undefined`) to satisfy `exactOptionalPropertyTypes`.
- **`src/common/events/event-bus.ts`** — typed wrapper over `node:events`. `AppEvents` is the intersection of all 10 contract event maps (`IdentityEvents & CatalogEvents & ClientsEvents & InventoryEvents & PlatformEvents & PurchasingEvents & SalesEvents & OrdersEvents & RepairsEvents & BillingEvents`); confirmed each is re-exported from its module's `index.ts` → the contract root. No `ActivationEvents` (doesn't exist in this contract).
- **`src/common/utils/password.utils.ts`** — pure `hashPassword`/`comparePassword` wrapping `bcrypt` (10 salt rounds). No DB, no service imports.
- **`src/common/utils/token.utils.ts`** — `generateToken` (`jwt.sign` with `env.JWT_SECRET`/`env.JWT_EXPIRATION`), `verifyToken`. Needed a `NonNullable<jwt.SignOptions['expiresIn']>` cast (not `any`) — `@types/jsonwebtoken`'s `expiresIn` is typed `StringValue | number | undefined`, and passing that union as-is into an object literal fails under `exactOptionalPropertyTypes` (the plain `string` from our env schema isn't the branded `StringValue`, and the raw union re-introduces `undefined` into a property we always set). This replaces the template's dependency on the `ms` package, which was dropped in Sprint 1.
- **`test/data/user.factory.ts`** — `createUser(overrides?)` returning `{ id, username, email?, password, type: UserType, isEnabled }`. Deliberately not modeled on a single contract type: `UserDto` strips credentials by design (API response shape) and `CreateUserCommand` is admin-only (ADMIN/STAFF, with `profile`/`roleIds`, no `id`) — neither fits a generic "insertable test user." This is a self-contained internal shape for Sub-01's own tests (Sprint 3's `auth.fixture`/`auth.middleware` spec); Sub-02 modules will add their own contract-shaped factories.
- **`test/fixtures/db.fixture.ts`** — `resetDatabase()` asserts `NODE_ENV==='test'`, then dynamically enumerates all `public` schema tables via `pg_tables` (excluding `_prisma_migrations`) and `TRUNCATE ... RESTART IDENTITY CASCADE`s them. Dynamic enumeration avoids a hardcoded table list going stale as Sub-02+ modules add tables.
- **`test/setup.ts`** — rewritten (Sprint 1 left it as-is; this sprint's task explicitly calls for it to "point Prisma at `TEST_DATABASE_URL`", which the old version didn't actually do — it defaulted `DATABASE_URL` and `TEST_DATABASE_URL` independently to the same hardcoded string, so a developer's real `TEST_DATABASE_URL` was silently ignored). Now: forces `NODE_ENV='test'` unconditionally (this file only ever loads for vitest runs), then **always** overwrites `process.env.DATABASE_URL` with `TEST_DATABASE_URL` (env var if set, else a default pointing at the `docker-compose.test.yml` Postgres on `:5433`). This guarantees Prisma never touches a dev/prod URL during any test run, closing a real safety gap given `resetDatabase` truncates every table.

## 2. Tests created

- **`test/unit/common/utils/password.utils.spec.ts`** — hash ≠ plaintext; `comparePassword` true for correct password, false for wrong password (3 tests).
- **`test/unit/common/utils/token.utils.spec.ts`** — sign→verify round-trip preserves payload; a tampered payload segment is rejected (2 tests).
- **`test/unit/common/events/event-bus.spec.ts`** — a typed `emit('auth.loggedIn', ...)` reaches a registered `on` handler with the exact payload (1 test).
- **`test/unit/fixtures/db.fixture.spec.ts`** — `resetDatabase()` rejects when `NODE_ENV` is stubbed to `development`, before any DB call (1 test). Not explicitly named in `sprints.md`'s Sprint 2 test list, but restores coverage the deleted template had for this safety-critical guard.

**Result:** 4 new spec files, 7 new tests. Combined with Sprint 1: **6 files, 20 tests, all passing.**

## 3. Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean (after the `NonNullable<...>` fix in `token.utils.ts`) |
| `npm run lint` | Clean |
| `npm run test:unit` | 20/20 passing |
| Utils are pure (no DB/service imports) | Confirmed — no `prisma` import in `src/common/utils/*.ts` |
| No `console.*` outside `env.ts` | Confirmed |
| No `process.env` outside `env.ts` | Confirmed |
| `db.fixture` refuses to run outside `NODE_ENV=test` | Confirmed by spec |
| Factories are the only source of test data; correct folders | Yes |

## 4. Notes for later sprints

- Sprint 3 (Guards) can now use `test/data/user.factory.ts`'s `createUser()` to build `auth.fixture.ts` JWTs (`{ sub: user.id, type: user.type }`) and to mock Prisma's `checkDB` freshness lookup (`{ type: user.type, isEnabled: user.isEnabled }`).
- `pino-http` itself is still unwired — per `sprints.md`, that happens in `app.ts` (Sprint 4), configured from this sprint's `logger` instance.
