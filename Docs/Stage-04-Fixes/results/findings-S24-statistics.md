# Findings — Set 24: statistics correctness *(audit — no code changed)*

Second pass over the statistics module against **current** semantics (orders recognise at
`COMPLETED`, repairs at `PICKED_UP` and produce no `Sale`, the client-payment ledger is the source
of truth for `totalPaid`). Not a repeat of the S14 audit — every finding below was re-derived from
the code as it stands after S1–S23.

**Nothing here has been implemented.** No source file was modified, no test was run. The only
commands run against the database were `SELECT`s.

**Prerequisite:** S23's fix has landed (`report-S23.md`). Its only interaction with this audit is
`getOverview().stockValue` — see §5.

---

## Summary

### Part A — unambiguous bugs

| # | Severity | Report / endpoint | What |
|---|---|---|---|
| **A1** | **Critical** | Every revenue/profit figure in the module | A partially-returned sale is **dropped in full** rather than reduced by the returned line. On live data: revenue reported **129 600.00** vs. true **179 100.00** — **49 500.00 (27.6 %) missing**; profit **61 300.00** vs **82 200.00**. |
| **A2** | **High** | `getFiltered`, all four charts, every dated report | The **last day of every range is silently dropped** — `lte` is compared against a midnight timestamp. The UI's own default range ends *today*, so today's business never appears. Demonstrated: a range ending 2026-08-04 returns **0.00** where the true figure is **60 000.00**. |
| **A3** | **High** | `stock-movements` report | **Reservations are reported as stock movement.** `PENDING_ORDER`, `PENDING_REPAIR` and `PENDING_RELEASE` appear as rows (live: +5, +2, −6 units). The brief forbids this explicitly. |
| **A4** | **High** | Every report (frontend) | `ReportDto.totals` is computed by all nine reports and **never rendered**. The repairs report's `recognizedRevenue/Cost/Profit` — its only D8-correct money figures — are computed and thrown away. |
| **A5** | **Medium** | `repairs` report | Row-level money is dated by **`intakeAt`** while `totals.recognized*` is dated by **`pickedUpAt`**. The same report contradicts itself for any repair whose intake and pickup fall in different ranges. |
| **A6** | **Medium** | `sales-by-family` chart | The **family filter is silently ignored** — `getChart` never passes `familyId` to `chartSalesByFamily`. Same defect class S14/F1 was supposed to have eliminated; the code comment asserting otherwise is factually wrong. |
| **A7** | **Medium** | `client-browsing` report | The "purchased" set has **no status filter** — a product in a DRAFT sale, a CANCELLED order or a cancelled repair counts as purchased and is wrongly removed from "viewed but never purchased", which is the report's entire purpose. |
| **A8** | **Medium** | Every report (frontend) | Money columns render as **bare numbers with no currency and no locale** (`value.toLocaleString()`), e.g. `23,500` instead of `23 500,00 DA`. Same class as S14/F5, fixed in the cards but not here. |
| **A9** | **Medium** | `client-browsing` report (frontend) | The table derives its columns from **`rows[0]` only**, but this report returns two different row shapes. One shape always renders as blank cells. |
| **A10** | **Medium** | `sales-by-category` | Revenue is summed from **line `unitPrice × quantity`**, ignoring `Sale.discountAmount`; every other revenue figure uses the document total. Also: repair revenue is added to a row whose `quantity` column never counts repair parts. |
| **A11** | **Low** | `ageing` report | Ignores the date range the UI sends — the filter looks live but does nothing. |
| **A12** | **Low** | Top-selling products (frontend) | Sits under the page's date and family filters but is called with `{}` — always all-time, never responds to either. |
| **A13** | **Low** | Overview cards | Labelled *"Total revenue from all sales"* but includes orders and repairs; the block is all-time yet rendered above the date filter. |

### Part B — semantic questions for the owner (not resolved here)

| # | Question |
|---|---|
| **Q1** | How should returns net out — recompute from `ReturnLine`, stamp net totals on the `Sale`, or show returns as a separate contra figure? And should a *fully* returned sale vanish or show as a zero row? |
| **Q2** | Is the **delivery fee** revenue? Two reports disagree by exactly the fee today (23 500 vs 23 000 on ORD-2026-0003). It also carries no cost, so including it inflates profit. |
| **Q3** | Is repair **labour** revenue in per-product/per-family dimensions? Selecting any family drops it entirely (REP-2026-0001: 4 100 vs 1 600). |
| **Q4** | **Walk-in payments have no ledger row** — 46 100.00 of collected cash is invisible to the ledger on live data. No payments report exists yet; the rule must be set before one is built. |
| **Q5** | `sales-by-client` excludes walk-ins by design, so its total can never equal overview revenue. Intended? Needs a label. |
| **Q6** | `salesCount` in `sales-by-category` counts orders and repairs as "sales". Rename, or split? |
| **Q7** | Staff dashboard counts only `Sale` rows as "my sales", while `sales-by-seller` credits that same person for repairs they picked up. |

### Verified correct — no change needed

- **No report re-derives cost or profit from `avgStockPrice`.** Grep-verified: the column appears
  in `statistics.service.ts` only inside `getOverview`'s stock valuation. Every cost/profit figure
  reads a stored `costOfGoods` / `profit` / `totalCost` / `totalProfit`.
- **Recognition timing is right.** Orders are gated on `COMPLETED` and dated `deliveredAt`;
  repairs on `PICKED_UP` and dated `pickedUpAt`. No report counts an order at confirmation or a
  repair at completion.
- **Repairs are read directly from `Repair`/`RepairPart`, exactly once.** `computeRevenueProfit`
  never touches `Invoice`, so a repair and its `REPAIR`-source invoice can never both be counted.
- **`Invoice.paidAmount` reconciles exactly with the payment ledger** for every invoice that has
  ledger rows — verified all five, gap 0.00 on each.
- **Ageing includes `REPAIR`-source invoices** correctly, and correctly uses `Invoice.paidAmount`
  rather than the ledger (see Q4 — the ledger would *miss* walk-ins here).
- **Restocked returns re-enter at the consumed cost** (verified in S23).

---

# Part A — unambiguous bugs

## A1 — *Critical* — a partially-returned sale is dropped in full, not reduced

**Reports affected:** every revenue/profit figure in the module — Overview, Filtered cards,
revenue chart, orders chart, sales-by-family chart, top products, `sales-by-product`,
`sales-by-client`, `sales-by-category`, `sales-by-seller`.

**File / functions:** `Apps/api/src/modules/statistics/statistics.service.ts` — every query that
filters `status: 'COMPLETED'`:

| Function | Line |
|---|---|
| `computeRevenueProfit` (family path) | 330 |
| `computeRevenueProfit` (document path) | 362 |
| `productLineTotals` | 405 |
| `chartDailyRevenue` (both paths) | 474, 508 |
| `chartSalesByFamily` | 570 |
| `reportSalesByClient` | 645 |
| `reportSalesByCategory` | 704 |
| `reportSalesBySeller` | 813 |

`SaleStatus` is `DRAFT | COMPLETED | RETURNED | PARTIALLY_RETURNED | CANCELLED`
(`schema.prisma:67`). `sales.service.ts` `createReturn` flips the sale to `RETURNED` or
`PARTIALLY_RETURNED` and **changes nothing else** — `totalAmount`, `totalProfit` and every
`SaleLine` keep their original gross values.

So a customer returning one small item out of a large sale does not reduce that sale's contribution
by the returned line — **it removes the entire sale from every report.** The module never reads
`Return` or `ReturnLine` at all (grep-verified: neither appears anywhere in
`statistics.service.ts`).

### Worked example — live data

Two sales in the dev database are `PARTIALLY_RETURNED`:

| Sale | `totalAmount` | `totalProfit` | Returned line | Line revenue | Line profit |
|---|---|---|---|---|---|
| SAL-2026-0002 | 24 800.00 | 9 200.00 | 1 × Charger Connector Lg V10 | 1 800.00 | 800.00 |
| SAL-2026-0003 | 28 300.00 | 13 300.00 | 1 × Charger Connector Lg V10 | 1 800.00 | 800.00 |

| | SAL-2026-0002 | SAL-2026-0003 |
|---|---|---|
| **Correct** revenue (gross − returned) | 24 800 − 1 800 = **23 000.00** | 28 300 − 1 800 = **26 500.00** |
| **Correct** profit | 9 200 − 800 = **8 400.00** | 13 300 − 800 = **12 500.00** |
| **Reported today** | **0.00** | **0.00** |

Store-wide, Overview → Total Revenue / Total Profit:

| | Reported today | True | Gap |
|---|---|---|---|
| Revenue | 93 000 (3 sales) + 23 500 (order) + 13 100 (repairs) = **129 600.00** | 93 000 + 23 000 + 26 500 + 23 500 + 13 100 = **179 100.00** | **−49 500.00 (−27.6 %)** |
| Profit | 44 000 + 9 500 + 7 800 = **61 300.00** | 44 000 + 8 400 + 12 500 + 9 500 + 7 800 = **82 200.00** | **−20 900.00 (−25.4 %)** |

A **full** return (`RETURNED`) currently yields 0 revenue, which happens to be the right answer —
but by accident of the same filter, not by design. `OrderStatus.RETURNED` behaves identically.

### Secondary effect — gross quantities

Even with the status filter corrected, `productLineTotals` (line 401) sums `SaleLine.quantity`
with no reference to `ReturnLine.quantity`, so **top products** and **sales-by-product** would
report units *sold* rather than units *kept*. In the example above the Charger Connector would
still show 2 units sold and 3 600.00 revenue that was refunded.

### Proposed fix

Include `PARTIALLY_RETURNED` and `RETURNED` in the recognised set, and subtract the returned
contribution. Two viable shapes — **Q1 is the owner's choice**:

1. **Compute at read time.** Join `ReturnLine → SaleLine` and subtract returned
   `quantity × unitPrice` from revenue and the proportional `profit`. No schema change; every
   report pays the join.
2. **Stamp net totals on the `Sale` at return time**, inside the return transaction under the row
   lock (the money-cache pattern hard rule 6 already mandates elsewhere). Reports stay simple; needs
   new columns (e.g. `returnedAmount`, `returnedProfit`) and the ripple prisma → contract → mapper.

Whichever is chosen, apply it identically to orders (`OrderStatus.RETURNED`) and to
`productLineTotals`' quantities.

---

## A2 — *High* — the last day of every date range is silently dropped

**Reports affected:** `getFiltered` (the Filtered cards), all four charts, and every report that
takes a range.

**File / function:** `statistics.service.ts` › `dateRangeFilter` (line 433), consumed by
`computeRevenueProfit` (359), `productLineTotals` (402), `getReport` (165) and every report method;
plus the inline `lte: to` in `countRecognizedOrders` (392), `chartDailyRevenue` (474, 508),
`chartDailyOrderCounts` (540) and `chartSalesByFamily` (570).

`ReportQuery.to` / `FilteredQuery.to` are `z.iso.date()` — a bare `YYYY-MM-DD`. `new Date('2026-08-04')`
is **`2026-08-04T00:00:00.000Z`**, and the filter is `lte` against that instant. Everything that
happened *during* the final day is therefore excluded.

The frontend makes this hit every user, every time: `generateDateRangeData`
(`Apps/web/src/lib/date-utils.ts:39`) returns `endDate: now`, and `AdminStatistics.tsx:42` sends
`toISODate(now)` — so **the current day's sales, orders and repairs never appear in any filtered
figure or chart.**

### Worked example — live data

Sales on 2026-08-04: SAL-2026-0004 at `09:17:32` (40 000.00) and SAL-2026-0005 at `09:18:00`
(20 000.00).

| Range end sent | Predicate produced | Rows matched | Revenue |
|---|---|---|---|
| `2026-08-04` (today, as the UI sends it) | `soldAt <= 2026-08-04T00:00:00Z` | **0** | **0.00** |
| Correct (exclusive next-day bound) | `soldAt < 2026-08-05T00:00:00Z` | **2** | **60 000.00** |

### Proposed fix

The codebase already contains the correct pattern — `inventory.service.ts` › `listMovements`
(line 439) builds `toExclusive = new Date(new Date(query.to).getTime() + 86_400_000)` and filters
`lt: toExclusive`. Apply the same in `dateRangeFilter` and at the four inline chart call sites, so
`to` becomes an exclusive next-midnight bound.

Note this also affects `getFiltered`'s previous-period window (`prevTo = from`, line 77), where the
current and previous ranges currently share the boundary instant.

---

## A3 — *High* — reservations are reported as stock movement

**Report:** `stock-movements`.
**File / function:** `statistics.service.ts` › `reportStockMovements` (lines 888–909).

```ts
const groups = await this.prisma.stockMovement.groupBy({
  by: ['type'],
  ...(createdAtFilter ? { where: { createdAt: createdAtFilter } } : {}),
  _sum: { quantity: true },
  _count: { _all: true },
});
```

No `direction` filter, so all eleven `MovementType` values are eligible — including the three
PENDING types, which move no stock at all.

### Worked example — live data

Actual rows the report returns today:

| type | direction | count | Σ quantity |
|---|---|---|---|
| SUPPLIER_INVOICE | IN | 2 | +9 |
| INITIAL_STOCK | IN | 11 | +61 |
| ADJUSTMENT_IN | IN | 1 | +1 |
| RETURN_IN | IN | 2 | +2 |
| SALE | OUT | 10 | −13 |
| ORDER_OUT | OUT | 2 | −2 |
| REPAIR_CONSUMPTION | OUT | 2 | −2 |
| **PENDING_ORDER** | **PENDING** | **4** | **+5** ← must not appear |
| **PENDING_REPAIR** | **PENDING** | **2** | **+2** ← must not appear |
| **PENDING_RELEASE** | **PENDING** | **5** | **−6** ← must not appear |

An admin reading "total stock in" off this report sees **+73 + 7 reserved units** presented on the
same footing. Reservations also make the report's implicit in/out balance meaningless: real stock
in is +73, real out is −17, but three phantom rows sum to +1.

### Proposed fix

Add `direction: { in: ['IN', 'OUT'] }` to the `where`. The `ADJUSTMENT_OUT` shrinkage flag and the
chart's `Math.abs` need no change.

---

## A4 — *High* — every report's `totals` is computed and never displayed

**Reports:** all nine.
**Files:** `Apps/contract/src/modules/statistics/statistics.dtos.ts:27` (`totals` in
`ReportResponseSchema`); `Apps/web/src/pages/admin/statistics/components/report-picker.tsx`
(renders `report.data.chart` and `report.data.rows` only).

Grep-verified: the string `totals` does not appear anywhere under
`Apps/web/src/pages/admin/statistics/` or in `useStatistics.ts`.

Discarded figures include:

| Report | Unrendered totals |
|---|---|
| `repairs` | `recognizedRevenue`, `recognizedCost`, `recognizedProfit` — **the only D8-correct money in the report** (see A5) |
| `sales-by-product` / `-client` | `totalRevenue` |
| `sales-by-category` / `-seller` | `totalRevenue`, `totalDiscount` |
| `supplier-spend` | `totalSpend` |
| `ageing` | `totalClientOutstanding`, `totalSupplierOutstanding` |
| `stock-movements` | `movementTypeCount` |
| `client-browsing` | `topSearchCount`, `zeroPurchaseProductCount` |

### Worked example

Select **Repairs** in the report picker on live data. The table shows one row: `PICKED_UP`,
count 2, totalAmount 13 100.00, revenue 13 100.00, cost 5 300.00, profit 7 800.00. The
`recognized*` totals — the figures the service deliberately computes on the correct `pickedUpAt`
basis — are in the payload and invisible. When A5 is fixed the two will *differ*, and the user will
be shown only the wrong one.

### Proposed fix

Render `totals` as a footer row or a small summary strip above the table in `report-picker.tsx`,
reusing `REPORT_COLUMN_KEY` for labels (adding the missing total keys) and the money formatter
from A8. New translation keys required.

---

## A5 — *Medium* — the repairs report mixes two date bases

**Report:** `repairs`.
**File / function:** `statistics.service.ts` › `reportRepairs` (lines 916–951).

```ts
const intakeAtFilter = this.dateRangeFilter(range);
const groups = await this.prisma.repair.groupBy({
  by: ['status'],
  ...(intakeAtFilter ? { where: { intakeAt: intakeAtFilter } } : {}),   // ← dated by INTAKE
  _sum: { totalAmount: true, totalCost: true, totalProfit: true },
});
const rows = groups.map((g) => ({
  ...
  revenue: g.status === REPAIR_RECOGNIZED_STATUS ? (g._sum.totalAmount?.toNumber() ?? 0) : 0,  // ← money, on the intake basis
  ...
}));
const pickedUpAtFilter = this.dateRangeFilter(range);
const recognized = await this.prisma.repair.aggregate({
  where: { status: REPAIR_RECOGNIZED_STATUS, ...(pickedUpAtFilter ? { pickedUpAt: pickedUpAtFilter } : {}) },  // ← dated by PICKUP
  ...
});
```

The function's own comment describes the intended split (a workload view by intake, a money view by
pickup), but the **rows carry money too**, computed on the intake basis. D8 says repair revenue is
recognised at `PICKED_UP` — so the row figure contradicts the recorded rule and the report's own
totals.

### Worked example

A repair taken in on 28 July for 9 000.00 and picked up on 3 August. Report range **1–31 August**:

| Figure | Basis | Value |
|---|---|---|
| `rows[PICKED_UP].revenue` | `intakeAt` in range → repair excluded | **0.00** |
| `totals.recognizedRevenue` | `pickedUpAt` in range → repair included | **9 000.00** |

The same report shows 0.00 and 9 000.00 for the same money. (Both live repairs happen to have
`intakeAt` = `pickedUpAt`, so this cannot be reproduced on current test data without creating a
repair that spans a range boundary — see §6.)

### Proposed fix

Keep the workload rows on `intakeAt`, but either (a) drop `revenue`/`cost`/`profit` from the rows
entirely and let `totals.recognized*` be the single money answer, or (b) compute the row money on a
`pickedUpAt` basis. Whichever is chosen, rename the row's `totalAmount` column so it cannot be read
as recognised revenue. Depends on A4 being fixed, or the money disappears from the UI entirely.

---

## A6 — *Medium* — the sales-by-family chart ignores the family filter

**Chart:** `SALES_BY_FAMILY`.
**File / function:** `statistics.service.ts` › `getChart` (line 110) → `chartSalesByFamily`
(line 567, signature `(from: Date, to: Date)` — no `familyId` parameter).

`AdminStatistics.tsx:53` passes the same `filterQuery` (including `familyId`) to all four charts.
Three honour it; this one silently drops it — the exact "validated and silently ignored" defect
S14/F1 was raised to eliminate.

The comment at lines 101–103 justifies it: *"SALES_BY_FAMILY needs no special-case (a familyId
would just collapse its own breakdown to one bar, which is already what happens today)"*. The
second clause is **factually wrong** — today the chart renders a bar for every family regardless of
the selection, which is the opposite of collapsing to one.

### Worked example

Select family **"Charger Connector"** in the filter. Revenue card, revenue chart and orders chart
all narrow to that family. The sales-by-family chart continues to show every family — Motherboard,
Display, Battery, Accessory — unchanged. Nothing tells the user the chart is unfiltered.

### Proposed fix

Either pass `query.familyId` through to `chartSalesByFamily` and filter on it (the chart then shows
a single bar, consistent with the rest of the page), or exclude that chart from the filter
deliberately and label it *"all families"*. Correct the comment either way (hard rule 4).

---

## A7 — *Medium* — "purchased" ignores document status in client-browsing

**Report:** `client-browsing` ("most-viewed products with zero purchases").
**File / function:** `statistics.service.ts` › `reportClientBrowsing` (lines 1048–1055).

```ts
this.prisma.saleLine.findMany({ select: { productId: true }, distinct: ['productId'] }),
this.prisma.orderLine.findMany({ select: { productId: true }, distinct: ['productId'] }),
this.prisma.repairPart.findMany({ select: { productId: true }, distinct: ['productId'] }),
```

No `where` at all. Every other read in the module gates on `COMPLETED` / `PICKED_UP`; these three
do not. A product is therefore treated as "purchased" if it merely appears in:

- a **DRAFT** sale that was never rung up,
- a **CANCELLED** sale,
- a **PENDING**, **CONFIRMED**, **CANCELLED** or **CANCELLED_BY_CLIENT** order,
- a repair part on a repair that was cancelled before pickup.

Since the report exists precisely to surface products that get looked at but never bought, this
removes the most interesting entries from it.

### Worked example — live data

`ORD-2026-0002` is `CANCELLED_BY_CLIENT` (3 600.00). Its product was never sold, yet it is in
`purchasedSet`, so if a client had viewed it the product would be excluded from
"viewed but never purchased" — the single case the report is designed to catch.

### Proposed fix

Apply the module's own recognised-status filters:
`sale: { status: 'COMPLETED' }`, `order: { status: { in: ORDER_RECOGNIZED_STATUSES } }`,
`repair: { status: REPAIR_RECOGNIZED_STATUS }`. Keep the deliberate absence of a *date* filter
("ever purchased" is a lifetime fact — the existing comment at 1030–1031 is correct and should
stay).

---

## A8 — *Medium* — report money columns show no currency and ignore the language

**Reports:** all nine (frontend).
**File / function:** `Apps/web/src/pages/admin/statistics/components/report-picker.tsx` ›
`formatCellValue` (lines 44–48).

```ts
if (typeof value === "number") return value.toLocaleString();
```

Two defects in one line: no currency, and `toLocaleString()` with **no locale argument**, so the
output follows the browser rather than the app's selected language. This is exactly the bug S14/F5
fixed in `admin-statistics-overview-cards.tsx` and `admin-statistics-filtered-cards.tsx` — the
report table was missed.

Affected columns: `revenue`, `cost`, `profit`, `discount`, `resolvedRevenue`, `spend`,
`totalAmount`, `clientOutstanding`, `supplierOutstanding`.

### Worked example

`sales-by-client` for the live data renders **`23,500`** where every other money render in the app
shows **`23 500,00 DA`** (`formatDZD`). In an Arabic or French session the separators do not change
with the language.

### Proposed fix

Give `report-columns.ts` a money-field set beside `REPORT_COLUMN_KEY`, and in `formatCellValue`
route those keys through `formatDZD(value, language)` (the function already needs the column key
passed in). Non-money numbers (`count`, `quantity`, `movementCount`, `viewCount`) keep integer
formatting but should still take `language`.

---

## A9 — *Medium* — client-browsing renders only one of its two row shapes

**Report:** `client-browsing` (frontend).
**Files:** `statistics.service.ts` › `reportClientBrowsing` (line 1070) returns
`rows: [...topSearches, ...mostViewedNoPurchase]` — a union of two shapes:

```ts
{ kind: 'search',           query, count }
{ kind: 'viewedNoPurchase', productId, productName, viewCount }
```

`report-picker.tsx` (line 72) builds columns from **`Object.keys(rows[0])`** only.

### Worked example

With at least one search logged, `rows[0]` is a search row, so the table has columns
`kind | query | count`. Every "viewed but never purchased" row then renders with an empty `query`
and empty `count` — its `productName` and `viewCount` are in the payload but have no column. With
no searches logged, the reverse happens and the search rows vanish.

### Proposed fix

Either split the payload into two tables in the UI (cleanest — they are two different reports
sharing an endpoint), or derive columns from the union of all row keys. If the shape changes,
`ReportResponseSchema.rows` stays `z.record(...)` so no contract change is needed.

---

## A10 — *Medium* — sales-by-category computes revenue on a different basis from every other report

**Report:** `sales-by-category`.
**File / function:** `statistics.service.ts` › `reportSalesByCategory` (lines 699–803).

Three inconsistencies inside one report:

1. **Document discount ignored.** Revenue is accumulated as `unitPrice × quantity` per line
   (lines 742, 761). `Sale.totalAmount` is `subtotal − discountAmount` (`schema.prisma`), so a sale
   with a document-level discount is reported at its *pre-discount* value here while
   `sales-by-client` and `sales-by-seller` (which use `sale.totalAmount`) report it net.
   *(No live example — `discountAmount` is 0.00 on all five test sales — but the divergence is
   structural, not data-dependent.)*
2. **Delivery fee excluded**, unlike `sales-by-client`. See Q2 for the worked figure.
3. **Repairs contribute revenue but not quantity.** The repair loop (lines 770–781) adds
   `totalAmount` to `revenue` and `resolvedRevenue` but never touches `existing.quantity`, so a
   category row can show 23 000.00 of revenue against 4 units when repairs are involved. The
   quantity column silently means "sale + order units only".

### Proposed fix

Pick one revenue basis for the whole module (Q2 decides which) and apply it here; either count
repair parts into `quantity` or rename the column to make its scope explicit.

---

## A11 — *Low* — the ageing report ignores the date range the UI sends

**File / function:** `statistics.service.ts` › `reportAgeing()` (line 982) — takes **no**
`range` parameter, unlike every other report method; `buildReport` (line 616) calls it without one.
`report-picker.tsx:62` nonetheless sends `from`/`to` for every report type.

The snapshot semantics are **correct** — outstanding balances are a point-in-time fact and ageing
is measured against `now`. The defect is that the UI presents a live filter that provably cannot
affect the result, which is the same "the dropdown changed the query key and refetched identical
numbers" complaint S14/F1 recorded.

### Proposed fix

Hide or disable the date range when `AGEING` is selected, with a short note that ageing is measured
as of today. No backend change.

---

## A12 — *Low* — top-selling products ignores both page filters

**File:** `Apps/web/src/pages/admin/statistics/AdminStatistics.tsx:54` — `useTopProducts({})`.

The widget is rendered between the filtered charts and the report picker, beneath the date-range
and family selectors, but is called with an empty query: `TopProductsQuery.period` is never sent
(so `resolvePeriodRange` returns `undefined` → all-time) and the type carries **no `familyId` at
all**. Changing either filter leaves the list identical.

### Proposed fix

Map the selected range to `period`, or — since `period` is a coarse `week|month|year` string that
cannot express an arbitrary range — extend `TopProductsQuerySchema` with `from`/`to`/`familyId` to
match `ChartsQuerySchema` and pass `filterQuery` straight through. Contract change; the owner may
prefer simply relabelling the widget "all time" and moving it above the filter bar.

---

## A13 — *Low* — overview card copy and placement

**Files:** `admin-statistics-overview-cards.tsx:29`; `translations.json`
→ `admin.statistics.overview.descriptions.totalRevenue` = *"Total revenue from all sales"*.

The figure is Σ completed sales **+ completed orders + picked-up repairs**, and repairs no longer
produce a `Sale` at all — so "from all sales" is now actively misleading. The same applies to
`totalProfit` ("Total profit after costs").

Separately, the whole Overview block is **all-time** (`getOverview` takes no range) yet is rendered
*above* the date-range filter in `AdminStatistics.tsx:95`, which reads as though it responds to it.

### Proposed fix

Reword both description keys (e.g. *"All-time revenue from sales, orders and repairs"*) and either
move the block below the filter with an explicit "all time" caption, or leave the position and make
the caption carry the meaning. Translation-key change only.

---

# Part B — semantic questions for the owner

These change what a figure *means*. Not resolved here.

### Q1 — How should returns net out?

A1 establishes that the current behaviour is wrong. The correction is a choice:

- **(a) Read-time netting** from `ReturnLine → SaleLine`. No schema change; every revenue query
  gains a join.
- **(b) Net totals cached on the document**, written inside the return transaction under the row
  lock (the pattern hard rule 6 already requires for money caches). Reports stay simple; needs new
  columns and the full prisma → contract → mapper → hook ripple.

Sub-questions: should a **fully** returned sale render as a zero row or disappear? Should returned
**quantity** be netted out of top-products and sales-by-product (today it would not be)? Should an
`EXCHANGE`-type return net the same way as a `REFUND`?

### Q2 — Is the delivery fee revenue?

Today the module answers both ways:

| Path | Basis | ORD-2026-0003 |
|---|---|---|
| `computeRevenueProfit` unfiltered (367), `reportSalesByClient` (669), `reportSalesBySeller` (844), `chartDailyRevenue` unfiltered (525) | `Order.totalAmount` — **includes** the 500.00 fee | **23 500.00** |
| `computeRevenueProfit` family path (337), `reportSalesByCategory` (761), `chartSalesByFamily` (574) | line totals — **excludes** it | **23 000.00** |

So `sales-by-client` and `sales-by-category` disagree by exactly the fee over the same period, and
selecting a family changes total revenue by the fee. The fee also carries **no cost**, so counting
it as revenue inflates profit one-for-one. The existing comment (lines 321–324) calls the asymmetry
deliberate — but it leaves two reports unable to tie out, which the owner should confirm is
acceptable or fix.

### Q3 — Is repair labour revenue in per-product dimensions?

Same shape as Q2. Unfiltered figures use `Repair.totalAmount` (labour + parts); the family path and
`chartSalesByFamily` use `RepairPart` lines only.

REP-2026-0001: `totalAmount` 4 100.00 = `labourPrice` 2 500.00 + `partsTotal` 1 600.00. Selecting
any family drops the 2 500.00 of labour — and S13 recorded that **labour is pure profit**, so the
family-filtered profit loses proportionally more than the revenue.

### Q4 — Walk-in payments have no ledger row

Verified on live data — invoices with a non-zero `paidAmount` and **zero** `ClientPayment` rows:

| Invoice | Source | `paidAmount` | Ledger rows |
|---|---|---|---|
| FAC-2026-0001 | SALE | 33 000.00 | none |
| FAC-2026-0003 | REPAIR | 4 100.00 | none |
| FAC-2026-0006 | REPAIR | 9 000.00 | none |

**46 100.00 of genuinely collected cash is invisible to the client-payment ledger** — correctly so,
since a walk-in has no `PosClient` to attribute it to.

Statistics currently has **no payments report at all** (grep-verified: `clientPayment` appears
nowhere in `statistics.service.ts`), so nothing is being dropped today. But the rule must be settled
before one is built, because the two available sources answer different questions:

- **Σ ledger** — correct for *per-client* payment history and for refunds (negative rows), misses
  every walk-in.
- **Σ `Invoice.paidAmount`** — correct for *cash collected*, includes walk-ins, and was verified to
  reconcile exactly with the ledger wherever ledger rows exist (gap 0.00 on all five).

The existing `reportAgeing` already uses `Invoice.paidAmount`, which is the right choice for that
report for precisely this reason — it must **not** be "corrected" to the ledger.

### Q5 — `sales-by-client` excludes walk-ins

`reportSalesByClient` filters `posClientId: { not: null }` for sales/repairs and skips orders whose
client was never approved as a `PosClient` (line 667). Defensible for a per-client report, but its
`totals.totalRevenue` then can never equal Overview revenue — on live data it omits SAL-2026-0001
(33 000.00) and both walk-in repairs. Should the report carry an explicit "walk-in / unattributed"
bucket, or a caption stating the exclusion?

### Q6 — `salesCount` counts orders and repairs

`reportSalesByCategory` increments `salesCount` once per sale (737), once per order (756) and once
per repair (774). The column header is *"Sales count"*. Rename to "Documents", or split into three
columns?

### Q7 — staff attribution is inconsistent between two views

`getStaffDashboard` (line 285) counts only `Sale` rows for `mySalesToday` / `myRevenueToday`, while
`reportSalesBySeller` (line 853) credits a staff member with the revenue of every repair they moved
to `PICKED_UP`. The same person's work is measured two different ways. Should the staff dashboard
include repairs they picked up (and orders they completed)?

---

## 5. Interaction with S23

`getOverview().stockValue` (line 58) is the **only** consumer of `avgStockPrice` in the entire
statistics module — confirmed by grep, the column appears at lines 50, 55 and 58 and nowhere else.

- With S23's fix landed, that figure moves from **441 041.66** to **448 600.00** on current data as
  each product sees its next OUT. **This is a value change, not a defect — no S24 fix is required
  for it.**
- More importantly, the isolation cuts the other way: because no revenue, cost or profit figure
  anywhere in the module reads `avgStockPrice`, **S23's drift cannot have distorted any P&L
  number.** The brief's "confirm no report re-derives cost from `avgStockPrice`" is satisfied.
- Every cost and profit figure reads a stored snapshot — `SaleLine.costOfGoods/profit`,
  `OrderLine.costOfGoods/profit`, `RepairPart.costOfGoods/profit`,
  `Sale/Order/Repair.totalCost/totalProfit`. That separation is correct and must be preserved by
  any fix arising from A1.

---

## 6. How the owner can reproduce these findings

Read-only; nothing here changes data.

1. **A1 (the big one).** *Admin → Statistics* → note **Total Revenue**. Then run:
   ```sql
   SELECT status, COUNT(*), SUM("totalAmount"), SUM("totalProfit") FROM "Sale" GROUP BY status;
   ```
   Two `PARTIALLY_RETURNED` sales worth **53 100.00** (22 500.00 profit) are absent from the card,
   against only **3 600.00** actually refunded. Open either sale in the back office — it still shows
   its full original total, and its returned line is still listed.

2. **A2.** Set the range to **This Month** and note the Filtered revenue card. Ring up a sale in the
   POS **today**, refresh, and observe the card does not move. Change the range to include tomorrow
   and it appears.

3. **A3.** *Admin → Statistics → Reports → Stock movements.* Rows for `PENDING_ORDER`,
   `PENDING_REPAIR` and `PENDING_RELEASE` are listed alongside real movements.

4. **A4.** Select **Repairs**. The `recognizedRevenue`/`recognizedCost`/`recognizedProfit` totals
   are in the API response (check the network tab) but appear nowhere on screen.

5. **A5.** Needs data that current test data lacks: take in a repair, then pick it up in a later
   month. Set the range to the **pickup** month — the `PICKED_UP` row shows 0.00 revenue while
   `totals.recognizedRevenue` (network tab, until A4 lands) shows the full amount.

6. **A6.** Pick any family in the filter. The revenue and orders charts narrow; **Sales by family**
   does not change at all.

7. **A7.** *Reports → Client browsing.* Any product that only ever appeared in a draft or cancelled
   document is missing from "viewed, never purchased".

8. **A8/A9.** *Reports → Sales by client* — money columns read `23,500`, not `23 500,00 DA`. Then
   *Reports → Client browsing* — one of the two row groups renders with empty cells.

9. **A12.** Change the date range or family and watch **Top selling products** stay identical.

---

## Status

**Audit complete. No code changed. Stopping here for the owner's decisions**, per the S24 brief.

**A1 is the finding that matters** — it is understating reported revenue by 27.6 % and profit by
25.4 % on the current data set, and it will worsen with every return taken. A2 and A3 are
independent of it and each cheap to fix. A4–A13 are correctness and presentation defects that can
be planned as one pass.

The fix plan needs **Q1 answered first** (it determines the shape of A1's fix and touches the most
files); **Q2 and Q3** should be settled in the same sitting, since together they decide the single
revenue definition the whole module should use. Q4–Q7 can be deferred without blocking a fix set.
