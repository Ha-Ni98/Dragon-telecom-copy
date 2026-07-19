# Observability — Sprint O4 Report: API (controller, routes, wiring, integration & conformance)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint O4 marked ✅.
**This closes out the entire module set — both platform (4 sprints) and observability (4 sprints)
are now fully implemented, tested, and wired.**

---

## What was built

1. **`src/modules/observability/observability.controller.ts`** — 6 handlers. The two beacons
   (`recordClientActivity`, `recordStaffSearch`) are **synchronous** functions (not `async`): they
   read `req.user`, call `sendSuccess(res, null, 202)` **immediately**, then fire the service write
   without awaiting it, attaching a `.catch()` that logs failures — the write can never block or
   affect the response already sent. The four reads are thin `async` handlers, standard
   `try/catch → next(error)` + `sendSuccess`.
2. **`src/modules/observability/observability.routes.ts`** — composition root:
   `new ObservabilityService(prisma)` → `new ObservabilityController(service)`, **and**
   `new ObservabilityListener(service); listener.setup();` — wired once, at module load, since
   `registerModules` imports this file exactly once at app startup. One registration per
   `OBS_ROUTES` constant + guard + `validateRequest`, per plan §5.1.
3. **Wiring:** `src/modules/index.ts` now also mounts `observabilityRouter`.
4. **`test/integration/observability.integration.spec.ts`** — 16 tests, real test DB, real
   `/api` prefix, `ApiResponse` envelope asserted.
5. **`test/contract/routes.conformance.spec.ts`** extended with a DB-free observability block
   covering **all 6** `OBS_ROUTES` (unlike platform, every observability route is guarded, so the
   identity precedent applies directly with no scoping needed).

---

## A real finding: foreign keys the plan's mocked unit tests couldn't surface

`ClientActivityLog.clientId` and `StaffSearchLog.userId` are **real, DB-enforced foreign keys** to
`Client` and `User` respectively (`schema.prisma`). Sprint O1–O3's mocked-Prisma unit/listener specs
never touch a real database, so `SAMPLE_EVENTS`' fabricated UUIDs (e.g. `product.searched.userId`)
worked fine there — but this sprint's real-DB integration tests hit
`P2003: Foreign key constraint violated` the first time they ran:

- **`product.searched` → `StaffSearchLog.userId`:** fixed by seeding a real `User` (`seedUser`) and
  overriding `SAMPLE_EVENTS['product.searched'].userId` with that user's real id before emitting —
  `SAMPLE_EVENTS` itself is untouched (it's still correct for the mocked specs).
- **The client beacon → `ClientActivityLog.clientId`:** the **clients module doesn't exist yet**,
  so there's no service to provision a real `Client` row through. Added a local `seedClient()`
  helper in this integration spec that inserts a minimal valid `Client` row directly via Prisma
  (seeding a wilaya first, via platform's `seedWilayas()`, to satisfy `Client.wilayaId`/`communeId`'s
  own FKs) — bypassing the nonexistent service layer, which is fine here since the goal is
  satisfying a schema constraint, not testing clients-module behavior. `mintClientToken()` now
  seeds a real client and mints the JWT with that client's real id, instead of a bare fabricated
  UUID.

This is exactly the kind of gap real-DB integration testing exists to catch — the fire-and-forget
beacon contract itself was never wrong (both failing tests still got their `202`/`400` responses
correctly; only the *downstream write* silently failed against the FK, which is precisely what
"failures are logged, not surfaced" means in production too). No product code changed — only the
test fixtures needed a real, valid row to reference.

---

## Validation

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run test:unit` — green, **165/165** tests, 18 files (164 prior + 1 new conformance test).
- `npm run test:int` — green, **45/45** tests, 4 files (16 observability + 14 identity + 14
  platform + 1 health). Required `TEST_DATABASE_URL` exported to the sandbox's actual port
  (5544), per the environment note already recorded in platform's Sprint P4 report.
- Routes use `OBS_ROUTES` constants only; beacons return **202 without blocking** (proven: the
  "accepts a valid activity" test asserts `202` immediately, then separately waits and checks the
  DB row — two distinct assertions, not one); reads via `sendSuccess`; `listener.setup()` runs at
  module load (startup); every observability path resolves (conformance, DB-free) and works
  end-to-end (integration, real DB).
- **Cross-module proof, as planned:** a real `PATCH /api/admin/settings` (platform, now a real
  emitter) produces exactly one real `settings.changed` `AuditLog` row, narrated with both the old
  (`500`) and new (`777`) values — the full identity/platform → observability pipeline working
  together for the first time.

## Committed on green

`api: observability sprint 4 — API and wiring`.

---

## Observability module — definition of done (plan-observability.md §9) — ✅ satisfied

- ✅ All **6 files** present (mapper, interface, service, **listener**, controller, routes); the
  module **emits nothing**; the listener is wired at startup and subscribes to all 34 event keys.
- ✅ Every route uses an `OBS_ROUTES` constant + segment validation; every DTO parses its
  `*ResponseSchema` (nested `user`/`product`/`matchedProduct` omitted when null; `Date → ISO`).
- ✅ One audit row per event, narration contains both before/after values where structured, verbatim
  where the payload supplies a `description`; replayed event = no-op (zero-schema dedupe, proven
  through the real event-driven path); a failing sink write never throws into the emitter (proven
  both via mocked rejection and by design — see Sprint O3's `safeRun` double-guard).
- ✅ Beacons: junk → 400 no write; `SEARCH` + `durationSeconds` → 400; valid → 202 without blocking;
  `product.searched` ⇒ exactly one `StaffSearchLog`, never an `AuditLog` row.
- ✅ Read endpoints: filters + date ranges on all three; `LOGS` paginated 20/page; `LOG_STATS`
  total/today/week/month; `getClientActivity` ready as the clients module's future Browsing-tab read.
- ✅ Unit (incl. the listener/narration spec) + integration + conformance suites green throughout
  all 4 sprints; `tsc`/lint clean throughout.
- Open decisions resolved: §8.1 idempotency → **zero-schema existence check** (not the `eventKey`
  migration); §8.2 `STAFF_SEARCH_BEACON` vs `product.searched` → **both kept**, flagged for
  reconciliation when catalog ships; §7.1 rate-limiting → **explicitly deferred** (consistent with
  identity); §8.6 statistics read surface → **deferred to the statistics module's own plan**.
