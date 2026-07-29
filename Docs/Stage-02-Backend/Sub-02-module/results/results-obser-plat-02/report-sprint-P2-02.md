# Platform — Sprint P2 Report: Foundation (mapper, interfaces, factories)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint P2 marked ✅.

---

## What was built

1. **`src/modules/platform/platform.mapper.ts`** — pure/static `PlatformMapper`:
   `toWilayaDto`, `toFeeDto(deliveryHome, deliveryOffice, source)`, `toSettingsDto(rows)`,
   `toPublicSettingsDto(settings)`, `toAdminFeesDto(wilayas, fees, defaults)`, and a private
   `toMoney()` helper (`Prisma.Decimal | number → number`). Every `toDto` ends with its
   `*ResponseSchema.parse(...)` (conformance guard). Never spreads an entity.
2. **`src/modules/platform/platform.interface.ts`** — `IPlatformService` (9 route-serving
   methods), `ISequenceService` (`nextNumber(tx, docType)`), `IDeliveryFeeService`
   (`resolve(wilayaId, communeId, mode)`) — all three per plan §2.1.
3. **Factories:** `test/data/wilaya.factory.ts` (`seedWilayas`, idempotent upsert from the
   registry), `delivery-fee.factory.ts` (`upsertFeesPayload`, `seedFee`), `settings.factory.ts`
   (`updateSettingsPayload`, `seedSettings`), `fees-import.fixture.ts` (`validFeesWorkbook`,
   `mixedFeesWorkbook` — builds real `.xlsx` buffers via `exceljs`).
4. **`test/unit/modules/platform/platform.mapper.spec.ts`** — 13 tests (written before the mapper
   implementation, per the execution protocol's test-first step).

## Unplanned addition — shared `prisma/settings-defaults.ts`

The plan's file checklist places "a private defaults-template + merge helper" inside
`platform.mapper.ts` for `toSettingsDto`'s fresh-DB fallback, but Sprint P1 already needed the
*same* default values (prefixes/nextSequences/delivery defaults/storefront) to seed the initial
`Setting` rows. Rather than let two literal copies of the same 8-`DocType` prefix map drift apart,
extracted a shared, side-effect-free `Apps/api/prisma/settings-defaults.ts` (mirrors the existing
`pages.registry.ts`/`wilayas.registry.ts` pattern: real data outside the strict 6-file module,
importable by both `prisma/seed.ts` and `src/modules/platform/platform.mapper.ts`). Refactored
`seed.ts` to import `DEFAULT_SETTINGS` from it instead of defining its own copy — a same-sprint
follow-through on Sprint P1's work, not a new decision, so no separate contract/data commit needed.
Re-verified `db:seed` behavior is unchanged (see Validation).

## Design notes

- **`toSettingsDto`'s merge granularity is section-level, not field-level.** A `Setting` row is
  either entirely absent (falls back to `DEFAULT_SETTINGS.<section>`) or entirely present (used
  as-is). This matches the plan's stated purpose ("so a fresh DB still yields a valid `SettingsDto`")
  without over-engineering a deep per-field merge that nothing in the spec asks for — `updateSettings`
  (Sprint P3) is responsible for writing back a complete, valid section on every PATCH.
- **`toAdminFeesDto`'s `communes[]` only lists communes with an explicit override row** — matches
  the `AdminFeesResponseSchema` added in Sprint P1 (no optional fields on that nested object), and
  the "wilaya rows + commune overrides" spec wording (the wilaya-level row already carries the
  resolved default fee; listing every commune redundantly would misrepresent non-overridden
  communes as if they had one).
- **Mapper test caught a real thing to get right:** an early test draft supplied a partial
  `invoicing` section (`{ prefixes: { INVOICE: 'FAC' }, nextSequences: { INVOICE: 5 } }`) and
  `SettingsResponseSchema.parse` correctly rejected it — the contract's `z.record(z.enum(DocType), …)`
  requires every `DocType` key when a section is present. Fixed the test (not the mapper) to supply
  a complete section, confirming real settings writes must always be complete records.

## Validation

- `npx tsc --noEmit` — clean.
- `npm run lint` — one real finding caught and fixed: `platform.mapper.ts`'s `import { Prisma } from
  '@prisma/client'` was flagged by `@typescript-eslint/consistent-type-imports` (only used as a type
  in the `Money` alias) — changed to `import type { Commune, Prisma, Wilaya } from '@prisma/client'`.
- `npm run test:unit` — green, **111/111** tests, 14 files (98 prior + 13 new mapper tests).
- Smoke-tested `fees-import.fixture.ts` stand-alone (a temporary script, removed before commit):
  `mixedFeesWorkbook('30')` produces a real, `exceljs`-readable `.xlsx` buffer with the expected
  header + 2 data rows (one numeric, one non-numeric fee) — confirms the fixture is usable ahead of
  Sprint P3/P4 needing it, without adding an untested dependency to the codebase.
- Re-ran `npm run db:seed` once after the `settings-defaults.ts` extraction to confirm the refactor
  didn't change persisted output: `Seeded settings (created: 0/4)` (already-seeded dev DB, unchanged
  as expected).
- Mapper excludes nothing sensitive (no entity ever spread); every `toDto` returns a schema-parsed
  DTO; interfaces return DTOs (or the injected primitives the spec dictates) only, never entities.

## Committed on green

`api: platform sprint 2 — foundation`.
