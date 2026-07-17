# Stage 02 · Sub-02 — Module Implementation Plan: `platform`

> **Scope of this document:** the plan only (no code). It maps the `platform` module's
> contract + Prisma schema onto the strict file architecture, defines every method, the
> business logic, the test strategy, and the wiring. Output per the user's constraint:
> `plan-platform.md` (the phase file suffixes `-[setnumber]`; platform + observability are
> planned together as one **set**, one plan doc each — see `plan-observability.md`).

`platform` merges **settings (+ `SequenceService`) + delivery (wilayas/communes bilingual, fees,
resolution, Excel)** (spec `Docs/Stage-00-Conception/Module-Contracts/platform.md`). It is a
**read-heavy config module** plus **two injected services** (`SequenceService`,
`DeliveryFeeService`) that every document module consumes. It follows `identity` (the first
implemented module) and mounts into the same `registerModules(apiRouter)` aggregator.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

I read the real contract package `@dragon-telecom/contract` (`Apps/contract/src/modules/platform/…`)
and the migrated `Apps/api/prisma/schema.prisma`. Every route/schema/DTO/command/query/event this
module serves **already exists** (table below). Confirmed present:

| Kind | Already in `@dragon-telecom/contract` |
|---|---|
| Routes | `PLATFORM_ROUTES.{WILAYAS, FEE, ADMIN_FEES, FEES_IMPORT, FEES_EXPORT, SETTINGS, SETTINGS_PUBLIC}` |
| Enums | `DocType` (8 values), `FeeSource` (`commune`\|`wilaya`\|`default`) |
| Commands | `UpsertFeesSchema/Command`, `UpdateSettingsSchema/Command` (every section + leaf optional) |
| Queries | `FeeQuerySchema/Query` (`wilayaId` req, `communeId?`), `FeesExportQuerySchema/Query` (`format?: excel\|csv\|json`) |
| DTOs + response schemas | `WilayaResponseSchema/Dto`, `FeeResponseSchema/Dto`, `SettingsResponseSchema/Dto`, `PublicSettingsResponseSchema/Dto` |
| Events | `PlatformEvents = { 'settings.changed' { description }, 'deliveryFees.changed' { description } }` — already in the `AppEvents` map keying the bus |
| Common | `ApiResponse<T>`, `ErrorCode`, `JWTPayload`, `paginated()`/`PaginationMeta` (not needed here — no paginated list) |

Prisma models confirmed present and reused verbatim: `Wilaya`, `Commune`, `DeliveryFee`
(`Decimal(12,2)` money, `@@unique([wilayaId, communeId])`, `communeId = null` ⇒ wilaya-level row),
`Setting` (`key` PK, `value` = JSON string, `updatedAt`). Foundations reused (never redefined):
`prisma` (`@common/db/prisma`), `sendSuccess` (`@common/http/response`), `eventBus`
(`@common/events/event-bus`), `requireAuth`/`validateRequest` (`@common/middlewares/*`), error
classes (`@common/errors`: `AppError/ConflictError/NotFoundError/BadRequestError`). Mirror the
identity precedents: `isKnownRequestError(err, 'P2002'|'P2025')`, **emit-after-commit**, and
`Decimal.toNumber()` for money in the mapper.

**Gaps (no contract element exists) — resolved toward the rules and flagged in §8:** (a) `ADMIN_FEES`
GET has **no response schema** ("wilaya rows + commune overrides" is prose only); (b)
`SEQUENCE_DECREASE_FORBIDDEN` is **not** an `ErrorCode`; (c) the injected `DeliveryFeeService.resolve`
`mode` argument has **no contract enum**; (d) Excel import/export needs a **spreadsheet lib + Multer**
(neither is a dependency yet); (e) the `Setting`/`Wilaya`/`Commune` tables need a **seed** (69 wilayas +
communes bilingual; default settings). None is an authority-vs-authority conflict, so per the standing
rule I did not stop to ask.

---

## 1. Step 1 — Contract & Schema analysis

### 1.1 Prisma model ⇄ contract DTO mapping (the mapper's job — pure/static, never spreads the entity)

| Prisma source | → contract DTO | Include (returned) | Exclude / transform |
|---|---|---|---|
| `Wilaya` + `communes: Commune[]` | `WilayaDto` | `id, wilayaCode, frName, arName, communes:[{id, communeCode, frName, arName}]` | Both languages always carried (front picks). Communes ordered by `communeCode`. |
| best `DeliveryFee` row (or default) | `FeeDto` | `deliveryHome, deliveryOffice, source` | **`Decimal → number`** via `.toNumber()`. `source` = `FeeSource` per which level resolved (§3.2). |
| 4 `Setting` rows (JSON) merged | `SettingsDto` | `store, invoicing, delivery, storefront` | JSON.parse each section; merge over a **default template** so a fresh DB still parses. `nextSequences`/`prefixes` cover **every** `DocType`. |
| `storefront` setting only | `PublicSettingsDto` | `storefront.featuredProductIds` | Public route: trim to the one public-safe section (store/invoicing/delivery are internal). |

`ADMIN_FEES` GET has no contract DTO → see §8 item 1 (recommended: add `AdminFeesResponseSchema`;
fallback: return the `UpsertFeesCommand.rows` shape).

### 1.2 `Setting` storage model ("Settings JSON per key", spec BL 3)

Four `Setting` rows, keyed by the `SettingsDto` section names — the Setting.key values mirror the DTO
keys, not invented magic strings:

| `Setting.key` | JSON `value` shape |
|---|---|
| `store` | `{ name, address?, phone?, logoUrl? }` |
| `invoicing` | `{ prefixes: Record<DocType,string>, nextSequences: Record<DocType,number>, footerNote? }` |
| `delivery` | `{ defaultHome: number, defaultOffice: number }` |
| `storefront` | `{ featuredProductIds: uuid[] }` |

`getSettings` reads all four, `JSON.parse`s each, merges over an in-code **defaults template**
(covering every `DocType` prefix + `nextSequences` seed of 1) and returns a `SettingsDto`. The
`invoicing` row is the single home of the document-number counters that `SequenceService` increments
(§3.5) — there is **no dedicated `Sequence` table** in the schema.

### 1.3 Enum conversions / money

- `DocType` (Prisma) ⇄ `DocType` (contract) — identical strings; the record keys travel as-is.
- `FeeSource` is a **contract-only** enum (no Prisma column): the mapper sets it from which resolution
  level produced the row (`commune` / `wilaya` / `default`), never read from the DB.
- Money: `DeliveryFee.deliveryHome/deliveryOffice` are `Prisma.Decimal(12,2)` → `.toNumber()` in the
  mapper (DZD, 2-dp, cash only). Inputs (`UpsertFeesCommand`) arrive as `number`; Prisma coerces to
  Decimal on write.

---

## 2. Step 2 — Component definition

### 2.1 Interfaces (`platform.interface.ts`) — three cohesive surfaces

One route-serving service plus the **two named injected services** the spec's connection rule requires.
Downstream document modules depend on the small interfaces (`ISequenceService`, `IDeliveryFeeService`),
not the whole `IPlatformService` (dependency inversion). Methods return contract DTOs (or the injected
primitives the spec dictates).

**`IPlatformService`** (serves the routes):

| Method | Serves route | Signature (design, not code) |
|---|---|---|
| `listWilayas` | GET `WILAYAS` | `listWilayas(): Promise<WilayaDto[]>` — 69, bilingual, with communes |
| `resolveFee` | GET `FEE` | `resolveFee(q: FeeQuery): Promise<FeeDto>` — both modes + `source` |
| `getAdminFees` | GET `ADMIN_FEES` | `getAdminFees(): Promise<AdminFeesDto>` (§8.1) |
| `upsertFees` | PUT `ADMIN_FEES` | `upsertFees(cmd: UpsertFeesCommand): Promise<AdminFeesDto>` |
| `importFees` | POST `FEES_IMPORT` | `importFees(file: Buffer): Promise<{ imported: number }>` — all-or-nothing |
| `exportFees` | GET `FEES_EXPORT` | `exportFees(q: FeesExportQuery): Promise<{ filename; mime; body: Buffer\|string }>` |
| `getSettings` | GET `SETTINGS` | `getSettings(): Promise<SettingsDto>` |
| `updateSettings` | PATCH `SETTINGS` | `updateSettings(cmd: UpdateSettingsCommand): Promise<SettingsDto>` |
| `getPublicSettings` | GET `SETTINGS_PUBLIC` | `getPublicSettings(): Promise<PublicSettingsDto>` |

**`ISequenceService`** (injected into every document module — orders, sales, purchasing, repairs, billing):

| Method | Signature |
|---|---|
| `nextNumber` | `nextNumber(tx: Prisma.TransactionClient, docType: DocType): Promise<string>` → `PREFIX-YYYY-NNNN` |

**`IDeliveryFeeService`** (injected into orders):

| Method | Signature |
|---|---|
| `resolve` | `resolve(wilayaId: string, communeId: string \| null, mode: 'home' \| 'office'): Promise<number>` |

### 2.2 Events

- **Emits (out), after commit:** `settings.changed { description }` (from `updateSettings`);
  `deliveryFees.changed { description }` (from `upsertFees` and `importFees`). `description` narrates
  **old → new** (the audit module renders it verbatim — see `plan-observability.md` §3).
- **Events (in): none** → **no `platform.listener.ts`** (5 files, not 6).

---

## 3. Business logic (the HOW behind the methods) — spec §Business Logic

1. **Wilayas (`listWilayas`).** Return all `Wilaya` rows with their `Commune[]`, bilingual
   (`frName`/`arName` both present), ordered by `wilayaCode` then `communeCode`. Pure read; public.
   Requires the geography seed (§7.1). No pagination (spec: "69" — a fixed, bounded set; no list query
   in the contract).

2. **Public fee resolution (`resolveFee`, route `FEE`).** Given `wilayaId` (+ optional `communeId`),
   resolve **both** `deliveryHome` and `deliveryOffice` from one row and report `source`:
   **commune override → wilaya row (`communeId = null`) → settings default**. Precedence (spec BL 2 /
   Test Scenarios): a `DeliveryFee` with the exact `communeId` wins (`source: 'commune'`); else the
   `communeId = null` row for that wilaya (`source: 'wilaya'`); else `settings.delivery.defaultHome/
   defaultOffice` (`source: 'default'`). Public route.

3. **Admin fees (`getAdminFees` / `upsertFees`).** GET returns the editable grid — wilaya-level rows
   plus commune overrides (shape per §8.1). PUT (`UpsertFeesCommand`) upserts every submitted row by
   `(wilayaId, communeId)` (the `@@unique`) in **one transaction** — `communeId = null` addresses the
   wilaya row; a `uuid` addresses a commune override. Validate every `wilayaId`/`communeId` exists and
   `commune.wilayaId === wilayaId`; fees `≥ 0` (already schema-enforced). Emit `deliveryFees.changed`
   after commit with a summary description. Admin.

4. **Import / export (`importFees` / `exportFees`).**
   - **Import** (`FEES_IMPORT`, multipart via Multer): parse the workbook, map each row to
     `{ wilayaCode, communeCode?, deliveryHome, deliveryOffice }`, **validate every row** (codes resolve
     to real wilaya/commune; commune belongs to the wilaya; fees numeric `≥ 0`); collect **row-level
     errors**. **On any failure → 400** (`VALIDATION_ERROR`) whose `details` lists the offending rows;
     **write nothing** (all-or-nothing — validation completes before the single upsert transaction). On
     success, upsert all rows in one transaction and emit `deliveryFees.changed`.
   - **Export** (`FEES_EXPORT?format=`): serialise current fees to `excel` (default) / `csv` / `json`.
     Round-trips with import (same columns). Excel/CSV are **binary/text file downloads**
     (`Content-Disposition`, **not** the `ApiResponse` envelope — deviation §8.4); `json` returns the
     same row array. Admin.

5. **`SequenceService.nextNumber(tx, docType)` — transactional, monotonic, never reused.** Inside the
   **caller's** `tx`: **row-lock** the `invoicing` `Setting` row
   (`tx.$queryRaw`…`SELECT value … WHERE key = 'invoicing' FOR UPDATE`), parse JSON, read
   `n = nextSequences[docType]` (default 1) and `prefix = prefixes[docType]`, format
   `PREFIX-YYYY-NNNN` (`padStart(4,'0')`, `YYYY = current year`), write back
   `nextSequences[docType] = n + 1` on the same `tx`, return the string. The `FOR UPDATE` serialises
   concurrent allocations (monotonic under concurrency). A caller rollback un-allocates (no committed
   document ever used that number ⇒ "never reused"; gaps from later cancellations are tolerated). The
   counter is **global-monotonic**, not per-year-reset — the stored shape is a single number per
   `DocType`; `YYYY` is cosmetic (§8.6). Injected into every document module's composition root.

6. **`DeliveryFeeService.resolve(wilayaId, communeId, mode)`** — the same precedence as §3.2 but returns
   the single `number` for `mode` (`'home'`/`'office'`). PICKUP callers never call it (fee 0 by rule).
   Shares one private resolver with `resolveFee`.

7. **Settings (`getSettings` / `updateSettings` / `getPublicSettings`).** GET assembles the four rows
   over defaults. PATCH (`UpdateSettingsCommand`, every leaf optional) deep-merges each present section
   into its row (JSON), in a transaction. **Sequence guard:** if `invoicing.nextSequences[docType]` is
   **lowered** below the stored value → **409** (spec's `SEQUENCE_DECREASE_FORBIDDEN`, mapped to
   `ConflictError` — §8.2). Read the old values first, apply, then emit `settings.changed` after commit
   with an **old → new** description ("settings.changed narrated old → new" test). `getPublicSettings`
   returns only `storefront.featuredProductIds`. Admin (public for `SETTINGS_PUBLIC`).

---

## 4. Step 3 — Test strategy (`test-rules.md`)

### 4.1 Factories (`test/data/`, contract-shaped)

- `wilaya.factory.ts` — `seedWilayas(subset)` inserts a small canonical set (e.g. 2 wilayas × 2 communes,
  bilingual) drawn from the geography registry (§7.1) so integration tests don't need all 69.
- `delivery-fee.factory.ts` — `upsertFeesPayload(overrides): UpsertFeesCommand`; `seedFee({wilayaId,
  communeId,home,office})`.
- `settings.factory.ts` — `updateSettingsPayload(overrides): UpdateSettingsCommand`; `seedSettings()`
  writes the four default rows (all `DocType` prefixes + `nextSequences`).
- `fees-import.fixture` — a tiny in-memory workbook Buffer (one good sheet + one with a bad row) for the
  import tests.

### 4.2 Unit (`test/unit/modules/platform/`, mock Prisma + spy `eventBus`)

- `platform.mapper.spec.ts`: `Decimal → number`; `WilayaDto` carries both languages + nested communes;
  `SettingsDto` merges defaults for absent keys and parses `SettingsResponseSchema`; `PublicSettingsDto`
  exposes only `storefront`; `FeeDto.source` reflects the level.
- `platform.service.spec.ts`: **resolution precedence** (commune → wilaya → default) and the `source`
  field for each; `resolve(mode)` returns the right leg; **sequence** formatting + increment +
  **monotonic** allocation (two sequential calls → N, N+1) + row-lock path; **decrease → 409**;
  `updateSettings` emits `settings.changed` with old → new; `upsertFees` emits `deliveryFees.changed`;
  **import**: one bad row → thrown `BadRequestError` listing it, **zero** `upsert` calls.

### 4.3 Integration (`test/integration/platform.integration.spec.ts`, real test DB, envelope asserted)

`GET /wilayas` → bilingual + communes; `GET /delivery-fees` precedence + `source` across the three
levels; admin fees GET→PUT round-trip (200); **import one bad row → 400 listing it, zero writes**, then
a clean import succeeds; **export round-trips** (import(export()) is a no-op); settings GET/PATCH (200)
+ `settings.changed` narrated; **sequence monotonic under concurrency** (fire N `nextNumber` in parallel
inside transactions → N distinct, contiguous numbers) + decrease → 409; guard checks (non-admin → 403,
missing token → 401; public routes reachable unauthenticated). Requires the geography + settings seed
and `NODE_ENV=test` DB.

### 4.4 Contract conformance (`test/contract/routes.conformance.spec.ts`)

Extend the existing spec (it already imports `PLATFORM_ROUTES` and enumerates it) with a
`platform route resolution` block asserting every `PLATFORM_ROUTES` path resolves on `app` (has a
`success` key, not a bare 404) — mirroring the identity block. Response-shape: parse representative
`res.body.data` through `WilayaResponseSchema`, `FeeResponseSchema`, `SettingsResponseSchema`,
`PublicSettingsResponseSchema` (and `AdminFeesResponseSchema` if §8.1 adds it).

---

## 5. Step 4 — File checklist (create only what the module needs)

Inside `Apps/api/src/modules/platform/`, in order:

1. **`platform.mapper.ts`** — pure/static: `toWilayaDto`, `toFeeDto(home, office, source)`,
   `toSettingsDto(mergedSections)`, `toPublicSettingsDto`, `toAdminFeesDto` (§8.1). `Decimal.toNumber()`;
   each `toDto` ends `XxxResponseSchema.parse(dto)`.
2. **`platform.interface.ts`** — `IPlatformService`, `ISequenceService`, `IDeliveryFeeService` (§2.1).
3. **`platform.service.ts`** — `PlatformService implements IPlatformService`, plus **`SequenceService`**
   and **`DeliveryFeeService`** co-located (each `implements` its interface). Injects `PrismaClient`;
   `SequenceService` uses `tx.$queryRaw … FOR UPDATE`; throws `AppError` subclasses; emits `PlatformEvents`
   after commit; `isKnownRequestError` for Prisma codes. Uses a spreadsheet lib for import/export (§7.2).
   *(Co-location keeps the strict single service file; §8.7 notes the split-into-files alternative.)*
4. *(no `platform.listener.ts` — platform listens to nothing.)*
5. **`platform.controller.ts`** — thin; `try/catch → next(error)`; reads `req.validated`; `sendSuccess`
   (`200` reads/updates); export sets headers + streams the file for excel/csv; import reads
   `req.file.buffer` (Multer).
6. **`platform.routes.ts`** — composition root: `new PlatformService(prisma)`, **`new SequenceService(
   prisma)`, `new DeliveryFeeService(prisma)`** (the latter two **exported** for downstream DI — §6),
   `new PlatformController(service)`, then one registration per route using the `PLATFORM_ROUTES`
   constant + `validateRequest` per segment + Multer on the import route. `export { router }` (+ the two
   injected singletons).

### 5.1 Route registration map (guards + validation)

| Route const | Method | Guard | `validateRequest` / middleware |
|---|---|---|---|
| `WILAYAS` | GET | public | — |
| `FEE` | GET | public | `{ query: FeeQuerySchema }` |
| `SETTINGS_PUBLIC` | GET | public | — |
| `ADMIN_FEES` | GET | `requireAuth({ types:[ADMIN], checkDB:true })` | — |
| `ADMIN_FEES` | PUT | admin | `{ body: UpsertFeesSchema }` |
| `FEES_IMPORT` | POST | admin | `multer().single('file')` (MIME + size limits — §7.2) |
| `FEES_EXPORT` | GET | admin | `{ query: FeesExportQuerySchema }` |
| `SETTINGS` | GET | admin | — |
| `SETTINGS` | PATCH | admin | `{ body: UpdateSettingsSchema }` |

`requireAuth` covers type-level access; platform has no page-key-gated (`staff(PAGE_KEY)`) routes.

---

## 6. Wiring (the real extension point)

Add both routers to the existing aggregator `Apps/api/src/modules/index.ts`
(`registerModules(apiRouter)` → `apiRouter.use(platformRouter)`), which already mounts under
`env.API_PREFIX` at `app.ts:25`. `PLATFORM_ROUTES` paths begin at `/wilayas`, `/delivery-fees`,
`/admin/…`, `/settings/public`, composing to `/api/wilayas`, `/api/admin/settings`, … exactly per spec.

**Injected-service export.** `platform.routes.ts` also exports the `sequenceService` and
`deliveryFeeService` singletons (built at the composition root on the shared `prisma`). Downstream
document modules import these into their own composition roots and pass them to their services (the
spec's connection rule). The exact import path is coordinated with each consumer's plan (mirrors
identity §8 item 9, which deferred the injected-`UserService` wiring to the clients plan). **Flagged.**

---

## 7. Prerequisites / dependencies outside the 6 files (flagged)

1. **Geography + settings seed (data prerequisite, mirrors `pages.registry.ts` + `prisma/seed.ts`).**
   - `prisma/wilayas.registry.ts` — the canonical **69 wilayas + their communes** (`wilayaCode`,
     `communeCode`, `frName`, `arName`). This is real Algerian geography data (58 legacy wilayas / 69
     post-2019 provinces — the spec says **69**); it must be sourced as a dataset, not invented per-row.
     Extend `prisma/seed.ts` to upsert wilayas/communes by code (idempotent) and to write the **four
     default `Setting` rows** (store name, `prefixes`/`nextSequences` for **every** `DocType`,
     `defaultHome`/`defaultOffice`, empty `featuredProductIds`). Without the settings seed, `getSettings`
     still returns valid defaults (mapper merge), but `SequenceService` needs the `invoicing` row to
     **exist** for its `FOR UPDATE` lock — so the seed must create it. Tests reuse a small subset via
     the factories (§4.1).
2. **Excel/CSV + upload dependencies (not in `package.json`).** Add a spreadsheet lib (`exceljs`
   recommended — streaming, typed; or `xlsx`) and **`multer`** (+ `@types/multer`) for `FEES_IMPORT`.
   Restrict MIME (`.xlsx`/`.csv`) + size. The env-template defines **no** upload knobs
   (`env-template.md` lists only `AWS_*` for uploads generically) — so either add `UPLOAD_MAX_BYTES`
   to `env.ts` **and** the template (env-template precedence), or use an in-code constant. **Recommend
   an in-code constant** (single small file upload, no infra needed).
3. **`SEQUENCE_DECREASE_FORBIDDEN` mapping** — no such `ErrorCode`; mapped to `ConflictError`
   (`RESOURCE_CONFLICT`, 409) with the symbolic name in the message (§8.2). No contract change.
4. **`AdminFeesResponseSchema` decision** (§8.1) — the one place a small contract addition is worth
   considering for conformance + the admin editor's display needs.

---

## 8. Deviations & open decisions (resolved toward the rules; noted per standing rules)

| # | Item | Resolution |
|---|---|---|
| 1 | **`ADMIN_FEES` GET has no response DTO** ("wilaya rows + commune overrides" is prose). | **Recommend** adding `AdminFeesResponseSchema` to the platform contract (owner-approved, like identity's `PageKey`): `{ wilayas: [{ wilayaId, wilayaCode, frName, arName, deliveryHome, deliveryOffice, communes: [{ communeId, communeCode, frName, arName, deliveryHome?, deliveryOffice? }] }] }` — carries names for the editor and gives conformance a schema. **Fallback (no contract change):** return the bare `UpsertFeesCommand.rows` shape for a pure round-trip. **Flagged for owner.** |
| 2 | **`SEQUENCE_DECREASE_FORBIDDEN` is not an `ErrorCode`.** | Map to `ConflictError` (`RESOURCE_CONFLICT`, 409), symbolic name in the message — mirrors identity's `LAST_ADMIN_PROTECTED` handling (identity §8.4). |
| 3 | **Rules say "always paginate lists"; platform defines no list query.** | `WILAYAS` (fixed 69) and `ADMIN_FEES` return full sets; no `page/limit` schema exists to paginate against. Deviation noted (same shape as identity §8.3). |
| 4 | **Excel/CSV export bypasses the `ApiResponse` envelope.** | Binary/text file downloads set `Content-Type` + `Content-Disposition`; `format=json` returns the row array. Import consumes `multipart/form-data` (Multer), not a JSON body. Standard exceptions to the envelope rule, flagged. |
| 5 | **`DeliveryFeeService.resolve` `mode` has no contract enum.** | Local literal `'home' \| 'office'`; the orders module maps its `OrderType` (`DELIVERY_HOME`/`DELIVERY_OFFICE`) to it (PICKUP never calls). Exact type finalized with the orders plan. Flagged. |
| 6 | **`PREFIX-YYYY-NNNN` — per-year reset?** | Counter is **global-monotonic** (one stored number per `DocType`); `YYYY` reflects issuance year, not a reset boundary — the settings shape can't express a per-year counter without a shape change. Flagged; revisit if the owner wants yearly reset. |
| 7 | **`SequenceService`/`DeliveryFeeService` as classes vs files.** | **Co-located in `platform.service.ts`** (each `implements` its interface) to honor the strict single-service-file rule while providing the spec's named injected services. Splitting into `sequence.service.ts`/`delivery-fee.service.ts` is a reasonable alternative if the owner prefers explicit files. Flagged. |
| 8 | **Injected-service cross-module wiring.** | Platform exports `sequenceService`/`deliveryFeeService` singletons; consumers import them into their composition roots. Path coordinated per-consumer plan (§6). Flagged. |

No item rises to a genuine authority-vs-authority conflict, so per the standing rules I did not stop to
ask — each is resolved toward the rules/contract and flagged for the owner's review.

---

## 9. Definition of done

- `Apps/api/src/modules/platform/` has the 5 files (mapper, interface, service, controller, routes); no
  listener. `platform.service.ts` provides `PlatformService`, `SequenceService`, `DeliveryFeeService`.
- Both routers mounted via `registerModules`; every route uses a `PLATFORM_ROUTES` constant (no string
  literals) and validates each segment against the contract schema.
- Every service method returns a DTO that parses against its `*ResponseSchema` (mapper-enforced);
  `Decimal → number` everywhere money leaves the service.
- Fee resolution honours **commune → wilaya → default** with the correct `source`; import is
  **all-or-nothing** (bad row → 400 listing it, zero writes); export round-trips.
- `SequenceService.nextNumber` is transactional, **monotonic under concurrency** (row-locked), gaps
  tolerated, never reused; lowering a next-sequence → 409.
- `settings.changed` / `deliveryFees.changed` emit **after commit** with old → new narration.
- `sequenceService` / `deliveryFeeService` singletons are exported for downstream DI.
- Unit + integration + conformance suites (§4) pass.
- Prerequisites resolved or explicitly decided: §7.1 (geography + settings seed), §7.2 (exceljs +
  multer), §8.1 (`AdminFeesResponseSchema` decision), §8.2 (`SEQUENCE_DECREASE_FORBIDDEN` mapping).
