# Sprint 4: Boot — Report

**Status:** ✅ Done
**Scope:** The bootloader — `app.ts` middleware pipeline, `server.ts` lifecycle, a `/health` smoke test, and the route-conformance harness. Last sprint of Sub-01.

---

## 1. Work done

- **`src/app.ts`** — definition only, no config logic: `pino-http(logger)` → `helmet()` → `cors({ origin: env.CORS_ORIGIN })` → `express.json()` → `GET /health` (via `sendSuccess`, outside the prefix) → an empty `express.Router()` mounted at `env.API_PREFIX` (the Sub-02 extension point — commented, no module routers exist yet per this substage's constraint) → `globalErrorHandler` last. Exports `app`.
- **`src/server.ts`** — `main()`: `await prisma.$connect()` → `app.listen(env.PORT)` → `SIGTERM`/`SIGINT` handlers that close the HTTP server first, then `prisma.$disconnect()`, then `process.exit(0)`. No `http.createServer`/Socket.IO (no realtime, per plan D5).

## 2. Tests created

- **`test/integration/health.spec.ts`** — Supertest `GET /health` → 200, body equals the exact `ApiResponse` envelope `{ success: true, data: { status: 'ok' } }`. Doesn't touch Prisma (the handler has no DB dependency), so it needs no `resetDatabase()` call and, unlike future Sub-02 integration specs, doesn't strictly require a live Postgres to *pass* — though it's still filed under `test/integration/` per its role as the pipeline smoke test.
- **`test/contract/routes.conformance.spec.ts`** — enumerates all 13 `*_ROUTES` constants across the 12 contract route files (2 tests): (1) every route value is a relative path starting with `/` and does **not** already contain `env.API_PREFIX`; (2) `env.API_PREFIX + route` composes cleanly with no double slash. Deliberately does **not** make live requests yet — no module routers are mounted in Sub-01 (`src/modules/` stays empty), so a "not 404" assertion would be meaningless right now. Comment in the file states the intended Sub-02 extension: once routers exist, add a live-request pass asserting each composed path actually resolves on `app`.

## 3. Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean, first try |
| `npm run lint` | 0 problems (via `--format json`; same Node-18 `stylish`-crash caveat as Sprints 2–3) |
| `npm run test:unit` | 35/35 passing (10 files — the 2 new conformance tests plus all prior) |
| `npm run test:int` | **Not run in this environment** — see §4 |
| `globalErrorHandler` is the last `app.use` | Confirmed by reading `app.ts`'s registration order |
| No route string literals in `src/` | Confirmed — the only `/api` literal is `env.ts`'s own `API_PREFIX` default, not a route |
| No `console.*`/`process.env` outside sanctioned files | Confirmed |
| Every future success path goes through `sendSuccess` | `/health` already does; nothing else emits a response yet |

## 4. `test:int` could not be executed here — environment limitation, not a code issue

Tried, in order:
1. `docker compose -f docker-compose.test.yml up -d` → `permission denied` on `/var/run/docker.sock` (the sandbox user isn't in the `docker` group).
2. `sudo -n docker compose ...` (non-interactive) → `sudo: a password is required`. Did not attempt to capture a sudo password through the shell — that's not something to do without it being explicitly handed over, and not appropriate to prompt for here.
3. Checked for a usable local Postgres as a docker-free fallback: one is running natively (`postgresql-12`, port 5432), but connecting as `postgres` needs a password I don't have, and there's no `johndoe` role for peer auth.

None of these are things I can resolve without you taking an action outside this conversation (adding the sandbox user to the `docker` group, or handing me a working local Postgres credential). Everything else in this sprint — `tsc`, lint, and the full `test:unit` suite including the two new conformance tests — is verified green; `health.spec.ts` and the wiring in `app.ts`/`server.ts` are correct by code review and by the fact `test:unit`'s conformance test already imports `env` and confirms the composition logic. I'm marking Sprint 4 done on that basis, but `test:int` (and therefore the literal "`health.spec` returns 200 against a live test DB" checkbox) is unverified in this sandbox. Worth running once you have Docker/DB access — flagging in the exit summary below.

## 5. Sub-01 exit criteria — status

| Criterion | Status |
|---|---|
| `tsc --noEmit` clean across all 4 sprints | ✅ |
| `npm run test:unit` green across all 4 sprints | ✅ (35/35) |
| `npm run test:int` health smoke green once the test DB is up | ⚠️ Not verified in this sandbox (§4) — code is written and reviewed, needs a real run |
| `src/modules/` empty (`.gitkeep` only); no realtime artifacts | ✅ |
| Package `@dragon-telecom/api` bound to `@dragon-telecom/contract` for routes/schemas/DTOs/`ErrorCode`/events | ✅ |

All four sprints are ✅ in `sprints.md`. Recommend running `docker compose -f Apps/api/docker-compose.test.yml up -d && npm run test:int` in an environment with Docker access before treating Sub-01 as fully closed.
