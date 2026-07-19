# Platform — Sprint P3 Report: Logic (service + injected SequenceService & DeliveryFeeService)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint P3 marked ✅.

---

## What was built

`src/modules/platform/platform.service.ts` — all business logic in one file, per plan §5 item 3
("co-located... to honor the strict single-service-file rule"):

- **`PlatformService implements IPlatformService`**: `listWilayas`, `resolveFee` (commune → wilaya
  → default precedence + `source`), `getAdminFees`/`upsertFees` (validated, transactional,
  emits `deliveryFees.changed` after commit), `importFees`/`exportFees` (Excel/CSV/JSON via
  `exceljs`, all-or-nothing validation), `getSettings`/`updateSettings`/`getPublicSettings`
  (section-level merge, decrease guard, `settings.changed` narrated old → new).
- **`SequenceService implements ISequenceService`**: `nextNumber(tx, docType)` — row-locks the
  `invoicing` `Setting` via `tx.$queryRaw … FOR UPDATE`, formats `PREFIX-YYYY-NNNN`, writes back
  the incremented counter on the same `tx`.
- **`DeliveryFeeService implements IDeliveryFeeService`**: `resolve(wilayaId, communeId, mode)` —
  shares the module-level `resolveFeeAndSource()` function with `PlatformService.resolveFee`
  (plan §3.6: "shares the private resolver" — implemented as a shared standalone function rather
  than a shared class method, since the two services are separate classes).

`test/unit/modules/platform/platform.service.spec.ts` — 25 tests (written before the
implementation, per the execution protocol).

---

## A real bug found and worked around — Postgres NULL is not DB-enforced-unique here

**Discovery.** While designing `upsertFees`, I checked whether Prisma's compound-key `upsert()`
(`where: { wilayaId_communeId: { wilayaId, communeId: null } }`) safely updates the existing
wilaya-level `DeliveryFee` row (`communeId = null` = "the wilaya fee", per the schema comment) on
repeated calls. **Verified directly against the real dev Postgres** (raw SQL, in a rolled-back
transaction): two `INSERT`s with the same `wilayaId` and `communeId = NULL` **both succeed** —
Postgres treats `NULL` as distinct from `NULL` in a unique index by default (SQL-standard
behavior), so `@@unique([wilayaId, communeId])` does **not** actually prevent duplicate
wilaya-level rows. Concretely, this means `prisma.deliveryFee.upsert()` on that compound key would
have silently **inserted a new row every call** instead of updating the existing one whenever
`communeId` is `null` — breaking "communeId = null = the wilaya fee" (singular) into an
ever-growing set of stale duplicate rows, corrupting `resolveFee`'s precedence logic over time.

**Fix (application-level, no schema/migration change).** A shared `upsertFeeRow()` helper
branches on `communeId`:
- **`communeId != null`** (a commune-level override): the compound unique key **is** genuinely
  DB-enforced for non-null values, so a plain `tx.deliveryFee.upsert(...)` is correct and used
  as-is.
- **`communeId == null`** (the wilaya-level row): manual `findFirst` (not `findUnique` — its
  "guaranteed unique" typing assumption is exactly what's false here) **then** `update` by `id` or
  `create`. Applied identically in both `upsertFees` (admin PUT) and `importFees` (bulk import),
  since both write `DeliveryFee` rows. The read side (`resolveFeeAndSource`) was written the same
  way from the start (`findFirst`, not `findUnique`, for the wilaya-level lookup) — so this isn't
  a second fix, just consistent with the first.

**Verified twice**, not just asserted: (1) the raw-SQL check above, confirming the underlying
Postgres behavior; (2) a temporary script (removed before commit) that ran `PlatformService`
against the **real** dev DB — three sequential `upsertFees` calls for the same wilaya's
`communeId: null` row produced **exactly one** `DeliveryFee` row, correctly holding the last
call's values (`900`/`500`), not three rows.

**Why not fix it in the schema instead?** Postgres 15+ supports `UNIQUE NULLS NOT DISTINCT`, which
would make the DB itself enforce this. That's a genuine, better long-term fix, but it's a schema
migration against an already-applied initial migration (`20260717103221_init`) — a bigger, riskier
change than this sprint's scope, and not something to make unilaterally. **Flagged for the owner**:
worth considering as a follow-up migration; the current application-level fix is correct and
tested, so this isn't blocking.

---

## Other design notes

- **`updateSettings`'s merge needed a typed helper, not a raw spread.** `{...before.store,
  ...cmd.store}` type-checks incorrectly under this project's `exactOptionalPropertyTypes: true`:
  Zod's `.optional()` infers `{ key?: T[K] | undefined }` (the *value* type itself includes
  `undefined`), which is a different, stricter shape than what `Partial<T>` produces (`{ key?:
  T[K] }`, no explicit `undefined` in the value type) — so a naive `Partial<T>`-typed merge helper
  didn't compile either. Added a small `mergeDefined<T>(base, patch: OptionalPatch<T> | undefined)`
  helper with a purpose-built `OptionalPatch<T>` mapped type instead, fixing both the runtime
  merge semantics and the type error in one place.
- **`describeSettingsChange`'s narration is a generic recursive leaf-diff**, not a bespoke string
  per section — walks nested plain objects (so `invoicing.nextSequences.SALE: 1 → 10` narrates
  automatically) and compares arrays/primitives whole-value. Kept in the service (business logic
  — deciding what to report), not the mapper (pure DTO transform only).
- **exceljs ships a broken ambient `Buffer` type declaration** (`declare interface Buffer extends
  ArrayBuffer {}` inside its own `index.d.ts`) that shadows Node's real `Buffer` within its module
  scope — a known 3rd-party typing defect (verified the runtime return of `writeBuffer()` really
  is a Node `Buffer` via `StreamBuf.read()` in exceljs's own source). Worked around with two
  narrow, commented type casts at the two boundary calls (`load()`, `writeBuffer()`) rather than
  loosening any of this module's own types.
- **`updateSettings` is a true no-op when the command touches nothing** — no `$transaction`, no
  `eventBus.emit` — rather than writing/emitting a vacuous "nothing changed" event.

---

## Validation

- `npx tsc --noEmit` — clean (after the `mergeDefined`/`OptionalPatch` fix and the two exceljs
  Buffer-type casts).
- `npm run lint` — one real finding fixed: `DocType` was imported as a value but only ever used as
  a type in this file → `import type`.
- `npm run test:unit` — green, **136/136** tests, 15 files (111 prior + 25 new).
- Smoke-tested the null-commune-fee workaround against the **real** dev Postgres (temporary
  script, removed before commit) — see the bug writeup above.
- Service throws `AppError` subclasses (`BadRequestError` for unknown wilaya/commune ids and
  import validation failures, `ConflictError` for a sequence decrease); multi-row writes go
  through `$transaction`; both events (`deliveryFees.changed`, `settings.changed`) emit only after
  the write transaction resolves; every returned value is DTO-shaped via `PlatformMapper` or a
  direct `SettingsResponseSchema.parse()`.

## Committed on green

`api: platform sprint 3 — logic`.
