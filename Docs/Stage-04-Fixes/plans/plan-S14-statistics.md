# Plan S14 — Statistics

Execution plan for **set 14** of `Docs/Stage-04-Fixes/app-issues-01.md`.
Closes **RC-5**, restores repairs as a direct revenue source (**D8**/**D9**), confirms **D2** and
**D10**, and audits the statistics stack end to end.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

| Set | What S14 consumes from it | Verified present |
|---|---|---|
| **S1** | `Product.avgStockPrice`, `InvoiceSource.REPAIR`, `Sale.origin` deleted | ✅ `statistics.service.ts:40,48` already reads `avgStockPrice` |
| **S10** | Orders recognised at `COMPLETED` only, `Order.totalCost/totalProfit` stamped there, `deliveredAt` as the recognition timestamp | ✅ `statistics.service.ts:22-25`, `:302-311` |
| **S13** | `Repair.totalCost` / `Repair.totalProfit` / `Repair.pickedUpAt` stamped at `PICKED_UP`, and `Repair.totalProfit = totalAmount − totalCost` (S13/R4) | ⚠️ **S14 cannot be executed before S13.** Every repair figure this set reads is written by S13's pickup transaction. |

> The programme's dependency graph lists S14 as needing S1 only. That was written before S13's
> shape was known. **Execute S13 first**, and confirm S13's R4 (labour counts as profit) landed —
> without it, `revenue − cost ≠ profit` for every repair and this set's totals will not reconcile.

### 0.2 Owner decision taken while planning (settled — do not re-open)

**R1 — the per-dimension reports read sales **+ picked-up repairs + completed orders.**

Before D9, a picked-up repair created a `REPAIR`-origin `Sale` (the deleted
`sales.service.ts#recordRepairSale`), so repairs fed `sales-by-product`, `sales-by-client`,
`sales-by-seller`, `sales-by-family` and `top-products` through `SaleLine`. S1 removed that Sale;
those reports silently lost repairs. Orders were **never** in them, even though they have always
counted toward the headline revenue figure.

The owner's decision: fold in **both**. After this set, every per-dimension report and chart reads
the same three revenue-recognising documents the headline figure does:

| Document | Recognised when | Timestamp | Lines |
|---|---|---|---|
| `Sale` | `status = COMPLETED` | `soldAt` | `SaleLine` |
| `Order` | `status = COMPLETED` (D2) | `deliveredAt` | `OrderLine` |
| `Repair` | `status = PICKED_UP` (D8) | `pickedUpAt` | `RepairPart` (+ labour, see §0.4) |

**This is the invariant of the whole set. Every query in `statistics.service.ts` must be checked
against it, not just the ones named below.**

### 0.3 RC-5 — root cause, confirmed

Every chart colour in the app is written `hsl(var(--primary))`. This project's design tokens are
**bare OKLCH channel triplets** (`index.css:16` → `--primary: 0.552 0.228 260.9;`), consumed
everywhere else as `oklch(var(--primary))`. `hsl(0.552 0.228 260.9)` is not a valid colour, so the
declaration is dropped and the SVG element falls back to its initial value — an invisible stroke, a
default fill. Recharts' own defaults for axes, grid and tooltip are then left untouched and are
tuned for a light page.

Eight occurrences, in five files (`grep -rn "hsl(var(" Apps/web/src`):

- `pages/admin/statistics/components/charts/revenue-chart.tsx:58`
- `pages/admin/statistics/components/charts/clients-chart.tsx:57`
- `pages/admin/statistics/components/charts/orders-trend-chart.tsx:50`
- `pages/admin/statistics/components/charts/sales-by-family-chart.tsx:16-20` (five)
- `pages/admin/statistics/components/report-picker.tsx:164`

`components/ui/chart.tsx` is unreferenced shadcn boilerplate — leave it alone.

### 0.4 Two figures this plan defines — flag them in the report

| # | Definition | Why |
|---|---|---|
| **D-a** | **A repair's labour is a product-less line.** In per-*product* dimensions (`sales-by-product`, `sales-by-family`, `top-products`) a repair contributes only its `RepairPart` rows — labour has no product and is skipped. In per-*document* dimensions (`sales-by-client`, `sales-by-seller`, `sales-by-category`, the revenue chart, the headline totals) a repair contributes its full `totalAmount`, labour included. Consequence: `Σ sales-by-product.revenue ≤ Σ sales-by-client.revenue`, by exactly the labour billed. **Say this in the report** — a reader comparing two report totals will otherwise think one is broken. |
| **D-b** | **An order has no seller.** `Order.confirmedByStaffId` is the staff who *confirmed* it, not who sold it, and it is nullable. In `sales-by-seller`, orders land in a single `UNASSIGNED_SELLER_BUCKET` row rather than being attributed to the confirmer. A repair's seller is the `staffId` on its `PICKED_UP` `RepairStatusHistory` row — the same signal the deleted `recordRepairSale` used (`lastHistory.staffId`). |

### 0.5 Drift found while reading — beyond what the issue text names

| # | Finding | Action |
|---|---|---|
| **F1** | **`getFiltered` and `getChart` accept `familyId` and ignore it.** `statistics.service.ts:59-63` documents this as a deliberate simplification. The page has a live Family dropdown (`AdminStatistics.tsx:53-59, 100-102`) that changes the query key, refetches, and returns identical numbers. That is a broken control, not a simplification. | Action 2.7 |
| **F2** | **`ReportPicker`'s `groupBy` text input is dead.** `ReportQuerySchema.groupBy` is validated and never read by `buildReport` or any report method. The user types into a box that does nothing. | Action 3.4 |
| **F3** | **`DRILL_ROUTES` doesn't match what the reports emit.** `report-picker.tsx:33-37` maps `product`/`client`/`supplier`. The service emits `product`, `posClient`, `clientCategory`, `staff`, `stockMovement`, `repair`, `invoice`, `supplier` — **never `client`**. So `sales-by-client` rows have never been clickable, and the `client` entry is dead. | Action 3.5 |
| **F4** | **Report table headers are raw field names.** `report-picker.tsx:69` sets `header: key`, so the admin sees `posClientId`, `resolvedRevenue`, `movementCount`. Violates the "all user-facing text through `t()`" rule. | Action 3.3 |
| **F5** | **`admin-statistics-filtered-cards.tsx:54-61` hardcodes `Intl.NumberFormat("en-US", …)`.** The sibling overview-cards file takes a `locale` parameter, and the app has `formatDZD(value, language)` in `lib/utils`. In French or Arabic the filtered cards format wrongly. | Action 3.6 |
| **F6** | **`reportClientBrowsing`'s "viewed but never purchased" set reads `SaleLine` only** (`statistics.service.ts:756`). A product bought through an order or fitted in a repair is reported as never purchased. Same class of drift as R1. | Action 2.6 |
| **F7** | **`reportRepairs` dates on `intakeAt` and sums `totalAmount` across every status**, cancelled repairs included, with no cost or profit column. Under D8 a repair's money exists only at `PICKED_UP`. | Action 2.5 |
| **F8** | **Confirmed already correct — verify, do not change.** `getOverview`'s `stockValue` reads `avgStockPrice` (D10 ✅, `:40,48`); `ORDER_RECOGNIZED_STATUSES = ['COMPLETED']` with `deliveredAt` dating (D2 ✅, `:22-25`); `reportSalesByCategory` groups by client pricing tier, not product family (audit fix A1 ✅, `:514-519`); `getTopProducts` carries brand/family/image (audit fix B4 ✅, `:135-145`). Say so explicitly in the report — the brief asks for confirmation. |
| **F9** | **`reportAgeing` needs no change.** Repair invoices now land in `Invoice` with `sourceType = REPAIR`, and the ageing query filters on status alone, so they are already included. Verify, do not edit. |
| **F10** | **`FilteredDto.orders` stays an order count.** With sales and repairs now in the same revenue figure, the "orders" card next to it counts only `Order` rows. Leave the number alone; the label is already `admin.statistics.filtered.orders`. Note it in the report so nobody "fixes" it later. |

---

## §1 — Contract (`Apps/contract`)

**No schema change is required by this set.** `ReportResponseSchema.rows` is
`z.array(z.record(z.string(), z.unknown()))` and `totals` is an open record, so new report columns
need no contract edit. `TopProductResponseSchema` lives in `statistics.mapper.ts` (a deliberate
non-contract local — see its own comment at `:32-39`) and only gains values, not fields.

**One optional addition**, if Action 3.3 is implemented as recommended: a shared
`REPORT_COLUMN_KEYS` map belongs in the frontend (`Apps/web/src/pages/admin/statistics/`), not the
contract — the column set is a rendering concern, and the keys are `t()` keys, which are a web-side
concept. Do **not** put it in `Apps/contract`.

---

## §2 — Backend (`Apps/api/src/modules/statistics/statistics.service.ts`)

All of §2 is in one file. Work top to bottom.

### Action 2.1 — recognition constants and shared row readers

Beside the existing `ORDER_RECOGNIZED_STATUSES` (`:25`), add:

```ts
// D8/D9 (S13) — a repair recognises revenue, cost and profit together at PICKED_UP, and produces
// no Sale row at all. Every figure below that used to arrive through the deleted REPAIR-origin
// Sale is now read directly off Repair, dated on pickedUpAt.
const REPAIR_RECOGNIZED_STATUS = 'PICKED_UP' as const;

// D-b — orders have no owning seller (confirmedByStaffId is who confirmed, not who sold, and is
// nullable). They aggregate into one bucket in sales-by-seller rather than being mis-attributed.
const UNASSIGNED_SELLER_BUCKET = 'Unassigned';
```

Then add three private readers, used by every method below so the recognition rule is written once:

```ts
  // R1 — the three revenue-recognising documents, in one place. Each returns plain numbers so the
  // callers can aggregate without repeating the status/date/Decimal handling.
  private async recognizedSales(range) { … Sale, status COMPLETED, soldAt in range … }
  private async recognizedOrders(range) { … Order, status COMPLETED, deliveredAt in range … }
  private async recognizedRepairs(range) { … Repair, status PICKED_UP, pickedUpAt in range … }
```

Give each a `select` broad enough for its consumers (`lines`/`parts` included where a per-line
dimension needs them) and let the callers project.

### Action 2.2 — `computeRevenueProfit` (`:312-331`) — fold in repairs

Add a third aggregate:

```ts
      this.prisma.repair.aggregate({
        where: { status: REPAIR_RECOGNIZED_STATUS, ...(pickedUpAtFilter ? { pickedUpAt: pickedUpAtFilter } : {}) },
        _sum: { totalAmount: true, totalProfit: true },
      }),
```

and sum it into both the revenue and the profit return values.

**Rewrite the `:302-311` comment block.** It currently ends with *"until then this query
under-counts total revenue by however much came from repairs, which is the documented regression
(plan S1 §0.5)"* — that regression is closed here and the sentence must go.

**Double-counting check (the brief asks for it explicitly):** a picked-up repair produces
an `Invoice` (`sourceType = REPAIR`), never a `Sale` and never an `Order`. `computeRevenueProfit`
reads `Sale`, `Order` and `Repair` — never `Invoice`. So each document is counted exactly once.
State this reasoning in the report.

Three local variables named `soldAtFilter`/`deliveredAtFilter` at `:313-314` are the *same*
expression computed twice; collapse them to one `filter` while you are in there.

### Action 2.3 — charts

**`chartDailyRevenue` (`:374-394`)** — add a repairs query (`pickedUpAt` in range) and bucket
`totalAmount` by `pickedUpAt`'s day, alongside the existing sale and order loops.

**`chartSalesByFamily` (`:419-432`)** — currently `SaleLine` only. Add:
- `OrderLine` where `order.status = COMPLETED` and `order.deliveredAt` in range, joined to
  `product.family.name`;
- `RepairPart` where `repair.status = PICKED_UP` and `repair.pickedUpAt` in range, same join.

Labour is excluded here by D-a (no product ⇒ no family). Add that as a comment.

**`chartDailyOrderCounts` / `chartDailyNewClients`** — no change (they count orders and clients,
not revenue). Confirm and say so.

### Action 2.4 — the per-dimension reports (R1)

**`getTopProducts` (`:113-158`)** and **`reportSalesByProduct` (`:466-488`)** share a shape: build
`Map<productId, {name, quantity, revenue}>` from `SaleLine`, then rank/emit. Extend both with
`OrderLine` and `RepairPart` rows over the same recognition windows. `RepairPart`'s name column is
`productNameSnapshot` (same as `SaleLine`/`OrderLine`) — the three merge cleanly.

Because the two methods now build the same map from the same three sources, **extract one private
helper** (`private async productLineTotals(range): Promise<Map<string, {productName, quantity, revenue}>>`)
and have both call it. `getTopProducts` then ranks, slices to 10 and joins brand/family/image;
`reportSalesByProduct` emits every row. This is the "fix the root cause once" instruction applied
literally — do not copy the three queries into two places.

**`reportSalesByClient` (`:490-512`)** — add:
- `Order` where `status = COMPLETED`, `deliveredAt` in range, joined through
  `client.posClientId` → `PosClient.name`. Orders whose client was never approved (no
  `posClientId`) are skipped, exactly as the existing query skips `posClientId: null` sales;
- `Repair` where `status = PICKED_UP`, `pickedUpAt` in range, `posClientId` not null, contributing
  its full `totalAmount` (D-a).

**`reportSalesBySeller` (`:587-624`)** — add:
- `Repair`, seller = the `staffId` on its `PICKED_UP` `RepairStatusHistory` row. Read those rows in
  one query (`where: { repairId: { in: [...] }, toStatus: 'PICKED_UP' }`) and map them, rather than
  a per-repair `findFirst`. Discount contribution is 0 (a repair has no `resolvedPrice`);
- `Order`, all into `UNASSIGNED_SELLER_BUCKET` (D-b), `staffId: null` in the row so the drill link
  is correctly absent. Discount = `Σ (resolvedPrice − unitPrice) × quantity` over `OrderLine` —
  orders **do** carry both prices (D11), so the discount column is meaningful for them.

**`reportSalesByCategory` (`:521-585`)** — add orders (which carry `resolvedPrice` and `unitPrice`,
so every column including `discount` is well-defined) and repairs (`resolvedRevenue = revenue`,
`discount = 0` — a repair has no tier-resolved price). The client tier for an order comes from
`client.posClient.category`, for a repair from `posClient.category`; both fall into the existing
`NO_CATEGORY_BUCKET` when absent. Keep `salesCount` as a **document** count and rename its comment
accordingly — it now counts sales + orders + repairs.

### Action 2.5 — `reportRepairs` (`:649-665`) (F7)

Rewrite so the workload view and the money view are both correct and visibly separate:

- rows stay grouped by `status`, dated on `intakeAt` (a workload report: how many tickets came in);
- each row gains `revenue`, `cost`, `profit` — **zero for every status except `PICKED_UP`**, since
  D8 recognises nothing earlier and a cancelled repair recognises nothing at all;
- `totals` gains `recognizedRevenue`, `recognizedCost`, `recognizedProfit`, computed over repairs
  whose **`pickedUpAt`** falls in the range — a deliberately different date basis from the rows,
  which must be stated in a comment on the method and surfaced in the column labels (Action 3.3).

### Action 2.6 — `reportClientBrowsing` (`:740-778`) (F6)

`purchasedLines` (`:756`) becomes the union of distinct `productId` over `SaleLine`, `OrderLine`
(completed orders) and `RepairPart` (picked-up repairs). A product fitted in a repair or shipped in
an order is purchased and must leave the "viewed, never bought" list.

The `distinct: ['productId']` query deliberately carries **no date filter** today (the set is
"ever purchased", not "purchased in range"); keep that, and add a comment saying it is intentional
so the next reader doesn't take it for an omission.

### Action 2.7 — `familyId` actually filters (F1)

`FilteredQuery.familyId` and `ChartsQuery.familyId` must scope the numbers they are given.

- **`getFiltered`** — when `familyId` is set, revenue and profit are computed from **lines** whose
  `product.familyId` matches, not from document totals: `Σ lineTotal` and `Σ profit` over
  `SaleLine` + `OrderLine` + `RepairPart` in the recognition windows. Order-level `deliveryFee` and
  repair `labourPrice` are excluded when a family is selected — they belong to no family.
  Document the asymmetry in a comment: *"unfiltered = document totals (delivery fees and labour
  included); family-filtered = line totals only."*
- **`orders`** (the count) — when `familyId` is set, count completed orders **having at least one
  line in that family**.
- **`chartDailyRevenue`** — same line-level treatment when `familyId` is present.
- **`chartSalesByFamily`** — when `familyId` is present the breakdown collapses to one bar; that is
  correct, leave it.
- **`chartDailyOrderCounts` / `chartDailyNewClients`** — clients have no family; order counts
  follow the "at least one line in that family" rule. Comment the clients chart as intentionally
  family-agnostic.

Delete the "Simplification, not a blocking gap" comment at `:59-63` — it is no longer true.

### Action 2.8 — the mapper

`statistics.mapper.ts` needs no new shapes: every new report column rides `ReportDto.rows`'
open record. **Check `TopProductRow`'s `averagePrice`** — `toTopProductDto` derives it; confirm it
still divides by the merged quantity, not the sale-only quantity, after Action 2.4.

---

## §3 — Frontend (`Apps/web`)

### Action 3.1 — `src/lib/chart-theme.ts` *(new file)* — RC-5's single fix

One module, one hook, literal OKLCH colours mirroring `index.css`'s `:root` and `.dark` blocks.
Literals rather than `var()` references, because Recharts writes these as SVG presentation
attributes and browser support for `var()` there is not something to bet a whole page on.

```ts
import { useTheme } from "next-themes";

// RC-5 — every chart used `hsl(var(--primary))`, but this project's tokens are bare OKLCH
// channel triplets consumed as `oklch(var(--x))` (index.css). `hsl(0.552 0.228 260.9)` is not a
// colour: the declaration was dropped and the element fell back to its initial value, which is
// why the charts read as blank. Values below are the literal equivalents of index.css's :root
// and .dark tokens — keep them in step with that file.
export interface ChartTheme {
  series: string[];   // categorical palette, in order
  axis: string;       // tick labels
  grid: string;       // cartesian grid lines
  tooltipBg: string;
  tooltipFg: string;
  tooltipBorder: string;
}

const LIGHT: ChartTheme = {
  series: [
    "oklch(0.552 0.228 260.9)",  // --primary
    "oklch(0.623 0.169 149.2)",  // --success
    "oklch(0.786 0.16 85.3)",    // --warning
    "oklch(0.636 0.208 25.4)",   // --destructive
    "oklch(0.55 0.023 264.4)",   // --muted-foreground
  ],
  axis: "oklch(0.55 0.023 264.4)",
  grid: "oklch(0.928 0.006 264.5)",
  tooltipBg: "oklch(0.992 0 89.9)",
  tooltipFg: "oklch(0.242 0.012 264.3)",
  tooltipBorder: "oklch(0.928 0.006 264.5)",
};

const DARK: ChartTheme = { … the .dark values, same order … };

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}
```

Take the dark values from `index.css:56-80` (`--primary: 0.587 0.208 260`, `--success: 0.735 0.201 149`,
`--warning: 0.838 0.165 87.5`, `--destructive: 0.667 0.185 23.6`, `--muted-foreground: 0.719 0.009 264.5`,
`--border: 0.271 0.017 264.2`, `--card: 0.188 0.01 264.3`, `--foreground: 0.977 0.001 264.5`).

`next-themes` is already the app's theme source (`components/providers/ThemeProvider.tsx`,
`attribute="class"`, `enableSystem={false}`) — `resolvedTheme` is the right field, not `theme`.

### Action 3.2 — apply the theme to all five chart files

In each of `revenue-chart.tsx`, `clients-chart.tsx`, `orders-trend-chart.tsx`,
`sales-by-family-chart.tsx` and `report-picker.tsx`:

1. `const chart = useChartTheme();`
2. series colour → `chart.series[0]` (`sales-by-family-chart.tsx`'s `COLORS` array becomes
   `chart.series`, and its module-level `const COLORS` is deleted);
3. `<CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />` — **drop `className="opacity-30"`**,
   which was compensating for an uncontrolled default;
4. `<XAxis tick={{ fontSize: 12, fill: chart.axis }} stroke={chart.grid} />`, same for `<YAxis>`;
5. `<Tooltip contentStyle={{ background: chart.tooltipBg, color: chart.tooltipFg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8 }} itemStyle={{ color: chart.tooltipFg }} labelStyle={{ color: chart.tooltipFg }} />`;
6. `sales-by-family-chart.tsx`'s `<Legend />` → `<Legend wrapperStyle={{ color: chart.axis }} />`,
   and its `<Pie label>` → `label={{ fill: chart.axis }}`.

After this, `grep -rn "hsl(var(" Apps/web/src` must return **zero** hits outside test files.

### Action 3.3 — translated report columns (F4)

New `src/pages/admin/statistics/report-columns.ts`:

```ts
// F4 — report rows are open records (ReportDto.rows), so their column headers were rendered as
// raw field names. One map per report type, field name -> translation key; a field with no entry
// falls back to its own name so a new backend column never breaks the table.
export const REPORT_COLUMN_KEY: Record<string, string> = {
  productId: "admin.statistics.reports.columns.productId",
  productName: "admin.statistics.reports.columns.productName",
  quantity: "admin.statistics.reports.columns.quantity",
  revenue: "admin.statistics.reports.columns.revenue",
  …
};
```

A single flat field-name map is enough — the field names are already consistent across reports
(`revenue`, `quantity`, `cost`, `profit`, `discount`, `status`, `count`, …). In `report-picker.tsx`,
line 69's `header: key` becomes
`header: () => t(REPORT_COLUMN_KEY[key] ?? key)` with the fallback returning the raw key.

Enumerate the full field set by reading every `rows` shape in `statistics.service.ts` **after**
§2 lands — the new columns from Actions 2.4/2.5 must be in the map.

### Action 3.4 — remove the dead `groupBy` input (F2)

Delete the `groupBy` state, the `<Input>` at `report-picker.tsx:128-132` and `groupBy` from
`reportQuery`. Leave `ReportQuerySchema.groupBy` and the service signature untouched — the same
"remove from the UI only" treatment S7 applied to save-draft. The remaining `<Select>` no longer
needs the two-column grid; give it the full width.

### Action 3.5 — fix `DRILL_ROUTES` (F3)

```ts
const DRILL_ROUTES: Record<string, (id: string) => string> = {
  product: (id) => `/admin/products/${id}`,
  supplier: (id) => `/admin/suppliers/${id}`,
  // `client` was never emitted by any report (the service emits `posClient`) — the entry was dead.
  // There is no per-POS-client detail route, so posClient/clientCategory/staff/repair/
  // stockMovement/invoice render as plain text, same scope-confinement rule as AdminLogsTable.
};
```

Verify `/admin/products/:id` and `/admin/suppliers/:id` still exist in `App.tsx` before keeping them.

### Action 3.6 — locale-correct currency in the filtered cards (F5)

`admin-statistics-filtered-cards.tsx` — delete the local `formatCurrency` (`:54-61`) and use
`formatDZD(value, language)` from `@/lib/utils` with `language` from `useTranslation()`, matching
every other money render in the app. Check whether `admin-statistics-overview-cards.tsx:60` has the
same problem while you are there (it takes a `locale`, so it is probably fine — confirm the caller
actually passes one).

### Action 3.7 — translations (`src/config/translations.json`)

Flat dotted keys → `{ en, fr, ar }` with `ar: ""`. Add, at minimum:

| Key | en |
|---|---|
| `admin.statistics.reports.columns.productId` | Product ID |
| `admin.statistics.reports.columns.productName` | Product |
| `admin.statistics.reports.columns.quantity` | Quantity |
| `admin.statistics.reports.columns.revenue` | Revenue |
| `admin.statistics.reports.columns.cost` | Cost |
| `admin.statistics.reports.columns.profit` | Profit |
| `admin.statistics.reports.columns.discount` | Discount |
| `admin.statistics.reports.columns.resolvedRevenue` | Revenue at list price |
| `admin.statistics.reports.columns.clientName` | Client |
| `admin.statistics.reports.columns.categoryName` | Client category |
| `admin.statistics.reports.columns.salesCount` | Documents |
| `admin.statistics.reports.columns.staffName` | Seller |
| `admin.statistics.reports.columns.supplierName` | Supplier |
| `admin.statistics.reports.columns.spend` | Spend |
| `admin.statistics.reports.columns.status` | Status |
| `admin.statistics.reports.columns.count` | Count |
| `admin.statistics.reports.columns.totalAmount` | Total |
| `admin.statistics.reports.columns.type` | Movement type |
| `admin.statistics.reports.columns.totalQuantity` | Total quantity |
| `admin.statistics.reports.columns.movementCount` | Movements |
| `admin.statistics.reports.columns.flagged` | Flagged |
| `admin.statistics.reports.columns.bucket` | Age bucket |
| `admin.statistics.reports.columns.clientOutstanding` | Client outstanding |
| `admin.statistics.reports.columns.supplierOutstanding` | Supplier outstanding |
| `admin.statistics.reports.columns.query` | Search term |
| `admin.statistics.reports.columns.viewCount` | Views |
| `admin.statistics.reports.columns.kind` | Kind |
| `admin.statistics.reports.columns.posClientId` | Client ID |
| `admin.statistics.reports.columns.categoryId` | Category ID |
| `admin.statistics.reports.columns.staffId` | Seller ID |
| `admin.statistics.reports.columns.supplierId` | Supplier ID |

Extend the list to cover every field emitted after §2 — the fallback keeps an omission from
crashing, but a raw field name in the header is still a defect.

**Delete** `admin.statistics.reports.groupBy` once Action 3.4 removes its only consumer (grep first).

---

## §4 — Reconciliation the executor must perform by hand

Before writing the report, prove the numbers agree. With a small seeded dataset (one completed
sale, one completed order, one picked-up repair):

1. **No double-count:** the overview's `totalRevenue` equals `sale.totalAmount + order.totalAmount +
   repair.totalAmount` exactly — not more (the repair invoice is not counted a second time), not
   less.
2. **Nothing lost:** the repair's parts appear in `top-products` and `sales-by-family`; its total
   appears in `sales-by-client` and `sales-by-seller`.
3. **D-a holds visibly:** `Σ sales-by-product.revenue` is short of `Σ sales-by-client.revenue` by
   exactly the repair's `labourPrice` plus the order's `deliveryFee`.
4. **D2 holds:** move an order to `PACKAGED` — every revenue, profit and count figure is unchanged.
5. **D8 holds:** move a repair to `COMPLETED` — same, nothing moves until pickup.
6. **D10 holds:** the overview's `stockValue` equals `Σ quantityOnHand × avgStockPrice`, and
   changing a product's `avgPrice` (the unweighted figure) moves nothing.

Write the six results into the report as a table. This is the "verify nothing double-counts and
nothing is lost" instruction, discharged.

---

## §5 — Validation gate (D12)

No test file may be read, edited or run.

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npm run lint
```

`Apps/api`'s tsconfig includes `test/**`; filter to non-test paths and itemise remaining test
staleness per file (S5 precedent). `npm run lint` crashes rather than warns on real findings —
treat a crash as a finding.

Plus one grep gate: `grep -rn "hsl(var(" Apps/web/src` must return nothing outside test files.

---

## §6 — Manual verification checklist (browser)

### RC-5 — charts in both themes
1. `/admin/statistics` in **light** mode: the revenue line, the orders bars, the clients line and
   the sales-by-family pie are all **visible and coloured**.
2. Axis tick labels and grid lines are legible against the page background.
3. Hover any chart — the tooltip has a solid background with readable text.
4. Toggle to **dark** mode without reloading: every chart re-colours, nothing goes invisible, the
   tooltip stays readable.
5. The report chart under **Reports** behaves the same in both themes.

### Repairs as a revenue source (D8/D9)
6. Note the overview's Total revenue and Total profit.
7. Pick up a repair (S13 flow). Reload — revenue rose by the repair's **total** (parts **and**
   labour), profit by `total − cost`.
8. **Reports → Sales by product**: the repair's parts are listed.
9. **Reports → Sales by client**: the repair's client row includes the repair total.
10. **Reports → Sales by seller**: the staff member who performed the pickup carries the repair.
11. **Reports → Repairs**: the `PICKED_UP` row shows revenue, cost and profit; every other status
    row shows zeros.
12. **Sales by family** chart and **Top selling products**: the repair's parts contribute.
13. `/admin/invoices` — the repair's invoice exists exactly once, and revenue did **not** jump by
    twice the repair total.

### Orders at completion only (D2)
14. Move an order to `PACKAGED`. Reload `/admin/statistics` — **no** figure moved.
15. Complete it — revenue, profit and the orders count all move together.

### Stock valuation (D10)
16. Overview → Total product value tracks `avgStockPrice`. Post a positive stock adjustment at a
    unit cost different from the current average and confirm the figure follows the weighted
    average, not the unweighted one.

### Audit fixes
17. Change the **Family** filter — the filtered cards and the revenue chart **change** (they used
    to be inert, F1).
18. Reports: column headers read as words ("Product", "Revenue"), not `productId`/`revenue` (F4).
19. The `groupBy` text box is gone from the report card (F2).
20. **Sales by client** rows are not links (no per-POS-client page exists) but no longer render a
    broken link either (F3).
21. Switch the app to French — the filtered cards' currency formatting follows the language, like
    the overview cards (F5).
22. **Client browsing** report: a product that has only ever been sold through an **order** or
    fitted in a **repair** is no longer listed under "viewed, never purchased" (F6).

### Regression sweep
23. `/admin/dashboard` and `/staff/dashboard` still load, with revenue-this-month now including
    repairs.
24. CSV export from the report card still downloads and its header row matches the on-screen
    columns (the CSV keeps raw field names — headers are translated in the table only; confirm
    that is acceptable and note it in the report).
