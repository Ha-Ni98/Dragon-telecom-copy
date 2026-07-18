# Platform — Sprint P4 Report: API (controller, routes, wiring, integration & conformance)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint P4 marked ✅.
**This closes out the platform module — all 4 sprints (P1–P4) are now done.**

---

## What was built

1. **`src/modules/platform/platform.controller.ts`** — 9 thin handlers, `try/catch → next(error)`,
   reading `req.validated`; `sendSuccess` (`200` for every JSON-returning route). `exportFees`
   deliberately bypasses `sendSuccess` — sets `Content-Type`/`Content-Disposition` and streams the
   raw `body` (plan §8.4). `importFees` reads `req.file.buffer` (Multer), 400s via
   `BadRequestError` if no file was attached.
2. **`src/modules/platform/platform.routes.ts`** — composition root: `new PlatformService(prisma)`
   → `new PlatformController(service)`; **exports** `sequenceService`/`deliveryFeeService`
   singletons (built once on the shared `prisma`) for downstream document-module DI. One
   registration per `PLATFORM_ROUTES` constant, guard before `validateRequest`, per plan §5.1.
   `multer({ limits: { fileSize: 5MB }, fileFilter: […] })` on `FEES_IMPORT` (in-code constant,
   no env knob — plan §7.2).
3. **Wiring:** `src/modules/index.ts` now also mounts `platformRouter` in `registerModules`.
4. **`test/integration/platform.integration.spec.ts`** — 14 tests, real test DB, real `/api`
   prefix, `ApiResponse` envelope asserted.
5. **`test/contract/routes.conformance.spec.ts`** extended with a DB-free platform block (see
   deviation below).

---

## Deviation: the DB-free conformance block covers only the admin-guarded routes

Identity's Sprint 5 precedent sent **every** `IDENTITY_ROUTES` path unauthenticated and asserted
`res.body` has a `success` key, staying DB-free because **every single identity route requires
`requireAuth`**, whose missing-token check throws before any Prisma call.

Platform has **three public routes** (`WILAYAS`, `FEE`, `SETTINGS_PUBLIC`) with **no** guard at
all. Sending them unauthenticated in `test/contract/` (bundled into `test:unit`, which
test-rules.md §3 promises is "fast, no DB") would actually **execute the real DB-backed handler**
— not stay DB-free. Since `test/setup.ts`'s `TEST_DATABASE_URL` fallback (port 5433) isn't even
reachable in this sandbox by default (see the environment note below), that would make `test:unit`
non-deterministically fail depending on whether a DB happens to be reachable at that moment —
exactly what this tier is supposed to avoid.

**Resolution:** the new `test/contract/` block covers only the **6 admin-guarded** routes
(`ADMIN_FEES` GET/PUT, `FEES_IMPORT`, `FEES_EXPORT`, `SETTINGS` GET/PATCH) — deliberately **not**
"every `PLATFORM_ROUTES` path," documented inline as an explicit scoping decision. The 3 public
routes' resolution **and** response-shape are instead covered in the integration suite (`GET
/wilayas`, `GET /delivery-fees`, `GET /settings/public` tests), where a real DB is already up and
expected. This mirrors the *spirit* of identity's Sprint 5 split (DB-free tier vs. DB-backed tier)
rather than its literal "every route" wording, since platform's guard topology genuinely differs.

---

## Environment note (not a code issue): `TEST_DATABASE_URL` port mismatch

`test/setup.ts`'s fallback default (`localhost:5433`) doesn't match this sandbox's actual Postgres
port (`5544`, per `.env`'s `TEST_DATABASE_URL`). Running `npm run test:int` without exporting
`TEST_DATABASE_URL` first fails with a connection error (confirmed: reproduced the exact failure,
then fixed it by exporting `TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5544/dragon_telecom_test`
before invoking the script — after which all 29 integration tests, identity + platform + health,
passed). This is environment configuration, not a bug in `test/setup.ts` itself (its hardcoded
fallback is a reasonable default for a docker-compose-style local setup that just doesn't match
this particular sandbox) — **not changed**, just noted here for whoever runs `test:int` next in
this environment.

---

## Other implementation notes

- **`GET /api/delivery-fees` integration test exercises all three resolution levels in one
  scenario** (no fee row → wilaya row → commune override), confirming precedence + `source`
  end-to-end through the real HTTP route, real DB, and real mapper — not just the service-level
  mocks from Sprint P3.
- **Export→import round-trip needed an explicit binary parser.** Superagent (supertest's HTTP
  client) only auto-buffers response bodies for a short list of registered mime types
  (`application/json`, text, `application/octet-stream`, `application/pdf`, `image/*`) — an
  `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) response isn't one
  of them, so `res.body` came back as `{}` and `.attach('file', res.body, …)` failed with `source.on
  is not a function`. Fixed by giving the export request an explicit binary parser
  (`.buffer().parse((res, cb) => { … Buffer.concat(chunks) … })`) so the raw bytes could be fed
  straight back into the import endpoint — a genuine `import(export())` round-trip through two real
  HTTP requests and the real DB, not a same-process shortcut.
- **`sequenceService`/`deliveryFeeService` are exercised directly** (not through an HTTP route,
  since platform exposes no route for them — they're injected-only per spec) — the monotonic-under-
  concurrency test calls `sequenceService.nextNumber` 5 times in parallel, each inside its own real
  `prisma.$transaction`, and asserts 5 distinct, contiguous numbers (`0001`…`0005`), proving the
  `FOR UPDATE` row lock actually serializes concurrent allocations against a real DB — the sharpest
  possible confirmation of Sprint P3's design, since a race would show up as duplicate or
  non-contiguous numbers.

---

## Validation

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — green, **137/137** tests, 15 files (136 prior + 1 new conformance test).
- `npm run test:int` — green, **29/29** tests, 3 files (14 identity + 14 platform + 1 health) —
  run with `TEST_DATABASE_URL` exported to the reachable port (see environment note).
- Routes use `PLATFORM_ROUTES` constants only (no string literals — confirmed by code and by the
  conformance test proving the constants actually resolve); responses go through `sendSuccess`
  except the one sanctioned binary export; every segment validated via `validateRequest`;
  `sequenceService`/`deliveryFeeService` exported from `platform.routes.ts`.

## Committed on green

`api: platform sprint 4 — API and wiring`.

---

## Platform module — definition of done (plan-platform.md §9) — ✅ satisfied

- ✅ 5 module files (mapper, interface, service, controller, routes) — no listener; `platform.service.ts`
  provides `PlatformService`, `SequenceService`, `DeliveryFeeService`; router mounted via `registerModules`.
- ✅ Every route uses a `PLATFORM_ROUTES` constant + segment validation; every DTO parses its
  `*ResponseSchema` (`Decimal → number` everywhere money leaves the service).
- ✅ Fee resolution honours commune → wilaya → default with the correct `source`; import is
  all-or-nothing; export round-trips (proven end-to-end via real HTTP + real DB, this sprint).
- ✅ `SequenceService.nextNumber` is transactional and monotonic under concurrency (proven against a
  real DB, this sprint), never reused; lowering a next-sequence → 409.
- ✅ `settings.changed`/`deliveryFees.changed` emit after commit with old → new narration.
- ✅ `sequenceService`/`deliveryFeeService` singletons exported for downstream DI.
- ✅ Unit (137) + integration (29) + conformance suites green; `tsc`/lint clean throughout all 4 sprints.
- Prerequisites: §7.1 geography seed **explicitly narrowed to a small real subset** (owner decision,
  Sprint P1 — not the full 58/69 set); §7.2 `exceljs`+`multer` added; §8.1 `AdminFeesResponseSchema`
  added (owner decision, Sprint P1); §8.2 `SEQUENCE_DECREASE_FORBIDDEN` mapped to `ConflictError`.
- **Bonus, not in the original plan:** found and fixed a real Postgres NULL-uniqueness gap in
  `@@unique([wilayaId, communeId])` (Sprint P3) — verified against the real dev DB both before and
  after the fix.
