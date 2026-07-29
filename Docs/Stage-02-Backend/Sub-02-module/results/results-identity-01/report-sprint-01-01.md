# Identity — Sprint 1 Report: Prerequisites & contract additions

**Status:** ✅ Done — [`sprints-identity-01.md`](../sprints-identity-01.md) Sprint 1 marked ✅.

---

## Owner decisions taken (asked before implementing — both hard-to-reverse contract/behavior choices)

1. **Page seed scope: STAFF-scope only.** Swept all 12 module contracts for an `admin(PAGE_KEY)`
   gating pattern analogous to `staff(PAGE_KEY)` — none exists; every admin route's access level is
   the bare word `admin` (bypasses the page-key matrix entirely). The only `ADMIN_XXX`-shaped tokens
   found (`ADMIN_LIST`, `ADMIN_DASHBOARD`, …) turned out to be **route-constant names**
   (e.g. `ClientRoutes.ADMIN_LIST`), not page keys. Since no ADMIN-scope key naming exists anywhere in
   Stage-00 (unlike the 7 STAFF-scope keys, each quoted verbatim in a contract), inventing 19 admin
   page identifiers would be authoring new domain data, not reading it. **Decision: seed only the 7
   STAFF-scope keys.** `Page.scope` in Prisma still supports `ADMIN` for later.
2. **Login rate-limiting: explicitly deferred.** No limiter dependency/middleware exists in the
   foundation. An in-process (Map-based) limiter would silently misbehave under any multi-instance
   deployment; a correct implementation needs a shared store (e.g. Redis) that doesn't exist yet.
   **Decision: not implemented in this module** — tracked as follow-up infra work.

Both are recorded in `plan-identity.md` §7.1/§7.2 with the reasoning above.

## HOW-conflict found and resolved during execution

`Docs/Stage-02-Backend/env-template.md:21` already prescribes an env var for this exact purpose,
named **`REFRESH_TOKEN_EXPIRATION`** — the plan had independently invented `REFRESH_TOKEN_TTL_DAYS`.
Per the standing rule (rules govern HOW; resolve HOW conflicts toward the rules and note them),
renamed to `REFRESH_TOKEN_EXPIRATION`. Kept the **value as a plain integer day-count** (not a duration
string like `JWT_EXPIRATION`'s `"15m"`) since refresh tokens are raw random bytes, not JWTs — nothing
requires the `jsonwebtoken`/`ms` duration format, and adding a duration-parsing dependency for this
alone would be unnecessary complexity. Documented as a deviation in `env.ts` and `plan-identity.md` §7.3.

---

## What was implemented

### Contract (`Apps/contract`)
- `identity.enums.ts`: added `PageKey` (7 members: `STAFF_POS`, `STAFF_POS_CLIENTS`,
  `STAFF_PRODUCTS`, `STAFF_ORDERS`, `STAFF_SALES`, `STAFF_INVOICES`, `STAFF_REPAIRS`) and `PageGroup`
  (6 members: `POS`, `CATALOG`, `ORDERS`, `SALES`, `BILLING`, `REPAIRS`). Already re-exported by the
  identity barrel (`export * from './identity.enums'`) and the package root.

### API (`Apps/api`)
- `src/common/utils/password.utils.ts` — reimplemented with `argon2` (`argon2id`); `hashPassword`/
  `comparePassword` signatures unchanged. Dropped `bcrypt` + `@types/bcrypt`.
- `src/env.ts` — added `REFRESH_TOKEN_EXPIRATION` (`z.coerce.number().int().min(1).default(7)`,
  days).
- `prisma/seed.ts` (new) — upserts the 7 `PageKey` rows (scope `STAFF`), keyed by `PageKey`/
  `PageGroup`/`PageScope` only (no magic strings); uses the shared `logger`, not `console`.
- `package.json` — added `"prisma": { "seed": "tsx prisma/seed.ts" }` and a `db:seed` script; removed
  `bcrypt`/`@types/bcrypt`, added `argon2`.
- `tsconfig.json` — added `prisma` to `include` (it was previously excluded from `tsc --noEmit`
  entirely — `prisma/seed.ts` would have gone unchecked).
- `.env.example` / `env-template.md`-adjacent — documented `REFRESH_TOKEN_EXPIRATION=7`.
- Updated `test/unit/common/utils/password.utils.spec.ts` (added an Argon2id-format assertion) and
  `test/unit/env.spec.ts` (renamed var in the delete-list + added a default-value assertion).

### Side effect: security fix
Removing `bcrypt` also removed its vulnerable transitive dependency chain
(`bcrypt → @mapbox/node-pre-gyp → tar`, 3 high-severity advisories). `npm audit`: 3 high → **0**.

### Local dev/test database (environment note, not part of the deliverable)
No `.env` existed and Docker wasn't reachable in this sandbox (`permission denied` on the Docker
socket, no passwordless `sudo`). Initialized a **user-owned, ephemeral Postgres 12 instance** in the
scratchpad (`initdb` + `pg_ctl`, socket at `/tmp/dt-pgsock`, port `5544`) with `dragon_telecom_dev`/
`dragon_telecom_test` databases, and wrote `Apps/api/.env` (git-ignored) pointing at it, so migrations
and the seed could actually be run and verified rather than only code-reviewed. This is **not a
permanent setup** — it lives in the session scratchpad. For real local development, follow
`docker-compose.test.yml` (needs Docker access) or install a persistent local Postgres and populate
`Apps/api/.env` from `.env.example`.

Also created the first migration (`prisma/migrations/20260717103221_init`) from the full
`schema.prisma` — no migrations existed in the repo before this sprint.

---

## Validation

| Check | Result |
|---|---|
| Contract: `npm --prefix Apps/contract run validate` (tsc + madge cycles + eslint + conformance) | ✅ green |
| API: `npx tsc --noEmit` (now includes `prisma/`) | ✅ clean |
| API: `npm run lint` (now includes `prisma/`) | ✅ clean |
| `npm run test:unit` (36 tests / 10 files, incl. updated password-util spec + contract conformance) | ✅ green |
| `npm run db:seed` | ✅ succeeds; 7 STAFF-scope `Page` rows created |
| Re-run `npm run db:seed` | ✅ idempotent — still 7 rows (upsert by `key`) |
| No magic strings in the seed (`PageKey`/`PageGroup`/`PageScope` only; labels are plain display text) | ✅ |
| `npm run test:int` (pre-existing `health.spec.ts`, sanity check against the real test DB) | ✅ green (not required by Sprint 1, run as a sanity check since a test DB was available) |
| `npm audit` | ✅ 0 vulnerabilities (was 3 high, via `bcrypt`) |

`node --version` in this environment is `v18.18.0`, below the `package.json` `engines` requirement
(`>=20`) — pre-existing constraint from sub-01, unrelated to this sprint's changes; all commands above
still ran and passed on it.

---

## Deferred / flagged (not blocking, tracked)

- Login rate-limiting (owner-deferred, see above).
- `prisma migrate dev` warns that `package.json#prisma` config is deprecated in favor of a
  `prisma.config.ts` file (Prisma 7 migration path) — non-blocking on the installed v6.19.3, not
  addressed here to avoid unrelated scope creep.
- ADMIN-scope `Page` rows are not seeded (owner-deferred, see above) — add later if a real
  `admin(PAGE_KEY)` gate is introduced.

---

## Commit

`git add .` then `git commit -m "api: identity sprint 1 — prerequisites"` (contract enum change
included in the same commit — both are small, coupled, and land together cleanly; not worth splitting
into a separate `contract:` commit for a two-enum addition).
