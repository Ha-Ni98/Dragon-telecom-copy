# Catalog — Sprint 1 Report: Prerequisites — contract additions + auth-middleware extension

**Status:** ✅ Done — [`sprints-catalog-03.md`](../sprints-catalog-03.md) Sprint 1 marked ✅.

---

## Owner decisions already resolved in the plan (applied here, not re-litigated)

Both HOW gaps flagged in `plan-catalog.md` §7.2/§7.3 were resolved by the owner before this sprint
started (see the plan's revision history): `PRODUCTS`/`PRODUCT_DETAIL` need `requireAuth({ optional: true
})` (token shapes data, never gates access), and `STAFF_PRODUCTS` needs a DB-checked `requireAuth({
pages: [...] })` extension — both landed as **options on the existing `requireAuth`**, not new
middleware files. This sprint implements exactly that.

---

## What was implemented

### Contract (`Apps/contract/src/modules/catalog/catalog.dtos.ts`)
- `ProductDetailResponseSchema` = `ProductWithPricingResponseSchema.extend({ relatedIds: z.array(z.uuid())
  })` + `type ProductDetailDto` — satisfies the spec's `PRODUCT_DETAIL` "+ related ids" note (plan §8 #1).
  Re-exported automatically via the existing `export *` barrel (`catalog/index.ts` → package root) —
  no barrel edit needed.
- `FamilyResponseSchema` — added optional `productCount: z.number().int().min(0).optional()`. Omitted
  when not populated, so every existing caller/test that builds a `FamilyDto` without the field is
  unaffected (plan §8 #2).

### API (`Apps/api/src/common/middlewares/auth.middleware.ts`)
- `RequireAuthOptions` gained two fields:
  - `optional?: boolean` — a missing **or** invalid (bad signature / fails `JWTPayloadSchema`) token now
    calls `next()` with no `req.user` instead of throwing `AuthError`, when set. Valid tokens still
    populate `req.user` as before; `checkDB`/`types`/`pages` still run and can still reject a *present*
    token.
  - `pages?: PageKey[]` — after the `types` check, if set and the caller isn't `UserType.ADMIN`, loads
    `prisma.userRole.findMany({ where: { userId }, include: { role: { include: { rolePages: { include:
    { page: true } } } } } })`, unions the enabled roles' page keys (disabled roles skipped — same rule
    as identity's `effectivePages`), and throws `ForbiddenError('Insufficient permissions', {
    missingPages })` if any requested page is absent. `ADMIN` bypasses without touching the DB.
  - Implemented **inline in the middleware** (not by importing identity's `IdentityMapper.effectivePages`)
    to avoid a `common → modules` layering inversion; the query is the same shape identity's service
    already runs, just duplicated at the infra boundary where `common/middlewares` already talks to
    `prisma` directly (mirrors the existing `checkDB` block in the same file).

### Tests (`Apps/api/test/unit/middleware/auth.middleware.spec.ts`)
- Extended the `prisma` mock with `userRole.findMany`.
- 7 new cases: `optional` + missing token → `next()`, no `req.user`; `optional` + invalid token → same;
  `optional` + valid token → `req.user` still populated; `pages` present → passes (asserts the exact
  `findMany` call shape); `pages` missing → `ForbiddenError`; disabled role's pages don't count →
  `ForbiddenError`; `ADMIN` bypasses `pages` without calling `findMany`.
- 13/13 tests green (6 pre-existing + 7 new).

No new files — everything landed inside the two files the plan named.

---

## Validation

| Check | Result |
|---|---|
| Contract: `npm --prefix Apps/contract run validate` (tsc + madge cycles + eslint + conformance) | ✅ green |
| API: `npx tsc --noEmit` | ✅ clean |
| API: `npm run lint --no-color` | ✅ clean |
| `npm run test:unit` (172 tests / 18 files, incl. the extended auth-middleware spec) | ✅ green |
| `auth.middleware.spec.ts` specifically | ✅ 13/13 |
| No magic strings — `pages` consumes `PageKey` enum members only; no route wired to the new options yet (that's Sprint 5) | ✅ |

`test:int` not run — no route in this sprint changed request-handling behavior end-to-end; deferred to
Sprint 5 per the sprint plan's gate rule.

---

## Deferred / flagged (not blocking, tracked)

- Nothing new deferred by this sprint. The inventory-port stub, the taxonomy/category/product logic, and
  the actual route wiring of `optional`/`pages` onto `CATALOG_ROUTES` are Sprints 2–5 as planned.

---

## Commit

`git add .` then `git commit -m "api: catalog sprint 1 — prerequisites"` (contract additions and the
middleware extension land in the same commit — both are small, coupled prerequisites for the module that
follows; not worth splitting into a separate `contract:` commit).
