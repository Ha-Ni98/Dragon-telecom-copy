# Sprint 7 Report — Statistics & Observability

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/hooks`,
`/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/statistics.service.ts`** (new file) — 9 functions: `getAdminDashboard`, `getStaffDashboard`,
  `getOverview`, `getFiltered`, `getChart`, `getTopProducts`, `getReport`, `exportReportCsv` (the backend's
  dual-return `ReportDto | ExportResult` split into two frontend functions, same call as Sprint 6's
  `getStock`/`exportStockCsv`).
- **`src/services/observability.service.ts`** (new file) — 6 functions: `sendClientActivity`,
  `sendStaffSearch` (both `void`, 202+null-envelope beacons), `getClientActivity`, `listStaffSearches`,
  `listLogs` (paginated), `logStats`.
- **2 new hook files**: `useStatistics.ts` (7 query hooks + 1 imperative export mutation),
  `useObservability.ts` (2 beacon mutations + 4 query hooks). Both use the `qk.stats.*`/`qk.observability.*`
  families already scaffolded in the registry since Sprint 1 — added the one missing key,
  `qk.stats.topProducts(query?)`.
- **`tests/fixtures/data/statistics.mock.ts`** + **`observability.mock.ts`** (new) + **`msw/statistics.handlers.ts`**
  + **`msw/observability.handlers.ts`** (new), registered in `server.ts`.
- **32 new tests**: `statistics.service.test.ts` (9) + `observability.service.test.ts` (7) +
  `statistics.test.tsx` (8) + `observability.test.tsx` (8).

## Both domains were genuinely new territory — no stub-collision consumer check needed beyond the standard pass

Neither `statistics.service.ts` nor `observability.service.ts` collides with a same-named Sub-01 stub file
(`dashboard.service.ts`, `admin-statistics.service.ts`, `admin-logs.service.ts` are all differently named), so
both are clean new files — same pattern as Sprint 6's `inventory.service.ts`/`purchasing.service.ts`. Still ran
the full hook-name collision check (including `use-admin-settings.ts`, per the standing rule) against every
pre-existing export in `use-dashboard-stats.ts`/`use-dashboard-data.ts`/`use-admin-statistics.ts`/
`use-admin-logs.ts`: zero hits. All hook names from plan.md §2.8/§2.9 were used verbatim
(`useAdminDashboard`/`useStaffDashboard`/`useOverview`/`useFiltered`/`useChart`/`useTopProducts`/`useReport`/
`useSendClientActivity`/`useSendStaffSearch`/`useClientActivity`/`useStaffSearches`/`useLogs`/`useLogStats`).

## Resolved every open plan.md §2.8/§2.9 `*(confirm)*` item by reading the real backend

`Apps/api/src/modules/statistics/statistics.{interface,controller,mapper}.ts` and
`Apps/api/src/modules/observability/observability.{interface,controller}.ts` confirmed:
- **`CHARTS` returns `ChartPoint[]`** (`{label,value}[]`), not `ReportDto` as plan.md's own placeholder guessed
  — `IStatisticsService.getChart`'s signature is explicit. `ChartPoint` has no contract schema of its own; typed
  as `ReportDto["chart"][number]` in the frontend service rather than redeclaring the shape, mirroring how the
  backend's own mapper extracts it via `ReportResponseSchema.shape.chart`.
- **`TOP_PRODUCTS` has no contract schema at all** — not even an informal field list, unlike the dashboards
  (which are at least contract-flagged as "heavily inferred"). `Apps/api`'s `statistics.mapper.ts` declares its
  own local, non-contract `TopProductResponseSchema`. Mirrored as a plain local TS type in
  `statistics.service.ts`, field-for-field identical to the backend's schema — same "fill a genuine gap without
  touching the frozen contract" precedent as orders' `AdminCancelOrderCommand` / platform's `ImportFeesResult`.
- **`STAFF_SEARCHES` is a bare array** — `StaffSearchesQuery` carries no `page`/`limit`, so the pagination rule
  (plan §0.2) resolves the `*(confirm)*` cleanly once the query schema was actually read.
- **Beacons' 202-null envelope behavior** confirmed directly against `observability.controller.ts`:
  `sendSuccess(res, null, 202)`. Unlike Sprint 4's 204 finding (WHATWG null-body status, body stripped
  regardless of backend intent), 202 is *not* a null-body status — the `{success:true,data:null}` envelope
  genuinely survives the wire. The service still unwraps+throws on failure but returns `void` on success (there
  is no data to give back).

## No invalidation authored in either domain — by design, not an oversight

Statistics is entirely read-only (no command file exists in the contract at all); observability's beacons write
ephemeral activity rows that nothing in this sprint reads back from. Per plan §3's cross-domain invalidation
matrix, both are swept via `qk.stats.all()` from *other* domains' mutations (order confirm, sale confirm, etc.)
rather than authoring per-hook invalidation here — consistent with the plan, not a gap.

## Validation

```
npm run check
```
Clean, whole project, zero errors (`tsc --noEmit` on both `/src` and `/src`+`/tests`).

```
npx vitest run
```
**27/27 files, 238/238 tests passing** (up from 206/206 at Sprint 6 close — 32 new).

Lint: ran `eslint --fix` scoped to the 12 new/touched files only (all genuinely new — no old-stub section to
reconstruct around). Confirmed zero errors afterward on those exact files; the ~10.2k pre-existing
prettier-noise elsewhere in the repo (Sprint 4 finding) was left untouched.

## Commit

`fe: integration sprint 7 — statistics & observability` on `stage-03-sub-02-integration`.

## Handoff to Sprint 8 (Identity Admin)

- Identity Admin (users/roles/pages/technicians) is the next domain — `qk.identity.*` is already scaffolded in
  the registry (Sprint 1) with `users:{all,list,detail}`, `roles:{all}`, `pages(query?)`, `technicians:{all}`.
- Standing checklist for every remaining sprint (unchanged): check page/component consumers +
  `use-admin-settings.ts` collisions before naming hooks; read the real backend interface/controller before
  guessing response shapes (this sprint found two genuine plan.md placeholder-guess corrections this way); check
  the `qk` registry for a real `.all()` sibling before writing any mutation invalidation.
