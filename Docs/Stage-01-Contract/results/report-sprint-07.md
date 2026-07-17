# Sprint 7 — Statistics & Observability (final sprint)

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/statistics/`** — new module, 4 content files + barrel (plan J / spec `statistics.md`). **No `command.ts`** (read-only), **no `events.ts`** ("Listens: none. Emits: none. Queries only." — spec explicit):
  - `statistics.enums.ts` — `ReportType` (9 values), `ChartType` (4 values, from the `CHARTS` route note), `ReportFormat` (`table`/`csv` — only `csv` is confirmed by the spec, `table` is the inferred complement).
  - `statistics.routes.ts` — `STATS_ROUTES` (7 constants).
  - `statistics.query.ts` — `FilteredQuery`, `ChartsQuery`, `ChartParams`, `TopProductsQuery`, `ReportQuery`, `ReportParams`.
  - `statistics.dtos.ts` — `OverviewDto`, `FilteredDto`, `ReportDto` (`rows`/`totals` as `z.record(z.string(), z.unknown())`, matching the spec's own `Record<string, unknown>` notation), `AdminDashboardDto`, `StaffDashboardDto`.
  - `index.ts` barrel.
- **`Apps/contract/src/modules/observability/`** — new module, 5 content files + barrel (plan K / spec `observability.md`). **No `events.ts`** (emits none; only consumes others' events, documented not redeclared):
  - `observability.enums.ts` — `ClientActivityType`.
  - `observability.routes.ts` — `OBS_ROUTES` (6 constants).
  - `observability.command.ts` — `ClientActivityCommand` (one `.refine()`: `durationSeconds` forbidden when `type === SEARCH`, directly verified by the spec's Test Scenarios), `StaffSearchCommand`.
  - `observability.query.ts` — `ClientActivityQuery`, `StaffSearchesQuery`, `LogsQuery` (`limit` defaults to 20, per the route note "20/page"), `ClientActivityIdParams`.
  - `observability.dtos.ts` — `ClientActivityDto`, `StaffSearchDto`, `AuditLogDto` (`actionType`/`entityType`/`entityId` all open strings, never enums — spec-mandated), `LogStatsDto`.
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/statistics'` and `export * from './modules/observability'`. **All 12 domain modules are now exported from the root barrel**, completing the contract package.

## Naming collision found and fixed during the final validation gate

`tsc --noEmit` caught a real conflict: `observability.query.ts` originally exported `ClientIdParams`/`ClientIdParamsSchema` (for the `CLIENT_ACTIVITY` route's `:id` param), which collided with `clients.query.ts`'s existing export of the same names. Renamed observability's to `ClientActivityIdParams`/`ClientActivityIdParamsSchema` — named for its own route rather than the generic entity, avoiding the clash. This is exactly the kind of error the phase's "run the full validate script" step exists to catch; documenting it here per the report's job.

## Going beyond the module spec's stated self-containment (justified, not a rules violation)

`statistics.md`'s `AdminDashboardDto`/`StaffDashboardDto` list only property *names* for their array/object sub-fields (`pendingOrders[]`, `myDrafts[]`, `stats {...}`, etc.) with **zero field-level detail** — the spec claims "self-contained — no other file needed" but doesn't actually specify these two DTOs' nested shapes. Rather than inventing shapes from nothing, cross-checked `Docs/Stage-00-Conception/Pages-Requirements/ADM-01-dashboard.md` and `STF-01-dashboard.md` — still Stage-00-Conception, the sole confirmed source of truth, just not `module-contracts/`. These gave concrete grounding:
- ADM-01: pending orders/clients are "actionable" (link to a confirm/approval dialog); recent orders (8) / recent clients (5); low stock (5, "threshold-flagged"); repairs by status; draft sales by staff.
- STF-01: "my sales today (**count** + revenue)" — resolved `mySalesToday` as a count, distinct from `myRevenueToday`; **"My drafts list (reference, client, total, age)"** gave `myDrafts`' exact field list directly.

`AdminDashboardDto`/`StaffDashboardDto` remain the most heavily-inferred DTOs in the whole contract — flagged inline with a code comment and here for backend-stage confirmation once the actual dashboard queries are implemented.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`ChartType`/`ReportType`/`ReportFormat` enums** — `ChartType` and `ReportType` are fully spec-given; `ReportFormat` is half-inferred (`csv` confirmed, `table` assumed as the complement, since `ReportDto.chart`/`rows` clearly supports a non-CSV JSON response too).
2. **`TopProductsQuery.period` and `ReportQuery.groupBy` kept as free strings** — neither has enumerated values anywhere in the spec, same treatment as `catalog`'s dropped `ProductSort` (Sprint 2) and `orders`' dropped `OrderStatsQuery` (Sprint 5) — consistent "don't invent enum members" policy applied a third time.
3. **`repairsByStatus` typed as `Record<string, number>`**, not keyed by the `RepairStatus` enum — `statistics` has no documented dependency on `repairs` in the plan, so the key stays an open string rather than introducing a new cross-module edge for one dashboard field.
4. **`AuditLogDto.entityId` kept as `z.string()`, not `z.uuid()`** — `database-description.md` describes it as a generic `String` FK-equivalent across many possible entity types, consistent with `actionType`/`entityType` also being open strings by design.

## Final validation (full `npm run validate` gate, all 12 modules, 86 files)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean (after fixing the `ClientIdParams` collision above) |
| `madge --circular --extensions ts src` | ✅ no circular dependency (86 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged since sprint 0 — no new tests added across any sprint, consistently out of scope per rules §2's file-count rule, which lists no test file among a module's six content files) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `createdAt` in both new modules' DTOs use `z.iso.datetime()`; `from`/`to` filters use `z.iso.date()` |
| No sensitive field in any DTO — **whole-contract sweep** | ✅ — grepped `passwordHash`/`tokenHash` across every `*.dtos.ts` in all 12 modules; the only hit is `identity.dtos.ts`'s own guardrail *comment* ("Never expose passwordHash..."), not a field |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — `statistics`: 4 content files + `index.ts` (no command, no events, as planned); `observability`: 5 content files + `index.ts` (no events, as planned) |
| Everything exported | ✅ — root `src/index.ts` now re-exports `common/*` plus all 12 module barrels |

## Stage 01 complete

All 8 sprints (0–7) are ✅ in `sprints.md`. The `@dragon-telecom/contract` package now holds every domain module from `Docs/Stage-00-Conception/Module-Contracts/`: `identity`, `catalog`, `clients`, `inventory`, `platform`, `purchasing`, `sales`, `orders`, `repairs`, `billing`, `statistics`, `observability`. Deliverables per the phase file's "Expected Outputs":
1. A fully compilable `@dragon-telecom/contract` package — ✅ (`tsc --noEmit` clean).
2. A complete set of Zod schemas mirroring `module-contracts/` — ✅, with every non-blocking inference/deviation logged in the eight per-sprint reports.
3. A folder of per-sprint reports in `Docs/Stage-01-Contract/results/` — ✅ (`report-sprint-00.md` through `report-sprint-07.md`, this file).
4. A clean commit history, one commit per sprint — ✅ (8 commits, `contract: sprint 0` through `contract: sprint 7`).

## Open items carried forward (for the backend/frontend stages, not blocking Stage 01)

- `AdminDashboardDto`/`StaffDashboardDto` sub-shapes (this sprint) — grounded in page-requirements but still the most inferred DTOs in the contract.
- Several event payloads across modules (`user.created`/`updated`/`roleChanged`, `client.registered`/`rejected`/`passwordReset`, `product.created`/`repriced`/`taxonomy.changed`/`clientCategory.changed`, `supplierInvoice.cancelled`, `supplier.creditChanged`, `order.placed`/`statusChanged`/`cancelled`/`returned`, `repair.statusChanged`/`cancelled`, `invoice.issued`/`cancelled`) are minimally inferred where the spec names an event without a field list.
- `SupplierDetailDto`/`SupplierStatsDto` (sprint 4), `catalog.enums.ts`'s dropped `ProductSort`, `orders`' dropped `OrderStatsQuery`, `statistics.query.ts`'s free-string `period`/`groupBy` — all flagged for confirmation once real UI/backend requirements land.
- `Apps/api`/`Apps/web` still declare `"@your-app/contract": "file:../contract"` (sprint 0) — will need updating to `@dragon-telecom/contract` when those template apps are rebuilt in Stage 02/03.

## Commit

Committed on green as `contract: sprint 7 — statistics & observability`.
