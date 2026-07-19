# Stage 02 · Sub-01 · Phase 01 — Backend Skeleton Plan (Results)

**Scope:** Core infrastructure only for `apps/api` (package `@dragon-telecom/api`). Framework layer, coding standards, and test harness. **No `src/modules/` content. No realtime.** This document is the plan; it produces no code.

**Sources & precedence:** Rules govern **HOW** (`back-end-rules.md`, `test-rules.md`), the phase file governs **WHAT/WHEN** (`stage-02-sub-01-phase-01-plan.md`), the contract governs **WHICH** (`@dragon-telecom/contract`) and the schema governs persisted shape (`prisma/schema.prisma`). Where a rule's *example* conflicts with the actual contract/schema, the contract/schema wins and the deviation is recorded in §2.

---

## 1. What this substage builds

A production-ready Express 5 / TypeScript skeleton with: strict Zod env validation (crash-on-invalid), Pino logging, the contract's `ApiResponse` envelope, a typed event bus over the contract event maps, `AppError` hierarchy bound to the contract's `ErrorCode`, a single `requireAuth` guard, per-segment request validation, a last-in-chain error handler, and a complete Vitest + Supertest harness with a guarded test-DB reset. No feature modules; `src/modules/` stays empty.

---

## 2. Noted deviations (HOW example → resolved toward WHICH)

These are resolved in favour of the contract/schema and the user instruction; none is a genuine blocking conflict, so work proceeds.

| # | Rule example says | This project uses | Why |
|---|---|---|---|
| D1 | Package scope `@app-template/*` | **`@dragon-telecom/api`**, importing **`@dragon-telecom/contract`** | User instruction; matches the existing contract package name. |
| D2 | `import … from '@app-template/contract'` (built dist) | Alias `@dragon-telecom/contract` → `Apps/contract/src/index.ts` | Contract is ESM (`"type":"module"`), `exports` points at `./src/index.ts`; consume source directly. |
| D3 | `JWTPayload` has `id`, `role`; gate on `UserRole`; DB check reads `status`/`'BANNED'` (back-end-rules §6, §7B) | Contract `JWTPayload = { sub, type, clientId?, staffId? }`; gate on **`UserType`**; DB freshness reads `User.type` + **`User.isEnabled`** | The contract (`common/auth.ts`) and schema (`User`) define these. No `UserRole`, no `status`/`BANNED` exist. |
| D4 | Routes mount at `env.API_PREFIX` (default `/api/v1`) | **Prefix model kept.** Contract route constants made **relative** (leading `/api` stripped → `/auth/login`, `/admin/users`, …); `API_PREFIX` **reinstated** in env with default **`/api`**; module routers mount at `env.API_PREFIX` in Sub-02; `/health` stays outside the prefix. | The single API prefix now lives in one env var instead of being baked into every contract constant; default `/api` reproduces the original absolute paths. Contract edited this substage — see §2.1. |
| D5 | Realtime is opt-in (`realtime-rules.md`); event bus widened with `ActivationEvents` | **No realtime**: no `socket.io`, no `src/common/realtime/`, no `WS_*`/`REDIS_URL`. `ActivationEvents` does not exist in this contract and is not referenced. | User: "for this project we don't need websocket." Realtime is opt-in by design. |
| D6 | `INTERNAL_SERVER_ERROR`, `VALIDATION_ERROR` only shown | Full `ErrorCode` binding: `AUTH_UNAUTHORIZED` (401), `AUTH_FORBIDDEN` (403), `RESOURCE_NOT_FOUND` (404), `RESOURCE_CONFLICT` (409), `VALIDATION_ERROR` (400), `INTERNAL_SERVER_ERROR` (500); `AUTH_INVALID_CREDENTIALS` + `RATE_LIMITED` available for modules | Uses the real members of the contract `ErrorCode` enum. |
| D7 | back-end-rules §2 env omits a test DB var | Add **`TEST_DATABASE_URL`** | Required by `test-rules.md` §1 (disposable integration DB). |

### 2.1 Contract change applied this substage (route prefixing)

Per the routing decision above, the contract's route constants were edited so the `/api` prefix lives in the backend, not the contract:

- **What changed:** every value in all 12 `*_ROUTES` maps (`IDENTITY_ROUTES`, `CATALOG_ROUTES`, `CLIENT_ROUTES`/`POS_CLIENT_ROUTES`, `INVENTORY_ROUTES`, `PLATFORM_ROUTES`, `PURCHASING_ROUTES`, `SALE_ROUTES`, `ORDER_ROUTES`, `REPAIR_ROUTES`, `BILLING_ROUTES`, `STATS_ROUTES`, `OBS_ROUTES`) had its leading `/api` stripped (`'/api/auth/login'` → `'/auth/login'`). Constant **names, path params, and route splits are unchanged**; only the literal prefix moved.
- **How it composes:** full path = `env.API_PREFIX` (default `/api`) `+` the relative constant → identical to the pre-change absolute paths. Nothing downstream shifts unless the prefix is deliberately changed.
- **Backend consumption:** module routers mount at `env.API_PREFIX` (Sub-02); the conformance test builds expected paths as `env.API_PREFIX + ROUTE`.
- **Contract integrity:** the contract's own `__tests__/conformance.test.ts` does not assert route prefixes, so it is unaffected. No DTO/command/query imports a route value.
- **Frontend implication (Stage-03+, out of scope here):** the FE must prepend the same prefix (its own base URL / env) to these now-relative constants — noted so it isn't a surprise.

---

## 3. Environment schema (final for this project)

`src/env.ts` validates `process.env` with Zod 4, `console.error(z.treeifyError(...))` + `process.exit(1)` on failure, and exports a typed `env`. **Nothing else reads `process.env`.** The schema is the exact superset of every `env.X` referenced anywhere below.

| Variable | Type / rule | Default | Read by |
|---|---|---|---|
| `NODE_ENV` | enum `development` \| `production` \| `test` | `development` | logger, db.fixture guard, test setup |
| `PORT` | coerced number | `3000` | server.ts |
| `API_PREFIX` | string | `/api` | app.ts (router mount, Sub-02), conformance test |
| `DATABASE_URL` | `z.url()` | — (required) | prisma singleton |
| `TEST_DATABASE_URL` | `z.url().optional()` | — | test/setup swaps into `DATABASE_URL` when `NODE_ENV=test` |
| `CORS_ORIGIN` | string | `*` | app.ts (cors) |
| `JWT_SECRET` | `z.string().min(32)` | — (required) | token.utils, auth.middleware |
| `JWT_EXPIRATION` | string | `15m` | token.utils |
| `LOG_LEVEL` | enum `fatal…trace` | `info` | logger |

`API_PREFIX` is back (D4); no `WS_*`, no `REDIS_URL` (D5).

---

## 4. Directory structure (infra only)

```text
apps/api/
├── package.json            # @dragon-telecom/api; deps per §5
├── tsconfig.json           # strict + noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax; aliases
├── vitest.config.ts        # unit + contract projects
├── vitest.integration.config.ts
├── .env.example            # keys from §3, NO secrets
├── docker-compose.test.yml # disposable Postgres for test:int
├── prisma/
│   └── schema.prisma       # provided (source of truth)
├── src/
│   ├── env.ts
│   ├── app.ts              # middleware pipeline only
│   ├── server.ts           # listener + graceful shutdown (no socket.io)
│   ├── @types/
│   │   └── express.d.ts    # Request.user, Request.validated
│   ├── common/
│   │   ├── db/prisma.ts
│   │   ├── config/logger.ts
│   │   ├── http/response.ts
│   │   ├── events/event-bus.ts
│   │   ├── errors/{app-error.ts,index.ts}
│   │   ├── middlewares/{validate-request,auth,error}.middleware.ts
│   │   └── utils/{password,token}.utils.ts
│   └── modules/            # EMPTY this substage (.gitkeep only)
└── test/
    ├── setup.ts            # loads env, points Prisma at TEST_DATABASE_URL
    ├── data/user.factory.ts
    ├── fixtures/{db.fixture.ts,auth.fixture.ts}
    ├── unit/{env.spec.ts, common/utils/*, middleware/*}
    ├── integration/health.spec.ts
    └── contract/routes.conformance.spec.ts
```

---

## 5. Dependencies (`package.json`)

- **Runtime:** `express@5`, `@prisma/client`, `zod@4`, `pino`, `pino-http`, `helmet`, `cors`, `jsonwebtoken`, `bcrypt`, and workspace `@dragon-telecom/contract`.
- **Dev:** `typescript`, `prisma`, `vitest`, `supertest`, `pino-pretty`, `@faker-js/faker`, `tsx`, and `@types/*` for express/cors/jsonwebtoken/bcrypt/supertest/node.
- **Not added (D5):** `socket.io`, `socket.io-client`, `@socket.io/redis-adapter`, `ioredis`.
- **Scripts (test-rules §3):** `test` = `vitest run`; `test:unit` = `vitest run test/unit test/contract`; `test:int` = `NODE_ENV=test vitest run test/integration`; plus `build` (`tsc`), `dev` (`tsx watch src/server.ts`), `prisma:generate`.

---

## 6. Build order — every file, its responsibility, its test

Strict dependency order (a file may import only from earlier rows). "Test" = the spec that proves it; unit specs run under `test:unit`.

### Step 1 — Foundation (zero-dependency layer)

| # | File | Responsibility / key bindings | Test |
|---|---|---|---|
| 1 | `package.json` | Deps + scripts (§5). | — |
| 2 | `tsconfig.json` | `strict:true` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; aliases `@common/*`→`src/common/*`, `@modules/*`→`src/modules/*`, `@dragon-telecom/contract`→`../contract/src/index.ts` (D2). | `tsc --noEmit` clean. |
| 3 | `.env.example` | Every key in §3, placeholder values, no secrets. | — |
| 4 | `docker-compose.test.yml` | Local throwaway Postgres for `test:int` (test-rules §1). | brought up by `test:int`. |
| 5 | `src/env.ts` | Zod schema of §3; `safeParse` → on failure `console.error(z.treeifyError())` + `process.exit(1)`; export typed `env`. The **only** reader of `process.env`. | `test/unit/env.spec.ts` — proves it exits/throws when a required var (e.g. `JWT_SECRET`) is missing or too short. |
| 6 | `src/common/errors/app-error.ts` + `index.ts` | `AppError extends Error` carrying `statusCode`, `code: ErrorCode`, optional `details`. Subclasses bound to contract `ErrorCode` (D6): `AuthError`(401/`AUTH_UNAUTHORIZED`), `ForbiddenError`(403/`AUTH_FORBIDDEN`), `NotFoundError`(404/`RESOURCE_NOT_FOUND`), `ConflictError`(409/`RESOURCE_CONFLICT`), `BadRequestError`(400/`VALIDATION_ERROR`); available for modules: `InvalidCredentialsError`(401/`AUTH_INVALID_CREDENTIALS`), `RateLimitError`(429/`RATE_LIMITED`). `index.ts` re-exports all. | `test/unit/common/errors.spec.ts` — each subclass sets the right `statusCode`/`code` (optional but recommended). |
| 7 | `src/common/db/prisma.ts` | Single `PrismaClient` instance, exported. Imported by `server.ts`, middleware, and (later) modules — never the reverse. | Exercised via integration. |

### Step 2 — Framework layer

| # | File | Responsibility / key bindings | Test |
|---|---|---|---|
| 8 | `src/common/config/logger.ts` | Pino from `env.LOG_LEVEL`; `pino-pretty` transport only in development; `redact: ['req.headers.authorization','req.body.password']`. No `console.*` anywhere in app code. | covered indirectly. |
| 9 | `src/common/http/response.ts` | `sendSuccess<T>(res, data, status=200)` → `{ success: true, data }` per contract `ApiResponse<T>` (optional `message` supported). Controllers use this, never `res.json(rawDto)`. | asserted by integration + conformance. |
| 10 | `src/common/events/event-bus.ts` | Typed wrapper over `node:events`. `type AppEvents = IdentityEvents & CatalogEvents & ClientsEvents & InventoryEvents & PlatformEvents & PurchasingEvents & SalesEvents & OrdersEvents & RepairsEvents & BillingEvents` (the 10 contract event maps; `observability`/`statistics` export none). `emit`/`on` keyed by `keyof AppEvents`. **No `ActivationEvents`** (D5). | `test/unit/common/events/event-bus.spec.ts` — typed emit round-trips to a handler. |
| 11 | `src/common/utils/password.utils.ts` | Pure `hash()` / `compare()` over bcrypt. No DB, no service imports. | `test/unit/common/utils/password.utils.spec.ts` — hash≠plaintext; compare true/false. |
| 12 | `src/common/utils/token.utils.ts` | `generateToken(payload)` = `jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRATION })`; `verifyToken()` returns decoded. | `test/unit/common/utils/token.utils.spec.ts` — sign→verify round-trip; tampered token rejected. |
| 13 | `test/data/user.factory.ts` | Faker-built object shaped to the contract's user create command / `User` schema fields (`username`, `email`, `passwordHash`/password, `type: UserType`). Single source of truth for user scenarios; overrides param. | consumed by other specs. |
| 14 | `test/fixtures/db.fixture.ts` | `resetDatabase()` — **asserts `NODE_ENV==='test'`** then TRUNCATEs all tables `RESTART IDENTITY CASCADE`. Refuses to run otherwise (test-rules §1/§5). | its guard verified in `test/integration`. |
| 15 | `test/setup.ts` | Global test bootstrap: assert test env, copy `TEST_DATABASE_URL`→`DATABASE_URL` before Prisma loads. | — |

### Step 3 — Guard layer (middleware)

| # | File | Responsibility / key bindings | Test |
|---|---|---|---|
| 16 | `src/@types/express.d.ts` | Augment `Express.Request` with `user?: JWTPayload` (contract type) and `validated: { body?; query?; params? }`. No `@ts-ignore` anywhere. | typecheck. |
| 17 | `src/common/middlewares/validate-request.middleware.ts` | `validateRequest({ body?, query?, params? })` parses each segment with its **contract** Zod schema, writes coerced result to `req.validated`, `next(err)` on `ZodError`. Sidesteps Express 5 read-only `req.query`. | `test/unit/middleware/validate-request.middleware.spec.ts` — coercion lands in `req.validated`; invalid input calls `next` with a `ZodError`. |
| 18 | `src/common/middlewares/auth.middleware.ts` | `requireAuth({ types?: UserType[]; checkDB?: boolean })` (D3): require `Bearer`; `jwt.verify`; `JWTPayloadSchema.parse` → `{ sub, type, clientId?, staffId? }`; if `checkDB`, `prisma.user.findUnique({ where:{ id: payload.sub }, select:{ type:true, isEnabled:true } })`, reject when `!fresh || !fresh.isEnabled` (`AuthError`), refresh `payload.type`; if `types` set and `!types.includes(payload.type)` → `ForbiddenError`; set `req.user`. `JsonWebTokenError`→`AuthError`. The one sanctioned DB-in-middleware exception. | `test/unit/middleware/auth.middleware.spec.ts` — missing/invalid token→`AuthError`; wrong `type`→`ForbiddenError`; valid token sets `req.user`; `checkDB` with disabled user rejects (Prisma mocked). Uses `auth.fixture` + `user.factory`. |
| 19 | `src/common/middlewares/error.middleware.ts` | `globalErrorHandler` (last `app.use`): `AppError`→its `statusCode` + `{ success:false, error:{ code, message, details } }`; `ZodError`→400 `VALIDATION_ERROR` with `err.issues`; else `logger.error({err})` + 500 `INTERNAL_SERVER_ERROR`. Logs via Pino, never `console`. | `test/unit/middleware/error.middleware.spec.ts` — AppError, ZodError, and unknown-error branches produce the right status + envelope. |
| 20 | `auth.fixture.ts` (`test/fixtures/`) | Mint valid JWTs via the real `token.utils` so specs/integration can authenticate. | consumed by specs. |

`pino-http` is not its own file — it is configured in `app.ts` from the `logger` instance (Step 4).

### Step 4 — Bootloader

| # | File | Responsibility / key bindings | Test |
|---|---|---|---|
| 21 | `src/app.ts` | Definition only (no config logic): `pino-http(logger)` → `helmet()` + `cors({ origin: env.CORS_ORIGIN })` → `express.json()` → `GET /health` (200, outside the prefix) → **module routers mount under `env.API_PREFIX` in Sub-02** (contract constants are relative, D4) → `globalErrorHandler` last. Exports `app`. | `test/integration/health.spec.ts`. |
| 22 | `src/server.ts` | Execution: import `env` → `await prisma.$connect()` → `app.listen(env.PORT)` → `SIGTERM`/`SIGINT` graceful shutdown (close server, then `prisma.$disconnect()`). **No `http.createServer`/socket.io** (D5). | smoke via integration. |
| 23 | `test/integration/health.spec.ts` | Supertest `GET /health` → 200. Proves the pipeline boots. | self. |
| 24 | `test/contract/routes.conformance.spec.ts` | Establishes the conformance mechanism: enumerate every `*_ROUTES` constant exported by `@dragon-telecom/contract` (`IDENTITY_ROUTES`, `CATALOG_ROUTES`, …) and build each expected path as `env.API_PREFIX + ROUTE` (constants are relative, D4). In Sub-01 **no routers are mounted**, so this asserts the enumeration/import + prefix-composition works and is authored to become a hard "every constant is registered under `env.API_PREFIX`" assertion once Sub-02 mounts modules (tolerant of the empty module set now). | self. |

---

## 7. Test harness summary (test-rules)

- **Isolation:** integration runs `NODE_ENV=test` against `TEST_DATABASE_URL` only; `db.fixture` refuses to truncate outside test env; `docker-compose.test.yml` provides the disposable Postgres (`test:int` = up → migrate → run → down).
- **Structure:** `test/data` factories are the single source of truth (no hardcoded data in specs); unit specs `[name].spec.ts`, integration `[name].integration.spec.ts`, conformance under `test/contract/`.
- **Scripts:** `test:unit` (fast, no DB — runs each sprint) and `test:int` (once wiring + test DB exist), per test-rules §3.
- **Conformance (§7):** route-coverage + response-shape parsing (`Schema.parse(res.body.data)`) become fully enforced in Sub-02 when modules and DTO mappers exist; Sub-01 stands up the harness and the route-constant enumeration.

---

## 8. Out of scope (guardrails)

- **No `src/modules/` content** — folder present with `.gitkeep` only.
- **No realtime** — no `socket.io`, no `src/common/realtime/`, no `WS_*`/`REDIS_URL`, no `ActivationEvents` (D5).
- **No route mounting / controllers / services** — deferred to Sub-02; `app.ts` leaves the mount point ready at `env.API_PREFIX` (D4).

## 9. Exit criteria

- `tsc --noEmit` clean under strict + the three extra flags.
- `test:unit` green: `env.spec` (crash-on-missing), utils specs, all three middleware specs, event-bus spec, health integration, conformance enumeration.
- No `console.*` in `src/` (Pino only); no `process.env` outside `env.ts`; no `common/ → modules/` import; single `requireAuth` guard; every success path via `sendSuccess`.
- Package is `@dragon-telecom/api`, bound to `@dragon-telecom/contract` for all routes, schemas, DTOs, `ErrorCode`, and event types.
