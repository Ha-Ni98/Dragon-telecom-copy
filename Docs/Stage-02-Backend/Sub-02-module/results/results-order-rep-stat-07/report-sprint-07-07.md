# Sprint 7 Report — Statistics: Foundation (mapper, interface)

**Set:** 07 (orders + repairs + statistics) · **Module:** statistics · **Layer:** foundation
**Status:** ✅ Done

---

## What was built

- **`src/modules/statistics/statistics.mapper.ts`** — `StatisticsMapper`, thin per plan §D-6
  (no owning entity; query composition lives in Sprint 8's service):
  - `toDashboardOrderSummary`/`toDashboardClientSummary`/`toLowStockItem` — the repeatable row
    shapers embedded inside both dashboard DTOs. `toLowStockItem`'s `availableQuantity =
    quantityOnHand − quantityReserved` is the same formula `InventoryMapper.availableQuantity`
    uses, **recomputed here rather than imported** — statistics has no dependency on
    inventory's module folder (cross-module reads only, never a folder import).
  - `toOverviewDto`/`toFilteredDto`/`toReportDto`/`toAdminDashboardDto`/`toStaffDashboardDto` —
    each assembles its aggregate inputs (already computed by the service) into the exact
    contract shape and ends in the matching `…ResponseSchema.parse(...)`.
  - `toTopProductDto`/`toChartPoints` — see the two genuine contract gaps below.
- **`src/modules/statistics/statistics.interface.ts`** — `IStatisticsService`, all seven
  methods from plan §III.2, **Prisma-only** signatures (no injected cross-module service, no
  event bus — statistics reads everything via the shared `prisma` singleton). Reuses the
  `{filename;mime;body}` local `ExportResult` shape (inventory/platform/billing precedent) for
  `getReport`'s CSV branch.
- **Test:** `test/unit/modules/statistics/statistics.mapper.spec.ts` (12 tests) —
  `toLowStockItem`'s `availableQuantity` computation; dashboard order/client summary shaping
  (`Decimal→number`, `Date→ISO`); `toReportDto` preserving `drill{entity,idField}`;
  `toTopProductDto`'s `Decimal→number`; `toChartPoints`' validation against the reused
  `ReportDto.chart` shape; `toAdminDashboardDto` assembling every section in one call (a
  genuine conformance guard, since this is the widest single DTO in the whole contract);
  `toStaffDashboardDto`'s optional `myPendingOrdersCount`/`myDrafts[].clientName` inclusion; a
  `.parse` never-throws guard across `Overview`/`Filtered`.

## Genuine contract gaps found (not covered by plan §C — new this sprint)

**1 — `CHARTS` (`STATS_ROUTES.CHARTS`) has no dedicated response schema anywhere in the
contract.** The spec's own DTO block lists `OverviewDto`, `FilteredDto`, `ReportDto`,
`AdminDashboardDto`, `StaffDashboardDto` — five shapes for seven routes. The only
chart-shaped thing that exists is `ReportDto.chart` (`{label;value}[]`), and the CHARTS route's
own note ("revenue | orders | clients | sales-by-family") describes exactly the kind of
single label/value time-series that field represents. **Resolution:** reused
`ReportResponseSchema.shape.chart` — zod exposes each object field's own schema instance via
`.shape` — rather than redeclaring the identical array shape a second time. `getChart` returns
`ChartPoint[]` (`ChartPoint = z.infer<typeof ReportResponseSchema.shape.chart>[number]`), a
type derived structurally, not a contract re-declaration.

**2 — `TOP_PRODUCTS` has no response shape at all, not even an informal field list.** Unlike
`AdminDashboardDto`/`StaffDashboardDto` (which the contract-authoring stage at least flagged as
"heavily inferred" against the frontend's page-requirements docs), `TOP_PRODUCTS` has zero
guidance anywhere in `statistics.md` or the contract. **Resolution:** a local, non-contract
Zod schema (`TopProductResponseSchema`/`TopProductDto` in `statistics.mapper.ts`) — same
"fill a genuine gap without touching the frozen contract package" precedent as orders'
`CancelOrderCommand` or inventory/platform's `ExportResult`. Minimal, defensible inference:
`{productId; productName; quantitySold; revenue}` — the conventional meaning of "top
products" (ranked by a sales metric), using tables (`Product`, `SaleLine`) already available
to the service. Flagged prominently rather than silently invented, since — unlike every other
gap this set has resolved — there was genuinely no existing type, port, or field list to
anchor the inference to; this is a pure judgment call, most likely to need revisiting once a
real frontend consumer's actual needs are known.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **582/582 tests, 40 files** (12 new statistics-mapper
  tests; no regressions elsewhere). `test:int` not applicable — no route wired yet.
- [x] `npm run lint` clean (`src test prisma`, no findings).
- [x] Mapper thin/pure (no owning entity, per §D-6), returns contract DTOs only where the
  contract defines one (`TopProductDto`/`ChartPoint` are the two documented exceptions above);
  no bus/injected-service dependency introduced; no contract type re-declared where one
  already exists (`ChartPoint` deliberately reuses `ReportResponseSchema.shape.chart` instead
  of redeclaring it).
- [x] Committed on green.

## Next sprint

Sprint 8 — Statistics: Logic (service), **Prisma-only** — no injected services, no event bus,
no writes. Reads **stored** figures only (plan §C-4): `Order.profit`/`costOfGoods` for
CONFIRMED-and-later orders, both `Sale.origin` values for COMPLETED sales, never the
zeroed ORDER-invoice cost or the `Repair` row directly (its money lives in its own
REPAIR-origin `Sale`).
