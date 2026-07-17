# Stage 02 · Sub-02 — Platform + Observability Module Sprint Plan (set 02)

Dependency-ordered decomposition of [`plan-platform.md`](./plan-platform.md) and
[`plan-observability.md`](./plan-observability.md) into sprints, following the phase-02 backbone
**foundation (mapper/interface) → logic (service) → API (controller/wiring)**. **No code in this
document.** Each sprint ends green (compiles + tests pass) and is committed before the next begins.

Two modules, **one file** (per the set-02 request). They are split into **Part A — platform** and
**Part B — observability**, each with its own foundation→logic→API arc. Sprints carry unambiguous ids
(`P1…P4`, `O1…O4`) for cross-reference; commit messages use per-module numbering.

## Sprint sequence & rationale

Platform is built **first**: it is the more foundational half (it seeds the geography + settings
tables and exports the injected `SequenceService`/`DeliveryFeeService` every document module needs) and
it is a **real emitter** (`settings.changed` / `deliveryFees.changed`) that observability audits — so
building it first lets observability's final sprint prove a genuine cross-module audit end-to-end. The
two modules are otherwise independent (observability's listener type-checks against the contract event
map regardless of which emitters exist yet — see `plan-observability.md` §0.1).

| Order | Sprint | Layer | Module | Why separate |
|---|---|---|---|---|
| 1 | **P1** — Prerequisites, deps & contract decision | *pre-foundation* | platform | Spreadsheet/upload deps, the 69-wilaya + settings seed, and the `AdminFeesResponseSchema` decision must exist before the module builds on them (plan §7, §8.1). |
| 2 | **P2** — Foundation: mapper, interfaces, factories | foundation | platform | Pure transforms + the 3 service contracts + test data; no logic. |
| 3 | **P3** — Logic: service + injected `SequenceService`/`DeliveryFeeService` | logic | platform | All business logic incl. row-locked sequences, fee precedence, and Excel import/export + the 2 emits. |
| 4 | **P4** — API: controller, routes, wiring, integration & conformance | API | platform | HTTP surface + mount + exported injected singletons + end-to-end/contract proof. |
| 5 | **O1** — Foundation: idempotency decision, mapper, interface, factories | foundation | observability | Settle the audit-idempotency mechanism (possible 1-column migration), then pure transforms + contract + data. |
| 6 | **O2** — Logic A: the sink service (writes, reads, stats) | logic | observability | Append-only writes, idempotent `recordAuditEvent`, the read/filter/paginate endpoints. |
| 7 | **O3** — Logic B: the listener & narration engine | logic | observability | The module's **core** — ~30 handlers + narration; split out (identity-precedent) to stay reviewable and green. Depends on O2's `recordAuditEvent`. |
| 8 | **O4** — API: controller, routes, wiring, integration & conformance | API | observability | Beacons (202) + reads + startup listener wiring + end-to-end incl. the cross-module platform→audit check. |

**Gate rule:** a sprint starts only when the previous one is green and committed. `test:int` first runs
in **P4** (platform routes wired + geography/settings seed + test DB up) and **O4**; every earlier
sprint runs `test:unit` (which bundles `test/unit` **+** `test/contract` conformance — "fast, no DB"
per test-rules.md §3).

**Commit style** (per project convention): `git add .` then a short `api: <module> sprint N — <topic>`
message (a contract/schema change may be a separate `contract:` / `chore(prisma):` commit); **no**
`Co-Authored-By`.

**Wiring target** (both modules): the existing `registerModules(apiRouter)` aggregator in
`Apps/api/src/modules/index.ts` (already mounted under `env.API_PREFIX` at `app.ts:25`). The
conformance spec `test/contract/routes.conformance.spec.ts` already imports `PLATFORM_ROUTES` and
`OBS_ROUTES` and enumerates them — each API sprint extends it with a live resolution block (mirroring
the identity block). Per the identity Sprint-5 precedent, **route-resolution** checks stay DB-free in
`test/contract/`; **response-shape** schema-parsing lives in the integration suite where authenticated
payloads already exist.

---

# Part A — Platform module

### Sprint P1: Prerequisites, dependencies & contract decision   — Status: ⬜ Pending

**Goals**
- Land every enabling change the module depends on, on a green base: the spreadsheet/upload
  dependencies, the geography + settings seed, and the `AdminFeesResponseSchema` contract decision.

**Tasks**
- [ ] Decision (owner): `ADMIN_FEES` GET response — **add `AdminFeesResponseSchema`** to the platform contract (recommended) vs. return the bare `UpsertFeesCommand.rows` shape. (plan §8.1)
- [ ] Decision (owner, confirm — no code): `SEQUENCE_DECREASE_FORBIDDEN` → `ConflictError`/409 (no new `ErrorCode`); `DeliveryFeeService.resolve` `mode` = local `'home'|'office'`; sequence counter **global-monotonic** (no per-year reset). (plan §8.2, §8.5, §8.6)
- [ ] Impl (contract, if approved): add `AdminFeesResponseSchema`/`AdminFeesDto` to `Apps/contract/src/modules/platform/platform.dtos.ts`; confirm the platform barrel re-exports it. (plan §8.1)
- [ ] Impl (deps): add `exceljs` + `multer` (+ `@types/multer`) to `Apps/api/package.json`; restrict upload MIME (`.xlsx`/`.csv`) + size via an **in-code constant** (env-template defines no upload knob — plan §7.2).
- [ ] Impl (data): `Apps/api/prisma/wilayas.registry.ts` — canonical **69 wilayas + their communes** (`wilayaCode`/`communeCode`/`frName`/`arName`), sourced as a dataset (mirrors `pages.registry.ts`; side-effect-free so factories can reuse it). (plan §7.1)
- [ ] Impl (seed): extend `Apps/api/prisma/seed.ts` — upsert wilayas/communes **by code** (idempotent); write the **4 default `Setting` rows** (`store`; `invoicing` with `prefixes` + `nextSequences = 1` for **every** `DocType`; `delivery` defaults; empty `storefront`). The `invoicing` row **must exist** for `SequenceService`'s `FOR UPDATE` lock. (plan §1.2, §3.5, §7.1)
- [ ] Chore: no migration needed — `Wilaya`/`Commune`/`DeliveryFee`/`Setting` are already in `20260717103221_init`. Run `prisma generate` if the contract types changed.

**Validation**
- [ ] Contract (if changed): `npm --prefix Apps/contract run validate` green (tsc `--noEmit` + cycles + eslint + conformance).
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (existing suite unaffected).
- [ ] `npm run db:seed` succeeds; 69 wilayas + their communes + the 4 `Setting` rows exist; re-running is idempotent.
- [ ] No magic strings — seed references `DocType` + the registry only.
- [ ] Committed on green (`api: platform sprint 1 — prerequisites`; any contract addition as a separate `contract:` commit).

---

### Sprint P2: Foundation — mapper, interfaces, factories   — Status: ⬜ Pending

**Goals**
- Pure Entity⇄DTO transforms, the three service contracts, and contract-shaped test data — no logic.

**Tasks**
- [ ] Impl: `src/modules/platform/platform.mapper.ts` — `toWilayaDto`, `toFeeDto(home, office, source)`, `toSettingsDto(mergedSections)`, `toPublicSettingsDto`, `toAdminFeesDto` (per the P1 decision). **`Decimal.toNumber()`** for money; never spreads; each `toDto` ends `XxxResponseSchema.parse(...)`. A private **defaults-template + merge** helper so a fresh DB still yields a valid `SettingsDto`. (plan §1, §5)
- [ ] Impl: `src/modules/platform/platform.interface.ts` — `IPlatformService`, `ISequenceService`, `IDeliveryFeeService` (plan §2.1); return contract DTOs (or the injected primitives).
- [ ] Test (factories): `test/data/wilaya.factory.ts` (`seedWilayas(subset)`, bilingual), `delivery-fee.factory.ts` (`upsertFeesPayload`, `seedFee`), `settings.factory.ts` (`updateSettingsPayload`, `seedSettings` → 4 default rows), `fees-import.fixture` (tiny in-memory workbook Buffer: one good + one bad row). (plan §4.1)
- [ ] Test: `test/unit/modules/platform/platform.mapper.spec.ts` — `Decimal → number`; `WilayaDto` bilingual + nested communes; `SettingsDto` merges defaults for absent keys and parses `SettingsResponseSchema`; `PublicSettingsDto` exposes only `storefront`; `FeeDto.source` reflects the level. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (mapper + conformance + prior).
- [ ] Mapper converts `Decimal → number` and returns DTOs (parses `*ResponseSchema`), never entities; interfaces return DTOs only.
- [ ] Committed on green (`api: platform sprint 2 — foundation`).

---

### Sprint P3: Logic — service + injected SequenceService & DeliveryFeeService   — Status: ⬜ Pending

**Goals**
- Implement all business logic — settings, fee resolution, admin fees, Excel import/export — plus the
  two injected services, with the two post-commit emits.

**Tasks**
- [ ] Impl: `src/modules/platform/platform.service.ts` — `class PlatformService implements IPlatformService`, `constructor(prisma)`. `listWilayas` (ordered, bilingual, with communes); `resolveFee` (**commune → wilaya → default** + `source`); `getAdminFees`/`upsertFees` (upsert by `(wilayaId, communeId)` in one `$transaction`; validate ids + `commune.wilayaId === wilayaId`; emit `deliveryFees.changed` **after commit**); `getSettings` (merge over defaults) / `updateSettings` (deep-merge per section in a `$transaction`; **decrease → 409** `ConflictError`; emit `settings.changed` **old → new** after commit) / `getPublicSettings`. (plan §3.1–3.4, §3.7)
- [ ] Impl import/export: `importFees(buffer)` — parse workbook (`exceljs`), map + **validate every row** (codes resolve; commune ∈ wilaya; fees ≥ 0), collect row errors → on **any** failure throw `BadRequestError` with `details` listing the offending rows, **zero writes**; else upsert all in one `$transaction` + emit. `exportFees(query)` — serialise current fees to `excel` (default) / `csv` / `json` → `{ filename, mime, body }`; **round-trips** with import. (plan §3.3)
- [ ] Impl: co-located `SequenceService implements ISequenceService` — `nextNumber(tx, docType)`: **row-lock** the `invoicing` `Setting` (`tx.$queryRaw … FOR UPDATE`), parse JSON, format `PREFIX-YYYY-NNNN` (`padStart(4,'0')`), write back `nextSequences[docType] + 1` on `tx`, return the string. And `DeliveryFeeService implements IDeliveryFeeService` — `resolve(wilayaId, communeId, mode)` sharing the private resolver with `resolveFee`. (plan §3.5–3.6)
- [ ] Test: `test/unit/modules/platform/platform.service.spec.ts` — mock Prisma (constructor DI) + spy `eventBus`. Resolution **precedence + `source`** for each of the 3 levels; `resolve(mode)` returns the right leg; sequence **format + increment + monotonic** (sequential → N, N+1) + the `FOR UPDATE` path; **decrease → 409**; `updateSettings` emits `settings.changed` old → new; `upsertFees` emits `deliveryFees.changed`; **import one bad row → `BadRequestError` listing it + zero upsert calls**; export round-trip shape. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green.
- [ ] Service throws `AppError` subclasses (`ConflictError` for decrease, `BadRequestError` for import); multi-row writes in `$transaction`; typed events emit **after commit**; returns DTOs via the mapper's `.parse()`.
- [ ] Committed on green (`api: platform sprint 3 — logic`).

---

### Sprint P4: API — controller, routes, wiring, integration & conformance   — Status: ⬜ Pending

**Goals**
- Expose the service over HTTP, mount it, export the injected singletons, and prove it end-to-end and
  contract-bound.

**Tasks**
- [ ] Impl: `src/modules/platform/platform.controller.ts` — thin; `try/catch → next(error)`; read `req.validated`; `sendSuccess` (`200` reads/updates); **export** sets `Content-Type` + `Content-Disposition` and streams the file for `excel`/`csv` (`json` → the row array); **import** reads `req.file.buffer` (Multer). (plan §5, §8.4)
- [ ] Impl: `src/modules/platform/platform.routes.ts` — composition root: `new PlatformService(prisma)`, `new SequenceService(prisma)`, `new DeliveryFeeService(prisma)`, `new PlatformController(service)`; one registration per `PLATFORM_ROUTES` constant + guard **before** `validateRequest` per plan §5.1; `multer().single('file')` on `FEES_IMPORT`. `export { router, sequenceService, deliveryFeeService }` (the injected singletons for downstream DI). (plan §5, §5.1, §6)
- [ ] Impl (wiring): add `apiRouter.use(platformRouter)` to `registerModules` in `src/modules/index.ts`. (plan §6)
- [ ] Test: `test/integration/platform.integration.spec.ts` (real test DB, real prefix, envelope asserted) — `GET /wilayas` bilingual + communes; `GET /delivery-fees` **precedence + `source`** across all 3 levels; admin fees GET→PUT round-trip (200); **import one bad row → 400 listing it + zero writes**, then a clean import succeeds; **export round-trips** (`import(export())` no-op); settings GET/PATCH (200) + `settings.changed` narrated; **sequence monotonic under concurrency** (parallel `nextNumber` in transactions → N distinct, contiguous) + **decrease → 409**; guards (non-admin → 403, missing token → 401; public routes reachable unauthenticated). Response-shape: parse payloads through `WilayaResponseSchema`/`FeeResponseSchema`/`SettingsResponseSchema`/`PublicSettingsResponseSchema` (+ `AdminFeesResponseSchema` if added). Requires the geography + settings seed and `NODE_ENV=test`. (plan §4.3)
- [ ] Test: extend `test/contract/routes.conformance.spec.ts` — a **DB-free** `platform route resolution` block: every `PLATFORM_ROUTES` path resolves on `app` (has a `success` key, not a bare 404), unauthenticated. (plan §4.4)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (mapper + service + conformance).
- [ ] `npm run test:int` green (platform + prior suites).
- [ ] Routes use `PLATFORM_ROUTES` constants only (no string literals); responses via `sendSuccess` (except the sanctioned binary export §8.4); each segment validated; every platform path resolves; `sequenceService`/`deliveryFeeService` exported.
- [ ] Committed on green (`api: platform sprint 4 — API and wiring`).

---

# Part B — Observability module

### Sprint O1: Foundation — idempotency decision, mapper, interface, factories   — Status: ⬜ Pending

**Goals**
- Settle the audit-idempotency mechanism, then land pure transforms + the service contract + test data
  — no logic.

**Tasks**
- [ ] Decision (owner): audit idempotency — **add `AuditLog.eventKey String? @unique`** (recommended; one migration) vs. a zero-schema pre-insert existence-check. (plan §8.1, §7.2)
- [ ] Decision (owner): `STAFF_SEARCH_BEACON` vs. `product.searched` — which write path is authoritative (avoid double-counting). (plan §8.2)
- [ ] Impl (schema, if `eventKey` chosen): add `eventKey String? @unique` to `AuditLog` in `schema.prisma`; `prisma migrate dev` (new migration) applied to dev **and** test; `prisma generate`. (plan §8.1)
- [ ] Impl: `src/modules/observability/observability.mapper.ts` — `toClientActivityDto`, `toStaffSearchDto`, `toAuditLogDto`, `toLogStatsDto`. `Date → ISO`; **omit** nested `product`/`matchedProduct`/`user` when the FK is null; `userName` from the join; each ends `XxxResponseSchema.parse(...)`. (plan §1, §5)
- [ ] Impl: `src/modules/observability/observability.interface.ts` — `IObservabilityService` (plan §2.1) + the module-local `AuditEntry` type (`{ actionType, entityType, entityId, description, userId?, ipAddress?, eventKey? }`).
- [ ] Test (factories): `test/data/client-activity.factory.ts` (`clientActivityPayload` valid **and** the `SEARCH` + `durationSeconds` invalid case; `seedClientActivity`), `staff-search.factory.ts` (`staffSearchPayload`; `seedStaffSearch`), `audit-log.factory.ts` (`seedAuditLog` + **one sample payload per event key** drawn from the contract event types). (plan §4.1)
- [ ] Test: `test/unit/modules/observability/observability.mapper.spec.ts` — `Date → ISO`; `product`/`matchedProduct`/`user` omitted when the FK is null; `userName` from the join; `actionType` passes through as an arbitrary string; each DTO parses its `*ResponseSchema`. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green (mapper + conformance + prior).
- [ ] (if migration) `prisma migrate` applied to dev + test; `eventKey` is nullable + unique; re-run idempotent.
- [ ] Mapper omits null nested objects, converts `Date → ISO`, returns DTOs; interface returns DTOs only.
- [ ] Committed on green (`api: observability sprint 1 — foundation`).

---

### Sprint O2: Logic A — the sink service (writes, reads, stats)   — Status: ⬜ Pending

**Goals**
- `ObservabilityService` — append-only writes, the idempotent `recordAuditEvent`, the read/filter/
  paginate endpoints, and `getLogStats` windows. **No listener yet.**

**Tasks**
- [ ] Impl: `src/modules/observability/observability.service.ts` — `class ObservabilityService implements IObservabilityService`, `constructor(prisma)`. `recordClientActivity(clientId, cmd)` + `recordStaffSearch(userId, cmd)` + `recordProductSearched(payload)` — append-only inserts. `recordAuditEvent(entry)` — **idempotent**: upsert by `eventKey` (or existence-check per the O1 decision); `eventKey` null ⇒ always append. **Emits nothing.** (plan §2.1, §3.1–3.2)
- [ ] Impl reads: `getClientActivity(clientId, q)` — filter `type?` + date range, newest first, join `product` → `ClientActivityDto[]` (array). `listStaffSearches(q)` — filter `userId?` + date + `q` (`query contains`, insensitive), join `user` + `matchedProduct` → `StaffSearchDto[]` (array). `listLogs(q)` — filter `actionType?`/`userId?`/date/`search` (`description contains`), join `user`, newest first, **`paginated(AuditLogResponseSchema)`** (20/page). `getLogStats()` — four `count()` windows (total / today / week / month). (plan §3.4)
- [ ] Test: `test/unit/modules/observability/observability.service.spec.ts` — mock Prisma (constructor DI). Beacon writes map fields correctly; **`recordAuditEvent` idempotent** (replayed key → one row / no-op) + null-key appends; `getLogStats` window math; `listLogs` pagination meta; filter builders (`actionType`/`userId`/date/`contains`); `getClientActivity`/`listStaffSearches` filters + null-nested omission. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green.
- [ ] Append-only (no update/delete paths); `select`/`include` scoped to what the mapper needs; `listLogs` via `paginated(...).parse()`; every returned value is mapper-shaped.
- [ ] Committed on green (`api: observability sprint 2 — sink service`).

---

### Sprint O3: Logic B — the listener & narration engine   — Status: ⬜ Pending

**Goals**
- The module's core: the audit/activity listener — every §0.1 handler, the narration map,
  `product.searched`, and the never-throw-into-the-emitter guarantee.

**Tasks**
- [ ] Impl: `src/modules/observability/observability.listener.ts` — injects `IObservabilityService`; `setup()` registers **one handler per §0.1 event key**. Each builds an `AuditEntry` (`actionType` = event name, `entityType`/`entityId` = source doc, `description` narrated with before/after, `userId?`/`ipAddress?` where present, a deterministic `eventKey`) and calls `recordAuditEvent`; wrapped in `try/catch` that **logs + swallows** (never throws into the emitter). (plan §3.1)
- [ ] Impl narration: the full §3.1 map — **verbatim-`description`** events (`settings.changed`, `deliveryFees.changed`, `inventory.adjusted`, `taxonomy.changed`, `clientCategory.changed`) vs. **structured before/after** events (`order`/`repair.statusChanged`, `posClient`/`supplier.creditChanged`, `supplierInvoice.confirmed`, `sale.confirmed`/`payment.*` credit). `eventKey` per §8.1 (`<event>:<entityId>[:<discriminator>]`; `auth.loggedIn` → null, always append). (plan §3.1, §8.1)
- [ ] Impl activity: the `product.searched` handler → `recordProductSearched` (one `StaffSearchLog`). (plan §3.2)
- [ ] Test: `test/unit/modules/observability/observability.listener.spec.ts` (the core) — real/spied `eventBus`. Narration **contains both before/after** (status `confirmed → packaged`; credit `1 500 → 3 200`); `description`-bearing payloads used **verbatim**; **replayed event → no-op** (one row); a **throwing `recordAuditEvent` is swallowed** (emitter unaffected); `product.searched` ⇒ **exactly one** `StaffSearchLog`; representative coverage across the emitter groups. (plan §4.2)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green.
- [ ] Every §0.1 event key has a handler that type-checks against the bus; handlers never throw into the emitter; narration is built **from the payload only** (no cross-table reads).
- [ ] Committed on green (`api: observability sprint 3 — listener and narration`).

---

### Sprint O4: API — controller, routes, wiring, integration & conformance   — Status: ⬜ Pending

**Goals**
- Expose beacons + reads over HTTP, wire the listener at startup, mount it, and prove it end-to-end —
  including a real cross-module platform→audit check now that platform emits.

**Tasks**
- [ ] Impl: `src/modules/observability/observability.controller.ts` — thin; `try/catch → next(error)`. **Beacons:** read `req.user` (`clientId`/`sub`) + `req.validated.body`; respond **`202`** immediately, then **fire-and-forget** the insert (failures logged, not surfaced). **Reads:** `req.validated.{params,query}` + `sendSuccess` (`200`). (plan §5)
- [ ] Impl: `src/modules/observability/observability.routes.ts` — composition root: `new ObservabilityService(prisma)` → `new ObservabilityController(service)` **and** `new ObservabilityListener(service); listener.setup()` (wired **once at startup**). One registration per `OBS_ROUTES` constant + guards + `validateRequest` per plan §5.1. `export { router }`. (plan §5, §5.1, §6)
- [ ] Impl (wiring): add `apiRouter.use(observabilityRouter)` to `registerModules` in `src/modules/index.ts`. (plan §6)
- [ ] Test: `test/integration/observability.integration.spec.ts` (real test DB, envelope asserted) — emit each event on the real bus → **exactly one** `AuditLog` with correct `actionType`/`entityType`/`entityId`/`description`; **re-emit → still one** (idempotent). Beacon: junk → **400 no write**; `SEARCH` + `durationSeconds` → **400**; valid → **202** + one row. `product.searched` ⇒ **exactly one** `StaffSearchLog`. Reads: filters + date ranges; `LOGS` **paginated 20/page**; `LOG_STATS` counts. Guards (client beacon rejects a staff token & vice-versa; admin reads → 403 for non-admin; missing token → 401). Response-shape: parse through `ClientActivity`/`StaffSearch`/`AuditLog`/`LogStatsResponseSchema` + `paginated(AuditLogResponseSchema)`. **Cross-module:** a real `PATCH /admin/settings` (platform) → **one** `settings.changed` audit row narrated old → new. (plan §4.3)
- [ ] Test: extend `test/contract/routes.conformance.spec.ts` — a **DB-free** `observability route resolution` block (every `OBS_ROUTES` path resolves, has `success`, not a bare 404). (plan §4.4)

**Validation**
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.
- [ ] `npm run test:unit` green.
- [ ] `npm run test:int` green (observability + platform + identity + prior).
- [ ] Routes use `OBS_ROUTES` constants only; beacons return **202 without blocking**; reads via `sendSuccess`; `listener.setup()` runs at startup; every observability path resolves.
- [ ] Committed on green (`api: observability sprint 4 — API and wiring`).

---

## Definition of done (both modules)

**Platform** — [`plan-platform.md`](./plan-platform.md) §9 satisfied:
- 5 module files (mapper, interface, service, controller, routes) — **no** listener; `platform.service.ts` provides `PlatformService`, `SequenceService`, `DeliveryFeeService`; router mounted via `registerModules`; `sequenceService`/`deliveryFeeService` exported for downstream DI.
- Every route uses a `PLATFORM_ROUTES` constant + segment validation; every DTO parses its `*ResponseSchema` (`Decimal → number` everywhere money leaves the service).
- Fee resolution honours **commune → wilaya → default** with the right `source`; import is **all-or-nothing** (bad row → 400, zero writes); export round-trips; `nextNumber` is transactional, **monotonic under concurrency**, gaps tolerated, never reused; lowering a next-sequence → 409; `settings.changed`/`deliveryFees.changed` emit **after commit** old → new.
- Geography + settings seed idempotent; `exceljs` + `multer` added.
- Unit + integration + conformance green; `tsc`/lint clean throughout.

**Observability** — [`plan-observability.md`](./plan-observability.md) §9 satisfied:
- All **6 files** (mapper, interface, service, **listener**, controller, routes); the module **emits nothing**; the **listener is wired at startup** and subscribes to every §0.1 event key.
- Every route uses an `OBS_ROUTES` constant + segment validation; every DTO parses its `*ResponseSchema` (nested `user`/`product` omitted when null; `Date → ISO`).
- **One audit row per event**, narration **contains both before/after values**, `description`-bearing events verbatim; **replayed event = no-op**; a failing sink write never throws into the emitter.
- Beacons: junk → 400 no write; `SEARCH` + `durationSeconds` → 400; valid → 202; `product.searched` ⇒ exactly one `StaffSearchLog`; reads filtered + `LOGS` paginated 20/page + `LOG_STATS` windows; `getClientActivity` ready as the clients Browsing-tab read.
- Unit (incl. the listener/narration spec) + integration + conformance green; `tsc`/lint clean throughout.

**Open decisions carried into execution** (resolve at the sprint that owns them, then record in the sprint report):
- Platform: `AdminFeesResponseSchema` add-vs-reuse (P1); `SEQUENCE_DECREASE_FORBIDDEN` mapping, `mode` literal, no per-year reset (P1). (plan §8)
- Observability: audit idempotency mechanism — `eventKey @unique` migration vs existence-check (O1); `STAFF_SEARCH_BEACON` vs `product.searched` authoritative path (O1); beacon rate-limiting **explicitly deferred** (consistent with identity); statistics read surface deferred to the statistics plan. (plan §7, §8)
