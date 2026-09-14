# Report — Set 28: Inventory — pagination, per-product adjustment & PDF wrapping

Executed against
`Docs/Stage-04-Fixes/plans/plan-S28-inventory-pagination-adjust-dialog-pdf-wrapping.md` on
`version-1-3`, 2026-09-14. Independent of S27 — nothing here touches settings, the print logo, or
the receipt/label print path.

## Post-execution fix — the Save button silently did nothing when reprice was ticked early

The owner found the Adjust action's Save button did nothing (no toast, no visible error) and the
Adjustments tab's product search capped at 10 results even when more matched.

**Search cap** — `AutocompleteInput` (the shared picker) truncates its dropdown to
`maxSuggestions` (default 10) regardless of how many `suggestions` it's handed.
`use-adjustment-products.ts` fetches up to 20 server-matched products, but `adjustment-line-editor.tsx`
never overrode the default, so results past position 10 were fetched and then silently dropped
before rendering. Fixed by passing `maxSuggestions={20}` to match the hook's own `limit: 20`.

**Save button** — root-caused by reproducing the exact form-values shape RHF would produce and
running it through the real `adjustmentSchema`/`toCreateAdjustmentCommand` outside the browser (no
network access was available to drive an actual browser session). `repriceDraftSchema.categoryPrices`
was a **required** array, but `AdjustmentRepriceFields`' checkbox can be ticked before its async
prefill effect (which waits on the product's live prices via `useAdminCatalogProduct` /
`useAdjustmentProducts`) has populated it — leaving `lines[].reprice.categoryPrices` genuinely
`undefined` in form state at submit time. Zod rejected it, RHF's `handleSubmit` took the invalid
path, and nothing renders that nested error anywhere — so the button appeared completely inert.
Confirmed reproducible: `adjustmentSchema(...).safeParse(...)` failed on `reprice: { enabled: true }`
with no `categoryPrices`, and passed clean once `categoryPrices` was made `.optional()` (with
`toCreateAdjustmentCommand` defaulting a missing array to `[]`). This affects **both** the
Adjustments-tab line editor and the Stock-tab Adjust dialog, since both route through the same
shared schema — one fix covers both entry points.

Re-validated: `tsc --noEmit` and lint clean on both changed files
(`adjustment.schema.ts`, `adjustment-line-editor.tsx`).

## Summary

All four pieces of the plan landed as specified, in the plan's own dependency order
(contract → backend pagination → PDF wrapping → web service/hook → shared adjustment field
components → stock table + dialog → adjustments-tab search → translations):

1. **Stock levels pagination** — `StockQuerySchema` gained `page`/`limit` (default 1/20);
   `InventoryReadService.getStock` now returns `PaginatedResult<StockRowDto>` for the on-screen
   table and still returns a document for `export=csv|pdf`, unpaginated, capped at
   `EXPORT_MAX_ROWS`. `lowStockOnly` is resolved with a one-column raw-SQL id pre-query
   (`buildStockWhere`) fed back into the same Prisma `where`, exactly as planned — search,
   ordering, count, paging and export all stay on one code path.
2. **Per-product Adjust dialog** — a new `Adjust` column/button on the Stock levels table opens
   `StockAdjustDialog`, which carries the same reason/note/counted-quantity/delta/unit-cost/reprice
   functionality as the Adjustments tab, scoped to one product, posting through the exact same
   `useCreateAdjustment` → `POST /admin/inventory/adjustments` path.
3. **Reprice sub-form** — built once (`adjustment-reprice-fields.tsx`) and wired into **both** the
   new dialog and the existing Adjustments-tab line editor, closing the ADM-06 gap flagged in the
   plan's §0 and §14.1 (contract/backend already supported `lines[].prices`; no UI ever exposed
   it).
4. **Adjustments-tab product search** — the tab's picker now searches the whole catalogue
   server-side by name/barcode (`use-adjustment-products.ts`), replacing the capped
   `useAdminCatalogProducts({ page: 1, limit: 100 })` read.
5. **PDF cell wrapping** — `pdf.utils.ts`'s `drawTable`/`drawHeaderRow` now measure each row's
   height (`heightOfString`) and wrap cells instead of ellipsising them onto one fixed-height line;
   `deriveColumnWeights` gives the statistics reports content-derived column widths. All four S25
   export surfaces (stock, movement ledger, delivery fees, statistics) share this one renderer, so
   all four are fixed by the one change.

No product images, print logo, receipt, or label-print code was touched.

## Deviations from the plan

None of substance. Two small, plan-anticipated judgment calls:

- **§9.3's circular-dependency note.** The plan flagged that `useAdjustmentProducts`'s output feeds
  the zod resolver passed into `useForm`, while `useForm` is also the source of `watch()` needed to
  know which products are selected — and said "leave that behaviour as is" without spelling out the
  exact mechanism. Implemented as: `selectedProductIds` is plain `useState` (seeded with `[""]`,
  matching the form's own initial line), kept in sync with the form's actual `productId` values via
  a `useEffect` that only calls `setState` when the id list's *content* actually changed (not on
  every `watch()` call, which returns a new array identity each render). This avoids both the
  circular read and an infinite-render risk, and settles the resolver's data well before any
  blur/submit validation runs.
- **`admin.inventory.adjustment.productSearchPlaceholder`** replaced the old
  `admin.inventory.adjustment.product` ("Product") as the picker's placeholder text, since the
  field is now a live remote search rather than a static picker — the plan's translation table
  listed the new key without specifying exactly where it would be used. The old key is now unused
  but left in `translations.json` (not deleted — out of scope, and harmless).

## Test-file breakage (expected, not fixed — no-test-gate rule)

Per the Stage-04 programme rule, no test file was modified and no test suite was run. `getStock`'s
return type change and the removal of `useStock()`'s default-`{}` argument break exactly the files
the plan's §0 flagged, confirmed by diffing `tsc --noEmit` output with the change stashed out
against with it applied:

- `Apps/api/test/unit/modules/inventory/inventory.service.spec.ts` — 5 new errors, all inside
  `describe('getStock')` (lines ~650–680): the old array-returning shape is asserted directly, and
  two calls pass a query object without `page`/`limit`.
- `Apps/web/tests/integration/services/inventory.service.test.ts` — 1 new error: `getStock()`
  called with no arguments.
- `Apps/web/tests/integration/hooks/inventory.test.tsx` — 2 new errors: `useStock()` called with no
  arguments.

Two files the plan flagged as *at risk* turned out **not** to break:
`inventory-wiring.test.tsx` (mocks `useStock` via `vi.mocked(...).mockReturnValue(...)`, which
doesn't type-check its return value strictly enough to catch the shape change) and
`inventory-primitives.test.tsx` (renders `StockLevelsTable` without the new `onAdjust` prop, which
is optional). No other test file in either app regressed — verified by running the full
`tsc --noEmit` (API: `test/unit`, `test/contract`; web: `tsconfig.test.json`) with the change
stashed out and back in, and diffing the two outputs line-for-line. The API-side diff was exactly
the 5 lines above; nothing in orders/sales/repairs/purchasing/observability (which already show
~180 pre-existing, unrelated errors from prior drift) changed.

## Validation performed

- `Apps/contract`: `npm run check` (`tsc --noEmit`) — clean.
- `Apps/api`: `npx tsc --noEmit` — clean except the 5 predicted `inventory.service.spec.ts` lines
  (confirmed new, not pre-existing, via stash diff).
- `Apps/web`: `npx tsc --noEmit` (src) — clean. `npx tsc --noEmit -p tsconfig.test.json` — clean
  except the 3 predicted lines above (confirmed new via stash diff, run with `-u` to include the
  new untracked files so the baseline itself type-checked consistently).
- `npx eslint` on every touched/new file in `Apps/api`, `Apps/contract` and `Apps/web` — clean
  (a handful of pure-formatting `prettier/prettier` findings in the new web files were fixed with
  `--fix` and re-verified).
- Grep sweeps: `systemQuantityByProductId`/`avgStockPriceByProductId` no longer appear in
  `AdminInventory.tsx` (only in the hook, form, line editor, schema and dialog, as intended);
  `lineBreak: false` in `pdf.utils.ts` remains only in `drawChart`'s bar labels; every new
  translation key resolves exactly once in `translations.json`.
- No test suite was run and no test file was modified, per the programme rule.

## Files touched

**Contract (1)** — `Apps/contract/src/modules/inventory/inventory.query.ts`

**API (5)** — `Apps/api/src/common/utils/pdf.utils.ts`,
`Apps/api/src/modules/inventory/inventory.interface.ts`,
`Apps/api/src/modules/inventory/inventory.service.ts`,
`Apps/api/src/modules/inventory/inventory.mapper.ts`,
`Apps/api/src/modules/statistics/statistics.service.ts`

**Web — new (4)** — `Apps/web/src/hooks/use-adjustment-products.ts`,
`Apps/web/src/pages/admin/inventory/components/stock-adjust-dialog.tsx`,
`Apps/web/src/pages/admin/inventory/components/adjustment-reprice-fields.tsx`,
`Apps/web/src/pages/admin/inventory/components/adjustment-unit-cost-field.tsx`

**Web — modified (8)** — `Apps/web/src/services/inventory.service.ts`,
`Apps/web/src/hooks/useInventory.ts`, `Apps/web/src/pages/admin/inventory/AdminInventory.tsx`,
`Apps/web/src/pages/admin/inventory/components/stock-levels-table.tsx`,
`Apps/web/src/pages/admin/inventory/components/adjustment-form.tsx`,
`Apps/web/src/pages/admin/inventory/components/adjustment-line-editor.tsx`,
`Apps/web/src/pages/admin/inventory/components/adjustment.schema.ts`,
`Apps/web/src/config/translations.json`

Not touched: `inventory.controller.ts`, `inventory.routes.ts`, `platform.service.ts`,
`query-keys.ts`, `prisma/schema.prisma`, any test file.

---

## Manual verification checklist

### Stock levels pagination
1. `/admin/inventory` → Stock levels. With more than 20 products, exactly 20 rows show and the
   pager reads "Page 1 of N".
2. Next page → 20 different rows, pager advances, no full-page flicker.
3. Type a product name in Search → results filter, pager resets to page 1, page count shrinks.
4. Clear the search, go to page 3, then toggle **Low stock only** → jumps back to page 1, shows
   only low rows (red product name, red dot). Paging through the low-stock set works.
5. With **Low stock only** on **and** a search term, both filters apply together.
6. Export → CSV and Export → PDF while on page 3 with filters on: the file contains the **whole
   filtered set**, not the 20 rows on screen.

### Adjust dialog
7. Click **Adjust** on a row → a dialog opens. It must **not** switch to the Adjustments tab.
8. The dialog shows the product name (and barcode, if it has one), its system quantity, and a
   counted quantity pre-set to that same figure with a delta of 0.
9. Enter a counted quantity **above** system → the delta badge turns positive, a unit-cost field
   appears pre-filled with the product's average stock price, with the average shown beneath it.
10. Enter a counted quantity **below** system → the delta badge turns negative (red) and **no**
    unit-cost field appears.
11. Tick **Also update this product's prices** → the price block expands with the product's
    current guest price, default sale price and one field per client category, each label showing
    the previous value, and a margin under each.
12. Save → success toast with an `AJU-…` reference, the dialog closes, and **the row's quantity and
    average stock price update in place without a manual refresh**.
13. Movement ledger tab → the new `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movement is there with the
    `AJU-…` reference. Admin → Products → that product shows the new prices (if step 11 was used).
14. Re-open the dialog on a **different** row → every field resets to that product's values, with
    nothing left over from the previous product.
15. Open the dialog, change nothing, Save → an adjustment with delta 0 is accepted and **no**
    movement appears in the ledger (a delta-0 line writes no movement by design).
15a. **Regression check for the post-execution fix**: open the dialog and, as fast as possible
    after it renders, tick **Also update this product's prices** before the price fields could
    plausibly have loaded, fill in a counted quantity, and Save immediately. This must succeed
    (toast + close), not silently do nothing — this is the exact race the fix targets.

### Adjustments-tab product search
16. Adjustments tab → type the name of a product you know is **old** (not on the first page of the
    admin product list) → it appears in the picker and is selectable.
17. Type/scan a **barcode** → the matching product appears (this is the case the old local filter
    used to swallow), showing the barcode under its name.
18. Select it, then type a completely different search term → **the selected product's name stays
    in the field**, it does not blank out.
19. Add a second line, pick a different product, tick reprice on only one of them → Save → only
    that product's prices change.
19a. **Regression check for the post-execution fix**: type a search term that matches more than
    10 products (e.g. a common brand or family word) → more than 10 results appear in the
    dropdown, up to the 20 the search fetches.
19b. **Regression check for the post-execution fix**: pick a product and, as fast as possible,
    tick **Also update this product's prices** and Save before the reprice fields could plausibly
    have finished loading. Must succeed, not silently do nothing.

### PDF exports — wrapping
20. Stock levels → Export → PDF, with at least one product whose name is long enough to have been
    truncated before. The name **wraps onto two or more lines**, the row grows, and no text
    overlaps the neighbouring column.
21. The header row is fully readable — no word cut mid-way — and **repeats on every page**.
22. Page numbers, the title, the applied-filter lines and the generated timestamp are all still
    present and unchanged.
23. Movement ledger → Export → PDF: same checks, plus long `referenceLabel`, movement type and
    staff-name values wrap rather than truncate.
24. Statistics → any report → Export → PDF: the wide text columns are visibly wider than the
    numeric ones, and nothing overlaps.
25. Settings → Delivery fees → Export → PDF: still correct (it shares the renderer but was not
    otherwise changed).
26. **Print at least one of these PDFs to the actual office printer**, not just the on-screen
    preview — confirm the wrapped rows and the repeated header land correctly on paper and nothing
    is clipped at the page edge.

---

The owner reviews and approves before **S29** (POS workspace layout & repair device label) begins.
