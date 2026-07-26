# Set-04 — Sprint 1 Report: Schemas, i18n & the A2 contract/API change (Foundation)

Status: ✅ Done

## A2 — the one backend/contract change this set requires

- **Contract:** `ClientStatsResponseSchema` (`Apps/contract/src/modules/clients/clients.dtos.ts`)
  gained `newThisMonth: z.number().int().min(0)`.
- **API:** `ClientsService.clientStats()` (`Apps/api/src/modules/clients/clients.service.ts`) now
  computes `newThisMonth` via `client.count({ where: { createdAt: { gte: startOfMonth } } })` in
  the same `$transaction` batch as the other three counters — `startOfMonth` built the same way
  `statistics.service.ts`'s `getAdminDashboard()` already does (`new Date(now.getFullYear(),
  now.getMonth(), 1)`, local time), so the new query matches the codebase's existing month-boundary
  convention instead of introducing a second one.
- `ClientsMapper.toClientStatsDto` / `ClientStatsCounts` extended with the fifth field.
- Tests: `clients.mapper.spec.ts`'s `toClientStatsDto` test updated for 5 counters; a new
  `clients.service.spec.ts` `describe('clientStats', ...)` asserts the 5 counts map correctly and
  that the 5th `count()` call's `where.createdAt.gte` equals the current month's start.
- Frontend fixture `tests/fixtures/data/clients.mock.ts`'s `mockClientStats` updated with
  `newThisMonth: 6` (it now fails `ClientStatsResponseSchema.parse()` without it — caught by
  running the existing integration suite, not a new test).
- No route/verb change; no frontend service/hook change needed (`adminClientStats()` is already
  generically typed off `ClientStatsDto`).

## Zod schemas (13 files, all RHF-ready, all contract-aligned)

| File | Contract Command(s) wrapped | Notes |
|---|---|---|
| `pages/admin/inventory/components/adjustment.schema.ts` | `CreateAdjustmentCommand` | factory takes `systemQuantityByProductId`; `superRefine` requires `unitCost` whenever a line's `countedQuantity` exceeds current system quantity (an IN-delta) |
| `pages/admin/supplier-invoices/components/supplier-invoice.schema.ts` | `CreateSupplierInvoiceCommand` | re-declares the contract's own amountOnly-XOR-lines `.refine` with a translated message (a `ZodEffects` can't be `.extend()`-ed) |
| `pages/admin/pos-clients/components/pos-client.schema.ts` | `CreatePosClientCommand` / `UpdatePosClientCommand` | admin-only; kept separate from the staff `quick-add-pos-client.schema.ts` (STF-02) per the co-located-per-page convention |
| `pages/admin/clients/components/approve-client.schema.ts` | `ApproveClientCommand` | `categoryId` mandatory (already required by the contract); username-unique 409 is a server error surfaced via `setError` at the Sprint 7 call site, not a refine here |
| `pages/admin/clients/components/reset-client-password.schema.ts` | `ResetClientPasswordCommand` | `confirmPassword` is a client-only field backing a match `.refine` (same pattern as `change-password.schema.ts`), stripped before submit |
| `pages/admin/users/components/user.schema.ts` | `CreateUserCommand` / `UpdateUserCommand` | re-declares the contract's own type/roleIds refine pair (required+non-empty iff STAFF, forbidden iff ADMIN) with translated messages |
| `pages/admin/users/components/role.schema.ts` | `CreateRoleCommand` / `UpdateRoleCommand` / `SetRolePagesCommand` | system-role lock is a UI-only concern (no `isSystem` flag on the command) — the dialog disables itself, not a schema refine |
| `pages/admin/settings/components/store-settings.schema.ts` | `UpdateSettingsCommand["store"]` | one file per Settings tab, each submitting only its own section (every section is independently optional on the command) |
| `pages/admin/settings/components/invoicing-settings.schema.ts` | `UpdateSettingsCommand["invoicing"]` | sequence-decrease 409 is backend-only (can't validate without reading current state) — surfaces as an inline banner in Sprint 8 |
| `pages/admin/settings/components/client-category.schema.ts` | `CreateClientCategoryCommand` / `UpdateClientCategoryCommand` | Settings now owns Categories (ADM-17), replacing the stub `admin/clients/components/client-category-dialog.schema.ts`, which is untouched here and torn down in Sprint 9 behind the grep gate |
| `pages/admin/settings/components/taxonomy.schema.ts` | `CreateBrandCommand`/`UpdateBrandCommand`/`CreateFamilyCommand`/`UpdateFamilyCommand`/`CreateModelCommand`/`UpdateModelCommand`/`SetModelFamiliesCommand` | one file, seven factories — the Hierarchy panel's Families/Brands/Models sub-panels; kept separate from the products-page stub `model-dialog.schema.ts` (owned by set-03) |
| `pages/admin/settings/components/delivery-fees.schema.ts` | `UpsertFeesCommand` | shared shape for the manual-edit form and the Excel-import dry-run parse |
| `pages/admin/suppliers/components/supplier.schema.ts` | `CreateSupplierCommand` / `UpdateSupplierCommand` | replaces the stub `admin-supplier-add-dialog.schema.ts` once ADM-07 rewires onto `usePurchasingSuppliers` (Sprint 6); stub deleted in Sprint 9 |

Every file follows the established convention (`quick-add-pos-client.schema.ts`,
`create-return.schema.ts`, `change-password.schema.ts`): a factory `xSchema(t, ...params)`
returning the `z.object`, an exported `FormValues` type, and a compile-time
`AssertAssignable<FormValues extends Command>` guard so a future contract rename fails the build
here instead of silently drifting.

**Deviations found while wrapping, all in the wrappers' favor (kept the schema honest, not the
plan's prose):**
- `CreateAdjustmentCommand`, `CreateSupplierInvoiceCommand`, and `CreateUserCommand` already carry
  their "refine" at the contract level (amountOnly-XOR-lines; type/roleIds). The wrappers
  re-declare the same shape + refine with a translated message rather than inventing new
  validation, since a `ZodEffects` result can't be `.extend()`-ed.
- `z.record(z.enum(DocType), ...)` is **exhaustive** in Zod 4 (every enum member must be present
  once the record is supplied at all) — confirmed against the live `zod` package, not assumed.
  This means the Invoicing tab's `prefixes`/`nextSequences` maps must submit one row per `DocType`
  when touched, not a partial map; flagged for the Sprint 8 wiring author and reflected in the
  round-trip test (`invoicing-settings.schema.test.ts`).
- `RoleDto.pageKeys: string[]` (not `RoleDto.pages: PageDto[]`) — confirms the plan's own flagged
  risk in Sprint 7 ("verify it carries page ids"); `role.schema.ts`'s `SetRolePagesCommand` wrapper
  and the future effective-page-list `useMemo` should read `pageKeys` directly.
- `SetRolePagesCommand.pageKeys` has no non-empty constraint on the contract (a role can hold zero
  pages) — the wrapper does not add one.

## i18n (`config/translations.json`)

Added 263 new keys (checked programmatically against the existing 2,406 — zero collisions).
Every schema's own validation messages resolve to a key
(verified by grepping the 13 new files for `t("..."` and diffing against the new key set); the
remaining keys give each of the ten pages its title/description, tab labels, table columns, and
primary dialog fields/buttons/states ahead of the Sprint 4/6/7/8 components that will render them
— mirroring the amount of upfront i18n work Sprint 1 did for set-03.

Five pages (suppliers, clients, statistics, settings, logs) already carried substantial copy from
their Sub-01 stub build (178/210/98/118/48 existing keys respectively) — reused as-is per the
reuse-first rule; only genuinely new UI surfaces got new keys (disable action, the approval
dialog, client detail + browsing tabs, reset-password, the report picker, the Users/Roles page,
the Hierarchy/Invoicing/Categories/Storefront settings tabs, staff-searches). Generic messages (`required`, `nonNegativeNumber`, `invalidEmail`, `selectRequired`) and the
password-mismatch message reused existing `common.validation.*`/`register.passwordMismatch`
keys instead of duplicating them: of the 23 distinct `t(...)` keys referenced across the 13
schema files, 5 resolve to those pre-existing keys and 18 are new domain-specific messages
(counted directly, see below). `en`/`fr` are real copy;
`ar` is `""` on every key (verified programmatically — zero exceptions across all 2,669 keys).

## Validation

- `Apps/contract`: `npm run validate` (tsc + madge cycles + eslint + conformance test) — clean.
- `Apps/api`: `tsc --noEmit` clean; `vitest run test/unit test/contract` — 40 files / 616 tests,
  all green (no regressions).
- `Apps/web`: `tsc --noEmit` and `tsc --noEmit -p tsconfig.test.json` clean, including all 13
  `AssertAssignable` compile-time guards; `eslint` clean on every new/changed file (4 files needed
  `--fix` for prettier-only formatting, re-linted clean after).
- `Apps/web`: `vitest run` — 75 files / 511 tests, all green. One pre-existing, unrelated
  `vaul`/jsdom pointer-up exception logs in `staff-sales/sales.test.tsx` (all 7 of that file's
  tests still pass) — confirmed pre-existing by running that file in isolation before touching it;
  not introduced by this sprint.
- 13 new round-trip test files under `tests/unit/pages/**/*.schema.test.ts` (inventory,
  supplier-invoices, pos-clients ×1, clients ×2, users ×2, settings ×5, suppliers ×1) — one
  `safeParse` per schema factory covering the happy path and every refine/message added above.
- `translations.json` re-parsed as valid JSON post-merge; 0 malformed entries (missing `en`/`fr`,
  or `ar !== ""`) across all 2,669 keys.
- No inline strings introduced (all schemas source messages via `t(...)`); no `useEffect`
  fetching (no components built yet — Sprint 1 is schemas/i18n only); no test files under `/src`.

## Carried into later sprints

- Sprint 2 (routes) can proceed immediately — no hook gaps found, matching the plan's own
  audit.
- Sprint 8 (Settings wiring) needs to know the Invoicing tab's `prefixes`/`nextSequences` record is
  exhaustive-by-DocType, not partial (see Deviations above).
- Sprint 7 (Users & roles wiring) should derive the effective-page list from `RoleDto.pageKeys`
  (confirmed shape), not a `pages` field.
- Sprint 9 (stub teardown) gains one more entry not in the original Deletion Audit list: the
  stub `admin/clients/components/client-category-dialog.schema.ts` is now also orphaned once
  Settings' Categories tab (using this sprint's `client-category.schema.ts`) ships in Sprint 8 —
  grep-gate it alongside the others.
