# Report — Set 3 (Product Admin Pages)

Executed against `Docs/Stage-04-Fixes/plans/plan-S03-product-admin-pages.md`, all 14 actions,
2026-07-26. Both validation gates green (tsc + lint, contract/api/web). No test file was edited.
No test suite was run.

---

## R1 — the retracted barcode instruction (verbatim, do not re-apply)

The original brief's *"Add Product — leave barcode editing disabled for now"* was **retracted by
the owner as a mistake** before this set was planned:

> "it is a mistake, keep the barcode editing no change on it, the user can auto generate the
> codebare and also can edit it"

**Barcode editing and auto-generation are unchanged in every respect.** The only part of the
brief's barcode instruction that still applies is field *ordering* — the barcode field moved to
the bottom of the Basic Info card (Action 6a). Any later set that reads the original
`app-issues-01.md` §S3 text must **not** re-disable, hide, or make read-only the barcode input.

---

## What changed

### Contract (`Apps/contract`)

- `catalog.routes.ts`: added `CATALOG_ROUTES.IMAGE_BY_ID = '/admin/products/:id/images/:imageId'`
  and `export const PRODUCT_UPLOAD_DIR = 'uploads'` — the latter replaces three separate string
  literals (`app.ts`, api's `catalog.routes.ts`, `catalog.service.ts`) that all had to agree on the
  same on-disk directory.
- `catalog.query.ts`: added `ProductImageParamsSchema` / `ProductImageParams` (two-uuid-param
  route, mirrors repairs' `RepairPartParamsSchema`). No barrel edit needed — `catalog/index.ts`
  already re-exports with `export *`.

### Backend (`Apps/api`)

- `catalog.service.ts` `staffAdminWhere()`: `query.search` now matches product **name**
  (`contains`, case-insensitive) **or** barcode (`startsWith` — S1's recorded instruction, so the
  `Product.barcode @unique` index still applies). Feeds both `listAdminProducts` and
  `listStaffProducts` from one edit. `listProducts` (public storefront) was deliberately **not**
  touched — barcode search there would leak an internal identifier onto a public query surface.
- `catalog.service.ts`: new `deleteImage(id, imageId)` — deletes the `ProductImage` row, promotes
  the lowest-position survivor to primary if the deleted image was primary, then `unlink()`s the
  file on disk (`basename()`-guarded against path traversal; a missing file is swallowed, not
  thrown — the DB row is the source of truth).
- `catalog.interface.ts`: `ICatalogProductService.deleteImage` added.
- `catalog.controller.ts`: `deleteImage` handler, same shape as its `updateImages` neighbor.
- `catalog.routes.ts` (api): `DELETE CATALOG_ROUTES.IMAGE_BY_ID`, `adminOnly`, registered after the
  `PATCH IMAGES` route; local `UPLOAD_DIR` constant now aliases the shared `PRODUCT_UPLOAD_DIR`.
- `app.ts`: `express.static` mount now uses `PRODUCT_UPLOAD_DIR` instead of the literal `"uploads"`.

### Frontend (`Apps/web`)

- `services/catalog.service.ts`: `deleteImage(id, imageId)`.
- `hooks/useCatalogProducts.ts`: `useDeleteProductImage()` — invalidates the product's detail
  cache plus both admin and public product-list caches (a deleted primary can promote a new one).
- **Add Product** (`AdminProductsAdd.tsx`):
  - Field order: family/brand/model → name → description → barcode (barcode's *behavior*
    unchanged per R1).
  - Category-price margins are now reactive (`watch("categoryPrices")` replaces a non-reactive
    `getValues` read) — typing a category price now moves its margin live, matching guest/default.
  - A real success flow: toast on create, then a genuine reset (`reset()` + cleared images with
    revoked object URLs + cleared manual-name flag) instead of the old no-op
    `navigate("/admin/products/add")` (same-path navigation doesn't remount the route).
- **Products list**:
  - `admin-products-table.tsx`: dropped the `image` column (rendered a static placeholder icon,
    zero real data). `Package` import kept — still used by `EmptyState`. `TableSkeleton` column
    count 11→10.
  - `StatusBadge.tsx`: `StatusPill` gained `whitespace-nowrap` — the actual fix for the "low in
    stock" column problem (see F7 below).
  - New `admin-product-prices-table.tsx`, modeled on `StaffProductsTable` but typed to
    `AdminProductDto` with an added **guest price** column (R3) alongside default price and
    data-driven category columns.
  - `AdminProducts.tsx`: wrapped the two tables in `Tabs` (`stock` / `prices`), filters/stats/
    pagination unchanged and shared by both — same `products` array, same query.
  - Translation key `admin.productsList.filters.search` reworded to mention barcode; `.table.avgCost`
    reworded to "Avg. stock price" (S1 handoff — see F9 below).
- **Product Info** (F1/F2 — the save bug):
  - `enhanced-pricing-section.tsx` / `product-details-section.tsx`: replaced `valueAsNumber: true`
    with `setValueAs` helpers on all four affected registrations (guestPrice, defaultSalePrice,
    categoryPrices.*.price, reorderThreshold). `guestPrice` maps blank to `null` (contract's
    explicit "clear it" signal); the other three map blank to `undefined` ("leave untouched").
  - `use-edit-mode.ts` `save()`: now tracks whether each `handleSubmit` callback actually ran
    (i.e., validation passed) and only exits edit mode + shows a success toast when **both** did;
    otherwise it stays in edit mode and shows an error toast. `save` is now `async`.
  - `product-information-header.tsx`: `onSave` widened to `() => void | Promise<void>` — this
    **compiles as-is either way** (a `() => Promise<void>` was already assignable to `() => void`),
    the widen is for honesty about what the handler returns, not a required fix.
- **Product Info** (R2 — a price input for every category):
  - `use-edit-mode.ts`: added `useCatalogClientCategories()`; `pricingForm.reset`'s
    `categoryPrices` is now seeded one row per **client category** (price filled where a
    `ProductPrice` row exists, `undefined` otherwise), not one row per existing price. The reset
    effect's deps grew to `[product, categories]`.
  - `enhanced-pricing-section.tsx`: the category label now resolves from the live category list
    (`useCatalogClientCategories()` called directly in this component) instead of
    `product.categoryPrices.find(...)`, which is `undefined` for an unpriced category.
- **Product Info** (F5 — image removal):
  - `product-images-section.tsx`: delete button per tile (`Trash2`, same placement/sizing as
    `AdminProductsAdd.tsx`'s staged-image remove button), confirmed via `window.confirm(...)` (see
    note below), disabled while pending, success/error toasts. The "Known gap" paragraph in the
    header comment (previously: no delete endpoint, out of scope) is replaced with a note that S3
    added the endpoint and the backend owns file-unlink + primary promotion.
- **Product Info** (F9 — split average cost):
  - `AdminProductInformation.tsx`: the single `avgCost` stat is now two —
    `admin.productInfo.stock.avgStockPrice` and `.avgPrice` — with a D10 comment explaining the
    difference. Grid widened `lg:grid-cols-6` → `lg:grid-cols-7`. Stock-value calculation
    unchanged (`quantityOnHand * avgStockPrice`, verified not touched).

### Translations (`Apps/web/src/config/translations.json`)

Added: `admin.productsAdd.createSuccess`, `admin.productsList.tabs.stock`,
`admin.productsList.tabs.prices`, `admin.productsList.table.guestPrice`,
`admin.productsList.table.defaultPrice`, `admin.productInfo.stock.avgStockPrice`,
`admin.productInfo.stock.avgPrice`, `admin.productInfo.saveSuccess`,
`admin.productInfo.saveError`, `admin.productInfo.images.confirmRemove`.

Reworded: `admin.productsList.filters.search`, `admin.productsList.table.avgCost`,
`admin.productInfo.removeImage`, `admin.productInfo.imageRemoveSuccess`,
`admin.productInfo.imageRemoveError` (all four to sentence case, matching the file's convention —
F8).

Deleted: `admin.productInfo.stock.avgCost` — verified (grep) that its only consumer was replaced
by Action 13 before removing it.

---

## Findings recorded for future sets

**F1 — the `valueAsNumber` → `NaN` root cause.** `register(field, { valueAsNumber: true })` maps
an *empty* input to `NaN`, not `undefined`/`null`. `z.number()` (and `.optional()`) reject `NaN`
outright, so the *entire* form fails validation and `handleSubmit`'s valid-callback never fires —
that's why "clearing the guest price" silently saved nothing: it wasn't a null-handling bug, it
was the whole form never submitting. Fixed at all four sites named in the plan (guestPrice,
defaultSalePrice, categoryPrices.*.price, reorderThreshold). `AdminProductsAdd.tsx` had already
hit and solved this exact trap years earlier (`optionalNumber` helper, documented in a 9-line
comment) — this set reused that pattern rather than inventing a new one.

**Handoff to every future set: never register an optional numeric field with `valueAsNumber: true`
in this codebase — use `setValueAs`.**

**F2 — `save()` exited edit mode unconditionally.** Found while fixing F1: `use-edit-mode.ts`'s
`save()` called `setIsEditMode(false)` synchronously, outside both `handleSubmit` callbacks, so an
*invalid* form silently dropped out of edit mode having saved nothing and shown no error. This is
what made F1 look like "nothing happens" rather than "validation failed" — the two had to be fixed
together, which the plan already called out. `save()` is now `async`, tracks a per-form success
flag, and only exits edit mode + toasts success when both forms actually validated; otherwise it
stays in edit mode and toasts an error.

**F7 — RC-3 on the products list needed no further contrast work.** S2's `--warning-foreground`
CSS-variable fix already resolved the "low in stock" light-mode legibility problem at the root —
verified, not re-touched. What the products list *did* still need was the stock-status column's
actual remaining problem: the longest label ("Out of stock" / French "Rupture de stock") was
wrapping onto two lines in a narrow column. Fixed at the shared-component root
(`StatusPill` + `whitespace-nowrap`, since a status pill should never wrap in *any* table), combined
with removing the dead image column, which gave every other column its width back.

**A genuine, documented limitation (not fixed here, flagged for S7).** A category price can now be
**set** from Product Info (R2) but **not cleared back to "no price"** — the form drops a blanked
row from the command (so the stored price is left untouched, not deleted), and neither
`applyPricing` nor the `ProductPrice` model has a delete path. S7 (which rebuilds the full price
grid in the supplier-invoice reprice context) is the natural place to add that.

**A deviation from the plan's stated approach (Action 10a), found necessary during execution.**
The plan specified `z.preprocess(fn, z.array(...))` to drop blanked category-price rows before
validation. Running `tsc` against that surfaced a resolver-type mismatch in `use-edit-mode.ts`
(`Resolver<..., categoryPrices?: unknown, ...>` not assignable to the expected `Resolver<...,
categoryPrices?: {...}[], ...>`) — this is exactly the gotcha already documented in this codebase's
`supplier.schema.ts` (`optionalEmail`'s comment: *"not `z.preprocess`, which breaks zodResolver's
input-type inference against `useForm<T>`"*), which the plan's author apparently didn't cross-check
against. Fixed by switching to `.array(CategoryPriceRowInputSchema).transform(...)` (input type
stays a concrete loose shape, not `unknown`) plus adopting this codebase's existing 3-generic
`useForm<Input, unknown, Output>` pattern (precedent: `register.schema.ts`'s `RegisterInput` /
`RegisterFormValues`, used verbatim in `Register.tsx`). `product-pricing.schema.ts` now exports
`ProductPricingInput` (`z.input<...>`) alongside `ProductPricingFormValues` (`z.infer<...>`);
`use-edit-mode.ts`'s `pricingForm` is `useForm<ProductPricingInput, unknown,
ProductPricingFormValues>`; `enhanced-pricing-section.tsx`'s `register`/`control`/`errors`/`watch`
props are typed to `ProductPricingInput`. The `_UpdatePricingCommandCheck` compile guard at the
bottom of `product-pricing.schema.ts` still passes unchanged (it checks the *output* type, which
this change didn't touch).

**Confirm mechanism used for Action 12 (image removal).** `window.confirm(...)` — the file doesn't
already import an `AlertDialog`, and a plain browser confirm matches the weight of the action per
the plan's own guidance.

---

## Action 14 sweep results

- `grep -rn "admin.productInfo.stock.avgCost" Apps/web/src` → empty (checked before deleting the
  key).
- `grep -rn "valueAsNumber" Apps/web/src/pages/admin/products` → one hit outside the four F1 sites:
  `AdminProductsAdd.tsx:331`, the `initialQuantity` registration. **Not changed** — `initialQuantity`
  is a *required* field (schema default `0`, no `.optional()`), so `NaN` on a blank input still
  correctly fails validation with the field's own required-number message; this is exactly the
  "merely confusing, not a bug" case the codebase's own original comment on this trap already
  distinguishes. Reported rather than silently touched, per the plan's instruction.
- `grep -rn "UPLOAD_DIR\|\"uploads\"\|'uploads'" Apps/api/src` → only the `PRODUCT_UPLOAD_DIR`
  import/use sites from Action 3 remain (`app.ts`, api's `catalog.routes.ts`, `catalog.service.ts`).
  No stray literal survives.
- **Stale test files** (not edited, not run). The plan's literal grep pattern (component/file
  names) returned nothing because these three tests import and render the *page* components
  directly rather than referencing sub-component file names — found instead by locating
  `Apps/web/tests/unit/pages/admin-products/`:
  - `product-information.test.tsx` — renders `AdminProductInformation`, `vi.mock`s
    `@/hooks/useCatalogProducts` (auto-mock) but does **not** provide a `mockReturnValue` for the
    new `useDeleteProductImage` export, and does **not** mock `@/hooks/useClientCategories` at
    all (a new dependency of both `use-edit-mode.ts` and `enhanced-pricing-section.tsx` as of this
    set). The existing "save" and "cancel" tests exercise code paths this set changed
    (`use-edit-mode.ts`'s `save()`) but use `waitFor`, so the added `Promise.all` await is
    unlikely to break them on its own — the unmocked `useDeleteProductImage` call inside
    `ProductImagesSection` (now unconditional on every render of this page) is the higher-risk
    gap.
  - `products-add.test.tsx` — renders `AdminProductsAdd`; already mocks
    `useCatalogClientCategories`. Its assertions only check `createProductMutate`'s call args, not
    field order, the success toast, or the post-save reset, so this set's Action 6 changes are
    unlikely to break it, but the success-path behavior it silently exercises is now different.
  - `products-list.test.tsx` — renders `AdminProducts`; assertions use `screen.getByText`/
    `getAllByRole` against labels that still exist inside the new default-active "stock" tab, so
    likely unaffected, but the component now wraps its table in `Tabs` where it previously didn't.

---

## Manual verification checklist

The owner performs these in the browser. No automated test runs.

**Add Product**
1. `/admin/products/add` — the Basic info card reads, top to bottom: **family, brand, model**, then
   **name**, then **description**, then **barcode**.
2. The barcode input is still **fully editable by hand**, and **Auto-generate** still fills it
   (R1 — the brief's "disabled" instruction was retracted).
3. Enter an initial quantity and unit cost to unlock pricing, then type into a **category price**:
   its margin appears and updates on every keystroke, coloured green above cost / red at or below
   (this was stale before — F3). Confirm guest and default prices still behave the same.
4. Save a product. A **success toast** appears, and the form is left **completely empty** — no
   name, no family/brand/model, no prices, no staged images, and typing a family now
   re-auto-generates the name (proving `nameManuallyEdited` reset). Previously every field
   survived.

**Products list**
5. `/admin/products` — there is **no image column**.
6. The **Stock** status badge sits on **one line** for every row, including "Out of stock" — switch
   the language to **French** ("Rupture de stock", the longest label) and confirm it still does not
   wrap.
7. In **light mode**, the "low in stock" badge is legible (dark amber on pale amber) — this was
   fixed at the root by S2; confirm it survived.
8. Type a **product name** into the search box → matching rows. Clear it, type a full **barcode**
   → that product alone. Type the **first few characters** of a barcode → still matches (prefix
   search). The placeholder reads "Search by name or barcode".
9. Switch to the **Prices** tab: same rows, columns are product · barcode · taxonomy · available ·
   **guest price** · default price · one column per client category. Apply a family filter and
   change page — **both tabs** reflect it (filters and pagination are shared).

**Product Info — the save bug**
10. Open a product **that has a guest price**, click Edit, **clear the guest price**, click Save.
    It **saves**: a success toast appears, edit mode closes, and the guest price now shows "—".
    (Before this set, nothing happened at all.)
11. Edit again and **clear the reorder threshold**, then Save — it saves too (F1's second site, on
    the details form).
12. Edit, type a **letter** into a price field or otherwise make the form invalid, and Save: you
    **stay in edit mode**, an error toast appears, and the invalid field is highlighted. Before,
    the page silently dropped out of edit mode having saved nothing.
13. Edit and change the default price: the margin beside it moves **as you type** (S2's fix, still
    working).

**Product Info — category prices**
14. Open a product that has **never had category prices**. In edit mode there is now an **empty
    input for every client category**. Type a price into one and Save — it persists, and re-opening
    shows it filled while the others stay empty (R2).

**Product Info — images and averages**
15. The stock strip shows **both** "Avg. stock price" and "Avg. purchase price" as separate
    figures, and "Stock value" still equals on-hand × **avg stock price**.
16. Upload an image, then click its **remove** button and confirm. The tile disappears, a success
    toast appears, and the product's image count drops.
17. Remove the **primary** image of a product that has two or more. A remaining image becomes the
    new primary (badge moves), and the product still shows a picture on `/admin/products` and on
    the public storefront.
18. Confirm the **file is really gone**: `ls Apps/api/uploads` before and after a removal — the
    removed image's file is no longer on disk.

---

The owner reviews and approves before S4 begins.
