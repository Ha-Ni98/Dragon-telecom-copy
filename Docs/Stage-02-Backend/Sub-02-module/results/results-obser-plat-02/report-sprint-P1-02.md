# Platform — Sprint P1 Report: Prerequisites, dependencies & contract decision

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint P1 marked ✅.

---

## Owner decisions taken (asked before implementing — both hard-to-reverse contract/data choices)

1. **`ADMIN_FEES` GET response: add `AdminFeesResponseSchema`/`AdminFeesDto`.** Plan §8.1 offered a
   fallback (reuse the bare `UpsertFeesCommand.rows` shape) but recommended a purpose-built schema —
   mirrors identity's `PageKey` precedent (a small, owner-approved contract addition where "wilaya rows
   + commune overrides" is prose-only in the spec). **Decision: add it.** Implemented in
   `Apps/contract/src/modules/platform/platform.dtos.ts`.
2. **Geography seed size: 69 (spec) vs. real-world Algeria.** While sourcing the wilaya/commune seed
   data (plan §7.1), found real-world Algeria (post-2019 reorganization) has **58** wilayas and **1541**
   communes — confirmed against a complete, internally-consistent bilingual dataset already vendored in
   this repo at `Mvp/frontend/src/config/algeria-{wilayas,commun}.json` (58 wilaya codes; every commune
   references exactly one of those 58 codes). There is no real 69-wilaya dataset to seed from — the
   spec's "69" does not correspond to any real geography. **Decision: seed only a small subset now
   (3 wilayas / 14 communes), flag full geography seeding as an explicit follow-up**, rather than commit
   to either 58 or a fabricated 69. This is **not** the plan's original "seed all 69" expectation —
   recorded here as a deviation, not silently resolved, since it changes what "seeded" means for this
   module until a follow-up decision is made.

Both are recorded in `plan-platform.md` §7.1/§8.1 with the reasoning above; this report is the executed
resolution.

## What was built

1. **Contract:** `AdminFeesResponseSchema`/`AdminFeesDto` added to `platform.dtos.ts` — `{ wilayas: [{
   wilayaId, wilayaCode, frName, arName, deliveryHome, deliveryOffice, communes: [{ communeId,
   communeCode, frName, arName, deliveryHome, deliveryOffice }] }] }`. Re-exported by the existing
   `platform/index.ts` barrel (`export * from './platform.dtos'` — no barrel change needed).
2. **Dependencies:** `exceljs` (^4.4.0) + `multer` (^2.0.0) + `@types/multer` (^1.4.12) added to
   `Apps/api/package.json`, installed.
3. **Geography data:** `Apps/api/prisma/wilayas.registry.ts` — a small, **real** (not fabricated) subset:
   Tindouf (2 communes), Illizi (4 communes), Ouargla (8 communes) — 14 communes total, chosen for a
   small-but-varied commune-count spread so later fee-precedence/filter tests have real multi-commune
   wilayas to exercise. Codes/names copied verbatim from the vendored reference dataset (not invented),
   mirroring `pages.registry.ts`'s side-effect-free, factory-reusable shape.
4. **Seed (`Apps/api/prisma/seed.ts`, restructured into `seedPages`/`seedGeography`/`seedSettings`):**
   - `seedGeography()` — upserts `Wilaya` by `wilayaCode`, `Commune` by `communeCode` (both idempotent,
     safe to overwrite names on re-run since they're not user-editable).
   - `seedSettings()` — writes the **4 default `Setting` rows** (`store`, `invoicing`, `delivery`,
     `storefront`) **only when missing** (a `findUnique`-then-`create` guard, not a blind upsert) —
     settings are user-editable via `PATCH /admin/settings`, so re-running the seed must never stomp on
     an admin's changes. `invoicing.prefixes`/`nextSequences` cover **every** `DocType` (`FAC`/`SAL`/
     `ORD`/`REP`/`SUP`/`ADJ`/`POS`/`CLI`, each starting at sequence `1`) — this row's existence is what
     `SequenceService`'s `FOR UPDATE` row-lock (Sprint P3) depends on.

## Validation

- `npm --prefix Apps/contract run validate` — green (tsc `--noEmit` + madge cycles + eslint + conformance test, 4/4).
- `npx tsc --noEmit` (API) — clean.
- `npm run lint` (API) — clean.
- `npm run test:unit` (API) — green, 98/98 tests, 13 files (unaffected by this sprint — no module code yet).
- `npm run db:seed` run **twice** against the local dev DB (`dragon_telecom_dev`, port 5544):
  - Run 1: `Seeded pages (7)`, `Seeded geography (wilayas: 3, communes: 14)`, `Seeded settings (created: 4/4)`.
  - Run 2 (idempotency check): same geography counts, `Seeded settings (created: 0/4)` — no row created
    or overwritten the second time.
  - Verified directly against Postgres: `Wilaya` = 3 rows, `Commune` = 14 rows, `Setting` = 4 keys
    (`delivery`, `invoicing`, `store`, `storefront`), `Page` = 7 rows — no duplicates after the second run.
  - Spot-checked the `invoicing` row's JSON: all 8 `DocType` prefixes + `nextSequences: 1` present, no
    magic strings (built from `Object.values(DocType)` + a `Record<DocType, string>` literal).
- No magic strings — seed/registry reference `DocType` (contract enum) only for keys; wilaya/commune
  codes are literal real-world data (not "magic" — see decision 2 above for provenance).

## Committed on green

`api: platform sprint 1 — prerequisites` (contract's `AdminFeesResponseSchema` addition included in the
same commit — it's a small, single-purpose addition directly gating this sprint's work, same rationale
identity's Sprint 1 report gave for bundling its `PageKey`/`PageGroup` contract addition).
