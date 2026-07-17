# Stage 02 · Sub-01 · Phase 02 — Backend Init Sprints (Results)

Decomposition of [`plan.md`](./plan.md) into dependency-aware sprints. Infrastructure and its tests ship before anything that uses them. **No feature modules. No realtime. No code in this document.**

**Package:** `@dragon-telecom/api`, bound to `@dragon-telecom/contract`.

**Dependency chain (fixed order):** `env → errors → prisma singleton → config/logger + http/response + events → utils → middleware → app → server`. Each sprint ships its implementation *and* its unit tests; each closes with a Validation block covering **compilation** and **unit tests**.

**Contract binding:** every type/enum/route named below was verified to already exist in `@dragon-telecom/contract` — sprints **import** them, never redefine them. Confirmed exports: `ApiResponse`, `PaginationMeta`/`paginated`, `BooleanQuerySchema` (`common/types`), `ErrorCode` (`common/errors`), `JWTPayload`/`JWTPayloadSchema` (`common/auth`), `UserType` (`identity.enums`), the 10 event maps (`IdentityEvents`, `CatalogEvents`, `ClientsEvents`, `InventoryEvents`, `PlatformEvents`, `PurchasingEvents`, `SalesEvents`, `OrdersEvents`, `RepairsEvents`, `BillingEvents`), and the `*_ROUTES` constants.

---

## Prerequisite (applied) — contract routes made relative

Per plan §2.1 (D4), the contract's route constants were stripped of their leading `/api` (`'/api/auth/login'` → `'/auth/login'`) across all 12 `*_ROUTES` maps, so the single prefix lives in `env.API_PREFIX` (default `/api`). Names, params, and route splits are unchanged; `env.API_PREFIX + ROUTE` reproduces the original paths. This is a one-time contract edit, not a backend sprint task — it is the precondition that lets Sprints 1 (env) and 4 (mount/conformance) use the prefix model. The contract's own `__tests__/conformance.test.ts` does not assert route prefixes and stays green.

---

## Sprint 1: Foundation — Status: ✅ Done

**Goals**
- The zero-dependency layer compiles and crashes loudly on bad config: workspace scaffold, strict TS, test scripts, validated `env`, error hierarchy, Prisma singleton.

**Tasks**
- [ ] Scaffold: `apps/api/package.json` (`@dragon-telecom/api`; deps per plan §5 — no `socket.io`), `.env.example` (keys from plan §3, no secrets), `docker-compose.test.yml` (disposable Postgres).
- [ ] Config: `tsconfig.json` — `strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; aliases `@common/*`, `@modules/*`, `@dragon-telecom/contract` → `../contract/src/index.ts`.
- [ ] Scripts: `test`, `test:unit` (`vitest run test/unit test/contract`), `test:int` (`NODE_ENV=test …`) per test-rules §3; `build`, `dev`, `prisma:generate`.
- [ ] Impl: `src/env.ts` — Zod 4 schema of plan §3 **including `API_PREFIX` (default `/api`)** and `TEST_DATABASE_URL`; `safeParse` → `console.error(z.treeifyError())` + `process.exit(1)`; export typed `env`. Sole reader of `process.env`.
- [ ] Impl: `src/common/errors/app-error.ts` + `index.ts` — `AppError` (`statusCode`, `code: ErrorCode`, `details?`) and subclasses bound to contract `ErrorCode`: `AuthError`(401/`AUTH_UNAUTHORIZED`), `ForbiddenError`(403/`AUTH_FORBIDDEN`), `NotFoundError`(404/`RESOURCE_NOT_FOUND`), `ConflictError`(409/`RESOURCE_CONFLICT`), `BadRequestError`(400/`VALIDATION_ERROR`).
- [ ] Impl: `src/common/db/prisma.ts` — single exported `PrismaClient`.
- [ ] Test: `test/unit/env.spec.ts` — proves the validator exits/throws when a required var is missing/invalid (e.g. absent `JWT_SECRET`, sub-32-char secret).
- [ ] Test: `test/unit/common/errors.spec.ts` — each subclass carries the right `statusCode` + contract `ErrorCode`.

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` — `env.spec` + `errors.spec` pass.
- [ ] Every `env.X` used anywhere exists in the schema; no `process.env` read outside `env.ts`; no `console.*` in app code (`env.ts` boot-crash log excepted).
- [ ] Test files in the correct folders; no hardcoded data.
- [ ] Committed on green.

---

## Sprint 2: Framework — Status: ✅ Done

**Goals**
- The framework services on top of the foundation: logging, the `ApiResponse` envelope, the typed event bus, pure utils — plus the test foundations (guarded DB reset + user factory) that later sprints reuse.

**Tasks**
- [ ] Impl: `src/common/config/logger.ts` — Pino from `env.LOG_LEVEL`; `pino-pretty` transport only in development; `redact` authorization header + `req.body.password`.
- [ ] Impl: `src/common/http/response.ts` — `sendSuccess<T>(res, data, status=200)` producing the contract `ApiResponse<T>` success shape (optional `message`).
- [ ] Impl: `src/common/events/event-bus.ts` — typed wrapper over `node:events`; `AppEvents = IdentityEvents & CatalogEvents & ClientsEvents & InventoryEvents & PlatformEvents & PurchasingEvents & SalesEvents & OrdersEvents & RepairsEvents & BillingEvents` (contract maps; `observability`/`statistics` export none). **No `ActivationEvents`** (not in this contract).
- [ ] Impl: `src/common/utils/password.utils.ts` — pure `hash`/`compare` (bcrypt); `src/common/utils/token.utils.ts` — `generateToken` (`jwt.sign` with `env.JWT_SECRET`/`env.JWT_EXPIRATION`), `verifyToken`.
- [ ] Data: `test/data/user.factory.ts` — Faker object shaped to the contract/schema `User` fields (`username`, `email?`, password, `type: UserType`); overrides param.
- [ ] Fixture: `test/fixtures/db.fixture.ts` — `resetDatabase()` that **asserts `NODE_ENV==='test'`** before TRUNCATE … `RESTART IDENTITY CASCADE`; `test/setup.ts` — asserts test env and points Prisma at `TEST_DATABASE_URL`.
- [ ] Test: `test/unit/common/utils/password.utils.spec.ts` (hash≠plaintext; compare true/false); `token.utils.spec.ts` (sign→verify round-trip; tampered token rejected); `test/unit/common/events/event-bus.spec.ts` (typed emit reaches handler).

**Validation**
- [ ] `tsc --noEmit` clean (event-bus generics resolve against contract maps).
- [ ] `npm run test:unit` — utils + event-bus specs pass.
- [ ] No `console.*` (Pino only); no `process.env` outside `env.ts`; utils are pure (no DB, no service imports); `db.fixture` refuses to run outside `NODE_ENV=test`.
- [ ] Factories are the only source of test data; correct folders.
- [ ] Committed on green.

---

## Sprint 3: Guards — Status: ✅ Done

**Goals**
- The middleware layer: request typing, per-segment validation, the single `requireAuth` guard, and the last-in-chain error handler — all unit-tested with the Sprint 2 factories/fixtures.

**Tasks**
- [ ] Impl: `src/@types/express.d.ts` — augment `Express.Request` with `user?: JWTPayload` (contract) and `validated: { body?; query?; params? }`. No `@ts-ignore`.
- [ ] Impl: `src/common/middlewares/validate-request.middleware.ts` — `validateRequest({ body?, query?, params? })` parses each segment with its **contract** schema, writes coerced result to `req.validated`, `next(err)` on `ZodError` (sidesteps Express 5 read-only `req.query`).
- [ ] Impl: `src/common/middlewares/auth.middleware.ts` — `requireAuth({ types?: UserType[]; checkDB?: boolean })`: require `Bearer`; `jwt.verify`; `JWTPayloadSchema.parse` → `{ sub, type, clientId?, staffId? }`; if `checkDB`, `prisma.user.findUnique({ where:{ id: payload.sub }, select:{ type:true, isEnabled:true } })`, reject `!fresh || !fresh.isEnabled` with `AuthError`, refresh `payload.type`; `types` set and not included → `ForbiddenError`; set `req.user`; `JsonWebTokenError` → `AuthError`. The one sanctioned DB-in-middleware exception.
- [ ] Impl: `src/common/middlewares/error.middleware.ts` — `globalErrorHandler`: `AppError` → its status + `{ success:false, error:{ code, message, details } }`; `ZodError` → 400 `VALIDATION_ERROR` (`err.issues`); else `logger.error({err})` + 500 `INTERNAL_SERVER_ERROR`.
- [ ] Impl: wire `pino-http` from the `logger` instance (configured in `app.ts`, Sprint 4 — no separate file).
- [ ] Fixture: `test/fixtures/auth.fixture.ts` — mint valid JWTs via the real `token.utils`.
- [ ] Test: `test/unit/middleware/validate-request.middleware.spec.ts` (coercion lands in `req.validated`; invalid → `next(ZodError)`); `auth.middleware.spec.ts` (missing/invalid token → `AuthError`; wrong `type` → `ForbiddenError`; valid sets `req.user`; `checkDB` disabled user rejects — Prisma mocked); `error.middleware.spec.ts` (AppError / ZodError / unknown branches).

**Validation**
- [ ] `tsc --noEmit` clean (augmentation applied; no `@ts-ignore`).
- [ ] `npm run test:unit` — all three middleware specs pass.
- [ ] Middleware fails fast via `next(err)` and never sends the final response; no DB calls except `requireAuth({ checkDB })`; no `console.*`; no `process.env` outside `env.ts`.
- [ ] Specs use `auth.fixture` + `user.factory` (no hardcoded data); correct folders.
- [ ] Committed on green.

---

## Sprint 4: Boot — Status: ⬜ Pending

**Goals**
- The bootloader assembles the pipeline and comes up: `app.ts` middleware chain, `server.ts` lifecycle, a `/health` smoke test, and the route-conformance harness composing `env.API_PREFIX`.

**Tasks**
- [ ] Impl: `src/app.ts` — definition only: `pino-http(logger)` → `helmet()` + `cors({ origin: env.CORS_ORIGIN })` → `express.json()` → `GET /health` (200, outside the prefix) → **module-router mount point under `env.API_PREFIX`** (empty in Sub-01; filled in Sub-02) → `globalErrorHandler` last. Export `app`.
- [ ] Impl: `src/server.ts` — import `env` → `await prisma.$connect()` → `app.listen(env.PORT)` → `SIGTERM`/`SIGINT` graceful shutdown (close server, then `prisma.$disconnect()`). **No `http.createServer`/socket.io** (no realtime).
- [ ] Test: `test/integration/health.spec.ts` — Supertest `GET /health` → 200 (proves the pipeline boots).
- [ ] Test: `test/contract/routes.conformance.spec.ts` — enumerate every `*_ROUTES` constant from `@dragon-telecom/contract` and build expected paths as `env.API_PREFIX + ROUTE`; assert enumeration + prefix composition. Authored to become a hard "every constant registered under `env.API_PREFIX`" check once Sub-02 mounts routers (tolerant of the empty module set now).

**Validation**
- [ ] `tsc --noEmit` clean.
- [ ] `npm run test:unit` — `routes.conformance.spec` (enumeration + prefix composition) passes.
- [ ] `npm run test:int` — `health.spec` returns 200 (test DB up).
- [ ] `app.ts` holds no config logic (setup stays in `config/`); `globalErrorHandler` is the last `app.use`; every future success path goes through `sendSuccess`; no route string literals in backend code (contract constants only).
- [ ] No `console.*`; no `process.env` outside `env.ts`; `common/` imports nothing from `modules/`.
- [ ] Committed on green.

---

## Exit criteria (whole substage)

- All four sprints green: `tsc --noEmit` clean and `npm run test:unit` passing at each; `test:int` health smoke green once the test DB is up.
- `src/modules/` empty (`.gitkeep`); no realtime artifacts.
- Package `@dragon-telecom/api` bound to `@dragon-telecom/contract` for all routes (via `env.API_PREFIX + *_ROUTES`), schemas, DTOs, `ErrorCode`, and event types.
