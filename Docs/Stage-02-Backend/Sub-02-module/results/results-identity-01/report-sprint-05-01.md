# Identity — Sprint 5 Report: API (controller, routes, wiring, integration & conformance)

**Status:** ✅ Done — [`sprints-identity-01.md`](../sprints-identity-01.md) Sprint 5 marked ✅. **This closes the identity module — all 5 sprints done.**

---

## What was implemented

### `identity.controller.ts`
16 thin handlers (one per registered route+method). Each is `try/catch → next(error)`, reads `req.validated.{body,params,query}`, and calls `sendSuccess`. `logout`/`mePermissions` read `req.user!` — the non-null assertion is safe because both routes are always preceded by `requireAuth(...)` in `routes.ts`, which sets `req.user` before the controller ever runs. A small `buildRequestContext(req)` helper builds `login`/`refresh`'s `{ ipAddress?, userAgent? }` context conditionally (`exactOptionalPropertyTypes` forbids assigning `req.headers['user-agent']`, typed `string | undefined`, directly to an optional field that doesn't itself include `undefined`).

### `identity.routes.ts`
Composition root — the only place `new IdentityService(prisma)`/`new IdentityController(service)` happen. One registration per route from the plan's §5.1 table; guard middleware precedes `validateRequest` on every route, matching the rules doc's own example ordering. `adminOnly = requireAuth({ types: [ADMIN], checkDB: true })` is a shared local constant.

### Wiring
Added `src/modules/index.ts` (`registerModules(apiRouter)`), per the plan's recommended approach — `app.ts`'s extension point now calls this once instead of holding a placeholder comment, so future modules only touch `modules/index.ts`, not `app.ts` itself.

### Integration suite (`identity.integration.spec.ts`, 14 tests)
Seeds real users/roles/pages via the Sprint 2 factories and mints tokens directly for **persisted** users (`generateToken({ sub: user.id, type: user.type })`) rather than `auth.fixture.ts`'s `mintAuthToken` — that fixture builds an unpersisted fake user, which would always fail admin routes' `checkDB: true` freshness lookup. Documented this choice inline since it deviates from the pre-existing fixture without saying why would be confusing to a future reader.

Notable coverage beyond the minimum: the refresh chain-kill test verifies not just that reusing the *old* token 401s, but that the token issued by the rotation immediately before is *also* dead afterward (proving "kill the whole chain," not just "reject this one token"). The `setRolePages` ADMIN-scope-key test inserts a real `Page` row with `scope: ADMIN` directly via Prisma (bypassing the STAFF-only seeded registry) so it exercises the actual ADMIN-scope-rejection branch, not just the unknown-key branch — same 400 status, genuinely different code path.

### Conformance — split across two tiers (see design note in the sprint file)
The plan's single conformance task bundles "route resolves, not 404" with "response payload parses against its DTO schema" in one `test/contract/routes.conformance.spec.ts` extension. Since that file is bundled into `test:unit` (test-rules.md §3: "fast, no DB"), and response-shape checks need a real authenticated 200/201 (i.e., a DB), I split the two:
- **Route resolution** (DB-free): `routes.conformance.spec.ts` now sends all 16 method+path combinations unauthenticated and asserts the response has a `success` key — proof the request reached our envelope (`sendSuccess` or `globalErrorHandler`), not Express's bare unmatched-route 404. `requireAuth` always rejects on a missing token *before* any `checkDB` lookup, so this genuinely never touches Prisma — confirmed by wall-clock (16 requests completed in under 20ms total in the run).
- **Response-shape** (needs DB): added `.parse()` assertions against the real payloads the integration suite's existing 200/201 tests already produce — `LoginResultResponseSchema`, `RefreshResultResponseSchema`, `UserResponseSchema` (single + `paginated(...)`), `RoleResponseSchema`, `PageResponseSchema`, `TechnicianResponseSchema`. All 7 schemas the plan named are exercised.

---

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ clean (one real finding fixed along the way: a type-only import) |
| `npm run test:unit` | ✅ 98/98 tests, 13 files |
| `npm run test:int` | ✅ 15/15 tests, 2 files — **first real exercise of the full stack against a live Postgres**, first try, no logic bugs found (only two type/lint fixes along the way, both mechanical) |
| Routes use contract constants only; `sendSuccess` everywhere; `validateRequest` per segment; every path resolves | ✅ |

### Environment note (same caveat as prior sprints)
`test:int` was run with `TEST_DATABASE_URL` explicitly exported to point at this session's scratchpad Postgres (`127.0.0.1:5544` — no Docker access in this sandbox). In a normal environment, `docker-compose.test.yml` provisions Postgres on port 5433, exactly matching `test/setup.ts`'s built-in fallback default — no override needed there. This is purely a this-session workaround, not a script change (the `test:int` npm script itself was **not** modified).

---

## Module complete

`identity` is fully implemented across all 5 sprints: contract prerequisites (Argon2id, `PageKey`/`PageGroup`, page seed), foundation (mapper, interface, factories), auth/session logic, admin-management logic, and now the HTTP layer + integration proof. See [`sprints-identity-01.md`](../sprints-identity-01.md)'s "Definition of done" section for the full checklist, and the other 4 reports in this directory for each sprint's detail.

Two things intentionally remain **out of scope**, both owner-deferred in Sprint 1 and unaffected by anything built since: login rate-limiting (needs shared-store infra) and ADMIN-scope `Page` registry rows (nothing gates on them).

---

## Commit

`git add .` then `git commit -m "api: identity sprint 5 — API and wiring"`.
