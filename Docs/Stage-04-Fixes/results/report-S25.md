# Report — Set 25: Receipt printing & document exports (+ repair receipt)

Executed against `Docs/Stage-04-Fixes/plans/plan-S25-receipts-and-exports.md` on `version-1-2`,
2026-08-12. Covers the plan's §A–§K in full, including §K (the repair receipt) folded into this
same plan on owner request after the rest was written.

## What changed

### Contract (`Apps/contract`)
- **New `common/exports.ts`** — `EXPORT_MAX_ROWS` (5000) and `EXPORT_ERROR.ROW_LIMIT_EXCEEDED`,
  shared by every server-rendered export. Barrel-exported from `index.ts`.
- **`statistics.enums.ts`** — `ReportFormat` gains `PDF = 'pdf'`.
- **`inventory.query.ts`** — `StockQuerySchema.export` widened from `z.literal('csv')` to
  `z.enum(['csv', 'pdf'])`; `MovementsQuerySchema` gains `export: z.enum(['csv', 'pdf']).optional()`
  (new — no export existed on this schema before this set).
- **`platform.query.ts`** — `FeesExportQuerySchema.format` gains `'pdf'`.
- **`platform.dtos.ts`** — `PublicSettingsResponseSchema` gains the `store` block
  (`name`/`address`/`phone`/`logoUrl`), field-for-field identical to `SettingsResponseSchema.store`.
  Rationale in the schema comment: these four fields are already printed on every invoice PDF
  handed to a customer, so exposing them on the public/staff-reachable endpoint discloses nothing
  new. `invoicing`/`delivery` remain internal.

### Backend (`Apps/api`)
- **New `common/utils/csv.utils.ts`** — one RFC 4180 writer (`toCsv`/`toCsvSection`) for every CSV
  export: UTF-8 BOM, CRLF, proper `""`-doubling, `csvMoney` (2dp), `csvDate` (`YYYY-MM-DD HH:mm`
  UTC). `CSV_EOL` is exported (a small addition beyond the plan's literal export list) so the
  statistics totals-block can insert the same blank-line separator without re-declaring the
  literal.
- **`common/utils/pdf.utils.ts`** — new `renderTablePdf(data: TablePdfData)`: title block +
  filters + generated-at, an optional plain bar chart (skipped when empty/all-zero), a paginated
  table with a repeated header band and fixed-height rows (`lineBreak:false` + `ellipsis` — the
  comment flags this as load-bearing for the pagination arithmetic), an optional totals strip, and
  page numbers stamped in a `bufferedPageRange()` second pass. Reuses the file's existing
  `toBuffer`; no second PDF library.
- **`modules/platform/platform.mapper.ts`** — `toPublicSettingsDto` now carries `store`.
- **`modules/platform/platform.service.ts`** `exportFees` — CSV branch now routed through
  `toCsv`/`csvMoney`; new `pdf` branch (portrait, wilaya/commune **names** not codes — the CSV/
  Excel branches keep codes because they round-trip through the importer).
- **`modules/inventory/inventory.service.ts`** — `getStock`'s CSV branch rewritten onto
  `toCsv`/`csvMoney`; new `pdf` branch (landscape, 9 columns). `listMovements` gained a full export
  branch (`csv`/`pdf`, unpaginated, capped at `EXPORT_MAX_ROWS + 1` rows to detect the ceiling) —
  this export did not exist before this set. The paginated-branch's label-resolution + mapping
  logic was extracted into a shared `toMovementDtos` helper so the paginated and export branches
  can never drift apart; a shared `MOVEMENT_INCLUDE` const keeps both Prisma reads on the identical
  relation shape. `assertExportSize` guards both `getStock` and `listMovements`.
- **`modules/inventory/inventory.interface.ts`** — `listMovements` return type widened to
  `PaginatedResult<MovementDto> | ExportResult`.
- **`modules/inventory/inventory.controller.ts`** — `listMovements` gained the same
  `'body' in result` streaming branch `getStock` already had.
- **`modules/statistics/statistics.service.ts`** — `toCsvExport` rewritten: headers are now the
  union of every row's keys in first-seen order (was `rows[0]` only — the same class of bug S24/A9
  fixed on the frontend), escaping goes through `toCsv` instead of `JSON.stringify` (which
  backslash-escaped an inner quote where CSV needs `""`), and `totals` is now appended after a
  blank line as a `Total,Value` block (previously `totals` was never exported at all — the repairs
  report's only D8-correct money lived exclusively there). New `toPdfExport` mirrors the same
  column-union logic; `ReportType.AGEING` gets a "point-in-time snapshot" note instead of a date
  range (S24/A11).

### Frontend (`Apps/web`)
- **New `components/shared/ExportMenu.tsx`** — one dropdown (`@/components/ui/dropdown-menu`) used
  by all four export surfaces.
- **`services/inventory.service.ts`** — `exportStockCsv()` → `exportStock(query, format)` (now
  sends the table's actual `search`/`lowStockOnly`, fixing a real bug: the old function sent no
  filters at all, so "Export" after filtering to low-stock-only still downloaded the whole
  catalogue). New `exportMovements(query, format)`.
- **`services/statistics.service.ts`** — `exportReportCsv` → `exportReport(type, query, format)`.
- **`hooks/useInventory.ts`** — `useExportStockCsv` → `useExportStock`; new `useExportMovements`.
- **`hooks/useStatistics.ts`** — `useExportReportCsv` → `useExportReport`.
- **`lib/query-client.ts`** — `SENTINEL_TRANSLATION_KEYS` gained
  `EXPORT_ERROR.ROW_LIMIT_EXCEEDED` → `common.errors.sentinel.exportRowLimitExceeded`.
- **`pages/admin/settings/components/delivery-fees-section.tsx`** — the single Export button (which
  sent no `format`, so the backend defaulted to `excel` and the file was saved as
  `delivery-fees.csv` — a real bug: Excel warned on open) replaced with `ExportMenu` (CSV / Excel /
  Excel-reused-key / PDF), each saving under its matching extension.
- **`pages/admin/inventory/components/stock-levels-table.tsx`** — `onExportCsv` prop →
  `onExport(format)`; single button → `ExportMenu`.
- **`pages/admin/inventory/components/movement-ledger-table.tsx`** — gained an export toolbar
  (`ExportMenu`) where none existed before.
- **`pages/admin/inventory/AdminInventory.tsx`** — wires both; the movement export query mirrors
  the ledger table's own filters minus `page`/`limit`, so the export is always the whole filtered
  set, never the visible page.
- **`pages/admin/statistics/components/report-picker.tsx`** — single "Export CSV" button →
  `ExportMenu` (CSV/PDF).
- **New `lib/print.ts`** — `printReceipt()`/`RECEIPT_ROOT_CLASS`, shared by the POS receipt and the
  repair receipt: injects a scoped `<style>` for `@page { size: 80mm auto }` (which cannot be
  selector-scoped) for the duration of one print, toggles `body.printing-receipt`, tears down on
  `afterprint` with a 60s safety-net timeout.
- **`index.css`** — new `@media print` block (the file had none — S22 removed the last one),
  gated entirely on `body.printing-receipt` so `/staff/sales` Reprint and `/staff/invoices` Print
  keep today's whole-page A4 behaviour untouched. `.receipt-print-root { display:none }` at all
  times, flipped to `display:block` only inside the gated print rule — `visibility:visible` alone
  cannot reveal a `display:none` element, so this is load-bearing (a receipt root hidden by
  `display` and revealed only by `visibility` would print a blank page).
- **`pages/staff/pos/components/PosReceiptView.tsx`** — rewritten to render two subtrees: the
  existing on-screen card (now with a lines list above the money rows) and a print-only 80mm
  receipt (store header, reference, timestamp, lines, the five money rows unchanged, "thank you"
  footer). No barcode.
- **`pages/staff/pos/StaffPos.tsx`** — `onPrint={() => window.print()}` → `onPrint={printReceipt}`;
  new `receiptAt` state captured once at confirm-success (not derived at render, since the receipt
  view stays mounted until "New sale"); wires `usePublicSettings()` for the store header.
- **`pages/staff/repairs/repair-status-labels.ts`** — gained `REPORTED_ISSUE_LABEL_KEY`, moved out
  of `IntakeDialog.tsx` (previously module-private) so `RepairReceipt.tsx` can reuse the same map.
- **`pages/staff/repairs/components/IntakeDialog.tsx`** — imports the moved map instead of
  declaring its own.
- **New `pages/staff/repairs/components/RepairReceipt.tsx`** — print-only, one layout with
  conditional sections (parts only if any exist, labour only if `> 0`, IMEI only if captured,
  device/diagnosis/technician only if present, invoice number only if picked up). Renders **no**
  `totalCost`/`totalProfit`/`part.costOfGoods`/`part.profit` — the component takes no `scope` prop
  at all, so there is nothing to branch on and the margin leak is structurally impossible. The paid
  stamp (`PAID`/`PARTIALLY PAID`/`UNPAID`) guards `totalAmount > 0` so a fresh zero-total INTAKE
  ticket reads UNPAID, not PAID. No barcode.
- **`pages/staff/repairs/components/RepairTicketDetail.tsx`** — new **Print receipt** button in the
  sheet header (sibling of the title, outside every `!readOnly` guard — printable at every status
  including PICKED_UP/CANCELLED); `<RepairReceipt>` rendered as a **sibling of `<Sheet>`**, not
  inside `<SheetContent>` — Radix animates `SheetContent` with a `transform`, which would become
  the containing block for the receipt's `position:absolute` print rule and print it clipped.
- **`pages/staff/repairs/StaffRepairs.tsx`** — wires `usePublicSettings()` and passes `store` to
  `RepairTicketDetail`. `AdminRepairs.tsx` needed no change — it is exactly
  `<StaffRepairs scope="admin" />`, so the button and receipt appear on `/admin/repairs` for free.
- **`config/translations.json`** — 35 new keys (`common.actions.export`/`exporting`,
  `common.errors.sentinel.exportRowLimitExceeded`, 8 export-menu labels across the four surfaces,
  4 POS-receipt keys, 23 repair-receipt keys under `staff.repairs.receipt.*`). Every existing key
  this set could reuse was reused (`admin.settings.delivery.exportExcel`,
  `admin.inventory.stock.exportCsv`, `admin.statistics.reports.exportCsv`, all 5
  `staff.repairs.board.*` status labels, all 9 `staff.repairs.intake.issue.*` labels, the 8
  existing `staff.pos.receipt.*` keys) — none orphaned, none duplicated.

## Deviations from the plan

- **Three planned translation keys were not added** because nothing in the final implementation
  references them: `common.export.csv`/`common.export.pdf` (the plan's own "for any future
  surface" generic pair — every actual consumer ended up using its own namespaced key instead) and
  `staff.pos.receipt.item` (no column-header row exists in the shipped receipt layout, matching how
  `RepairReceipt`'s parts block also has no header row). Adding them would have been dead keys;
  left out rather than shipped unused.
- **`csv.utils.ts` exports `CSV_EOL`**, which the plan's §B1 export list didn't name explicitly
  (only `CSV_SEPARATOR` and `CSV_MIME` were marked `export`). `statistics.service.ts`'s totals
  block needed the same CRLF the plan's own prose says to insert ("append CSV_EOL + …"), so this is
  the plan's intent made literal rather than a deviation from it.
- **Bug found and fixed mid-build in the plan's own §C3 CSS spec**: the plan's `.receipt-print-root`
  masking rule used only `visibility`, with no explicit `display` toggle for the root itself.
  `visibility:visible` cannot reveal a `display:none` element — as written it would have printed a
  blank page on both receipts. Caught before implementation by re-deriving the CSS from first
  principles; the shipped rule adds `display:none` at all times and `display:block` inside the
  gated print rule, with a comment flagging the dependency. The plan document text was not amended
  (out of scope for an execution pass) — flagging here for the owner's record.
- Everything else matches the plan's file list, function shapes, and layout constants as specified.

## A note on `listMovements`'s widened return type

`inventory.interface.ts`'s `listMovements` moved from `Promise<PaginatedResult<MovementDto>>` to
`Promise<PaginatedResult<MovementDto> | ExportResult>` — the same dual-return shape `getStock`
already had. This is a legitimate, necessary consequence of adding the export branch, and it
surfaces as 5 new compile errors in `test/unit/modules/inventory/inventory.service.spec.ts` (reads
`.items`/`.meta` off the result without narrowing `'items' in result` first). **No test file was
edited** per the standing rule — confirmed via a true pre-S25 baseline (see validation gate below)
that this is the *only* new test-file fallout from the entire set; every other test-file error
already existed before this session touched anything.

## Validation gate (no test file read, edited, or run)

A true pre-S25 baseline was captured via `git stash` / `tsc --noEmit` / `git stash pop` for both
`Apps/api` and `Apps/web`'s test tsconfig, so "new vs. pre-existing" below is measured, not
asserted.

| Package | `tsc --noEmit` | lint |
|---|---|---|
| `Apps/contract` | clean | clean (all 6 touched files) |
| `Apps/api` | `src/**` clean (0 `error TS` lines). Full run: 184 errors, all in `test/**`, all pre-existing baseline noise **except the 5 `listMovements` lines above** (baseline: 179, confirmed via stash) | clean (all 8 touched/new files) |
| `Apps/web` | App `tsc --noEmit` clean. `-p tsconfig.test.json`: 47 errors, all in `tests/**`; baseline (via stash) was 41 — the **6 new lines are the `exportStockCsv`→`exportStock`/`useExportStockCsv`→`useExportStock`/`exportReportCsv`→`exportReport`/`useExportReportCsv`→`useExportReport` renames**, confirmed by name in the diff, not new logic errors | 12 real `prettier/prettier` findings surfaced on first pass (all mechanical multi-line-object formatting in code this set wrote), fixed via `eslint --fix`, re-verified clean on all 19 touched/new files, and `tsc --noEmit` re-run clean after the fix |

No test file was read, edited, or run at any point.

## Manual verification checklist (browser)

Reproduced from the plan's §J and §L for the reviewer's convenience — 51 steps total.

### POS receipt — 80 mm

1. `/staff/pos` as STAFF: ring up a sale with **three lines**, one of them a serialised product,
   confirm it. The on-screen receipt card now lists the three lines above the five money rows, and
   the five rows read exactly as before.
2. Click **Print** → the print preview shows a **narrow single-column receipt**, roughly 80 mm
   wide, with no page margins and **no sidebar, header or navigation**.
3. The receipt top carries the **store name, address and phone from Settings → Store**, and the
   logo if one is configured.
4. It carries the **sale reference** and a **date/time**, then the three lines (name, then
   `qty × price` and line total), then the five money rows in today's order, then "Thank you for
   your visit".
5. **No barcode anywhere on the receipt.**
6. Change the store name in `/admin/settings` → Store, return to the POS, print a new receipt →
   the new name appears.
7. Print on the actual thermal printer: the content fits the roll without truncation on the right,
   and the paper advances past the tear bar.

### Print regression — the other two buttons are untouched

8. `/staff/sales` → **Reprint** on a sale → prints the **whole A4 page** exactly as it did before
   this set (not an 80 mm strip).
9. `/staff/invoices` → **Print** on an invoice → same: whole A4 page, unchanged.
10. `Ctrl+P` on `/admin/products` with nothing open → the page prints normally on A4.
11. Print a POS receipt, close the dialog, then immediately `Ctrl+P` on the same page → **A4
    again**, not 80 mm.

### Delivery fees

12. `/admin/settings` → Delivery fees → **Export** now opens a menu with **CSV, Excel, PDF**.
13. **Excel** → downloads `delivery-fees.xlsx` (was `.csv` with XLSX content — the bug) and opens
    in Excel without a format warning.
14. **CSV** → downloads `delivery-fees.csv`; opening it in Excel shows **accented wilaya names
    correctly** (not `Ã©`), one value per column.
15. **PDF** → downloads `delivery-fees.pdf`: portrait, title "Delivery fees", "Filters: none", a
    generation timestamp, wilaya and commune **names** (not codes), and `Page 1 / N` at the foot of
    every page. Scroll to page 2 → the **header row repeats**.

### Stock levels

16. `/admin/inventory` → Stock tab: type a search that matches a handful of products, and tick
    **Low stock only**.
17. **Export → CSV** → the file contains **only the filtered rows**, not the whole catalogue.
18. Give a product a name containing a comma and a double quote (e.g. `Écran "OLED", 6.5"`), then
    export → that name occupies **one column**, quotes intact, columns not shifted.
19. **Export → PDF** → landscape, nine columns, the title block lists `Search: …` and
    `Low stock only: Yes`, and the row count matches the filtered table.

### Movement ledger — new

20. `/admin/inventory` → Movements tab: filter by a product, a movement type and a date range.
21. The toolbar now has an **Export** menu (it had none before).
22. **CSV** → `movements.csv` containing **every** matching movement, not just page 1.
23. Clear the filters and export again → the row count grows accordingly.
24. **PDF** → `movements.pdf`: landscape, the title block naming the product, type and date range
    **by name** (not a UUID), repeated header row, page numbers.
25. Confirm the ledger export contains **no reservation rows appearing as stock in/out** beyond
    what the on-screen table shows.

### Statistics reports

26. `/admin/statistics`: set a date range, pick **Sales by client**.
27. **Export → CSV** → open in Excel: a client name containing a double quote renders correctly in
    one cell.
28. Pick **Client browsing** (the two-row-shape report) and export CSV → the header row contains
    the columns of **both** shapes, and neither group's cells are blank.
29. Pick **Repairs** and export CSV → after the rows there is a blank line and a **Totals** block
    carrying recognised revenue, cost and profit.
30. **Export → PDF** on Sales by product → the PDF opens with the **bar chart** at the top, the
    table below, the totals block after it, the date range in the title block, and page numbers.
31. Pick **Ageing** and export PDF → the title block says the report is a **point-in-time
    snapshot** and does **not** print a date range.

### Row ceiling

32. With more than 5000 movements in the database, export the ledger with no filters → a toast
    reads "This export is too large. Narrow the filters and try again.", **no file downloads**.
33. Apply a date filter that brings it under 5000 → the export succeeds.

### Permissions

34. As a **STAFF** user, `/admin/inventory`, `/admin/statistics` and `/admin/settings` remain
    unreachable, and `GET /admin/inventory/movements?export=csv` with a staff token answers
    **403**.
35. As a STAFF user the POS receipt still prints with the full store header. `GET
    /platform/settings` (the admin one) still answers **403** to that same token.

### Repair receipt

36. `/staff/repairs` → open a ticket at **INTAKE** (no parts, no labour set yet) → the detail
    sheet header now shows a **Print receipt** button.
37. Click it → the print preview shows a **narrow 80 mm receipt**: store header, "Repair ticket",
    the reference in large monospace, the intake date, status **Intake**, the customer's name and
    phone, and the device with its IMEI if one was captured.
38. That same INTAKE preview shows **no parts block** and **no labour row**, and the paid stamp
    reads **UNPAID** — not "PAID", even though paid and total are both zero.
39. Move the ticket to **PROCESSING**, add **two parts** and set a **labour price**. Print again →
    both parts appear with `qty × price` and line totals, the **Labour** row appears with the
    price you set, and the totals read parts total + labour = total.
40. Set the labour price back to **0** and print → the **Labour row disappears** entirely.
41. Record a **partial** payment → the stamp reads **PARTIALLY PAID** and an **Amount due** row
    shows the remainder. Record the rest → the stamp reads **PAID** and the row is gone.
42. Take the ticket to **PICKED_UP** → the print button is **still there**, the receipt prints with
    status **Picked up**, and an **Invoice no.** row appears.
43. **CANCELLED** ticket → the print button is still present and the receipt still prints.
44. A ticket for a device with **no IMEI** → the IMEI row is absent, not an empty label. Same for
    a ticket with no diagnosis and no technician.
45. A ticket whose device has **only a free-text label** (no brand/model refs) → the device row
    shows that label rather than a blank.
46. Reported issues print as **translated labels** ("Charging", "Display"), never raw enum values
    like `water-damage`. Tick **Other** with free text at intake → the free text appears.
47. **Margin leak check.** As **ADMIN**, open `/admin/repairs`, open a ticket with parts, confirm
    the on-screen sheet **does** show per-part profit. Print → the receipt shows **no profit, no
    cost, anywhere**.
48. Switch language to **FR** and print → every label is French, including the status, the
    reported issues and the paid stamp.
49. **Print scoping regression:** with the repair sheet open, press **Ctrl+P** → the browser prints
    the normal A4 page, and the receipt does **not** appear anywhere in it.
50. Print a repair receipt, close the dialog, then print a **POS** receipt → both come out
    correctly at 80 mm and neither bleeds into the other.
51. Print on the actual thermal printer: the ticket fits the roll with no right-hand truncation,
    long product names wrap rather than clip, and the paper advances past the tear bar.
