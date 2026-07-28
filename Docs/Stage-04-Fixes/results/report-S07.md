# Report S7 — Supplier Invoices & Suppliers

Executed per `Docs/Stage-04-Fixes/plans/plan-S07-supplier-invoices-and-suppliers.md`, actions 1→17
in order, single session.

## Summary

All 17 actions completed. `tsc --noEmit` is clean on `Apps/contract`, `Apps/api` and `Apps/web`.
Lint is clean on every S7-touched file (two files needed a prettier `--fix` pass — pure formatting,
no logic change; see §Validation gate). No schema/migration in this set. No test file was edited.
No test suite was run.

## What changed

### Contract (Actions 1–2)

- `purchasing.dtos.ts`: `SupplierInvoiceResponseSchema` gains **`supplierCredit: z.number()`**
  (required) — the supplier's credit *right now*, distinct from `previousCredit`/`newCredit`
  (the snapshot bracketing that invoice's own confirm). This is the field **S8** consumes for its
  own incoming-invoice payment dialog fix.
- `purchasing.command.ts`: `CreateSupplierInvoiceSchema` gains a second `.refine` rejecting an
  invoice with neither lines nor a positive `amountOnly` (I2). `UpdateSupplierInvoiceSchema` gains
  two equivalent refines (empty `lines`, non-positive `amountOnly`) — a PATCH may still omit both
  fields legitimately, so these only fire when the field is present.

### Backend — purchasing (Actions 3–5)

- `purchasing.service.ts`: `INVOICE_INCLUDE` now selects `supplier.credit` alongside
  `supplier.name`. Verified every invoice read in the file uses this constant (`getSupplier`'s
  `invoiceRows`, `listInvoices`, `getInvoice`, `createInvoice`'s create, and both `updateInvoice`/
  `cancelInvoice`'s final re-read through `getInvoice`) — none bypass it.
- `createInvoice` now selects `isEnabled` on the supplier lookup and throws `BadRequestError`
  when the supplier is disabled (I13), **before** building lines — a disabled supplier can no
  longer receive a new purchase document. `createPayment` was deliberately left unguarded, per the
  plan (settling an existing debt to a disabled supplier must stay possible).
- Both `createInvoice` and `updateInvoice` now throw `BadRequestError` when the computed
  `totalAmount <= 0` (I2) — defence in depth behind the contract refine, since `updateInvoice`
  composes the patch with the stored row and can reach an empty result through a shape the refine
  alone can't see.
- `purchasing.mapper.ts`: `SupplierInvoiceRow.supplier` widened to
  `Pick<Supplier, 'name' | 'credit'>`; `toSupplierInvoiceDto` now emits `supplierCredit` right
  after `newCredit`, matching the contract's field order.

### Frontend — the invoice editor (Actions 6–11)

- **`invoice-line-editor.tsx`** — the product cell branches on `disabled`: editable rows show a
  small quick-add (`+`) button to the left of the `AutocompleteInput` (`showCreateNew={false}`,
  dropping the old create-on-no-result); read-only rows render `productNameSnapshot` as plain text
  instead of a disabled autocomplete (I10) — this is what makes a confirmed invoice's product name
  visible even when that product falls outside the editor's first 100 loaded products. Two helper
  texts now render under the quantity input when `productStock` is supplied: *"Qty in stock is
  N"* and *"Avg price is X"*, reading the unweighted **`avgPrice`** (D10), never `avgStockPrice`.
- **`quick-add-product-dialog.tsx` + `quick-add-product.schema.ts`** (new) replace the deleted
  `inline-create-product-dialog.tsx` / `.schema.ts`. Field order family → brand → model → name,
  each taxonomy field an `AutocompleteInput` with its own `onCreateNew`, ported directly from
  `AdminProductsAdd.tsx`'s pattern (same `recomputeName` gated on a manual-edit flag, same
  brand-gated model input). `initialQuantity: 0` unchanged — the invoice's own confirm books stock.
- **`reprice-prompt.tsx`** — full rewrite. Per-candidate form now carries `guestPrice`,
  `defaultSalePrice`, and one `categoryPrices[]` entry per **every** client category (not just
  priced ones — an unpriced category renders empty, same convention as Product Info's S3 R2). The
  header line shows qty-in-stock and avg-stock-price side by side (replacing the mislabelled
  `admin.suppliers.averageQuantity` key). Every field label now carries its previous value via a
  new `previousLabel()` helper: `"Guest price -previous 1000-"` or `"-previous empty-"`. **Fixed
  the `valueAsNumber` → `NaN` trap (S3 F1) on both pre-existing fields and the new category
  fields** — all three now use `setValueAs` mapping `""` → `undefined`, which is what makes an
  emptied guest price actually submit as `null` rather than silently failing validation. `onApply`
  strips category rows with no value before submitting, so an untouched empty field never posts a
  `0` price.
- **`confirm-bar.tsx`** — reduced from three states (DRAFT/CONFIRMED/CANCELLED branching, five
  possible buttons) to two: **Save** (rendered only when `onSave` is passed) and **Cancel**
  (always present, discards the form and returns to the list). The destructive cancel-invoice
  button and the `SupplierInvoiceStatus`/`CheckCircle`/`Ban` imports are gone.
- **`AdminSupplierInvoiceEditor.tsx`** — the central rewire (R1): `handleSave` now chains
  create-or-update → confirm in one submit, setting `repriceCandidates` and toasting
  `saveSuccess` only after the confirm resolves; navigation to the invoice's real URL happens
  **after** confirm (not after create), so the reprice candidates survive the transition.
  `handleCancelEdit` simply navigates to the list. The cancel-invoice handler and
  `useCancelPurchasingInvoice` import are deleted. `shippingCost: 0` is now a real default value.
  `<RepricePrompt>` moved above the `<form>` (I7), now fed `categories` from
  `useCatalogClientCategories()`. The line-editor map passes `onQuickAddProduct`, `productStock`
  (from a new `productStockById` map keyed off the loaded product page's `quantityOnHand`/
  `avgPrice`) and `productNameSnapshot` (from the fetched invoice's own lines). The payment
  dialog's `previousCredit` now reads `invoice.supplierCredit` (I9) instead of the stale
  `invoice.newCredit`.

### Frontend — list and suppliers pages (Actions 12–14)

- **`supplier-invoices-table.tsx`** — three new columns: **Supplier ref.** (`-` when null),
  **Paid**, **Paid on** (`-` when never paid). Skeleton column count bumped 5 → 8.
- **`admin-suppliers-table.tsx`** — the one-way disable button is now a two-way
  `onToggleEnabled(id, nextEnabled)` toggle: a `Ban` icon on an enabled row, a `RotateCcw` icon on
  a disabled one. The "add invoice" link is hidden entirely on a disabled supplier's row (I13).
- **`AdminSuppliers.tsx`** — `handleDisable` replaced by `handleToggleEnabled`, toasting
  `enableSuccess`/`disableSuccess` depending on direction (both keys already existed).
- **`supplier-details-section.tsx`** — new `readOnly` prop: hides the Edit button and forces
  every field `disabled` regardless of edit-mode state; renders a one-line `Alert` explaining why
  when `readOnly` is true.
- **`supplier-information-header.tsx`** — new `onEnable` prop; renders a destructive "Disabled"
  badge and a re-enable button beside Refresh whenever the supplier is disabled and a handler was
  passed.
- **`AdminSupplierInformation.tsx`** — wires `isDisabled = !data.supplier.isEnabled` into both:
  `readOnly={isDisabled}` on the details section, `onEnable={isDisabled ? handleEnable : undefined}`
  on the header. `handleEnable` reuses the existing `useUpdatePurchasingSupplier` mutation.

### Translations (Action 15)

Added 20 keys (empty-invoice message, save-success toast, the renamed Cancel button, quick-add
button, the two line-level helper texts, the unknown-product fallback, six reprice-section keys,
three list-column headers, and — discovered already present — `admin.suppliers.enableSuccess` was
**not** duplicated, since it already existed from an earlier set). Deleted three now-dead keys:
`admin.suppliers.averageQuantity` (S1's flagged mislabel — its only consumer was rewritten in
Action 9), `admin.supplierInvoices.editor.confirm` and `.cancel`/`.cancelReason` (their only
consumer was the removed cancel-invoice affordance). Confirmed via `grep` that no other file
referenced any of the three deleted keys before removing them. `admin.supplierInvoices.editor.save`'s
English/French text changed from "Save draft" to "Save" (same key, new copy — it is the same
button, just no longer draft-scoped). JSON validated via `require()`.

## Findings during execution

No deviations from the plan were required. One thing worth flagging explicitly:

- **`admin.suppliers.enableSuccess` already existed** in `translations.json` before this set (not
  found during planning's `grep`, since planning checked `table.enable`/`table.disable`/
  `disabledBadge`/`disabledReadOnly`, not `enableSuccess` itself). No duplicate was added; the
  toggle handler simply reuses it.
- Two newly-written files (`AdminSupplierInvoiceEditor.tsx`, `reprice-prompt.tsx`) needed one
  `eslint --fix` pass each for pure prettier formatting (a multi-line `onSubmit`/`className` prop
  block, a wrapped `.array()` call, a wrapped ternary spread, a wrapped hidden-input tag) — no
  logic changed; confirmed via a second lint pass returning exit 0.

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)      npm run lint ✓ (0 problems)

Apps/api:      npx prisma validate ✓ (unchanged schema, sanity check only)
               npx tsc --noEmit — src/** 0 errors (confirmed by filtering error-header paths to
               outside test/); every remaining error is inside test/**, itemized below.
               npm run lint — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), identical to the S1/S4/S5 baseline; neither
               file touched this session.

Apps/web:      npx tsc --noEmit ✓ (0 errors)
               npm run lint — 0 new errors on any S7-touched file. Two files
               (AdminSupplierInvoiceEditor.tsx, reprice-prompt.tsx) had 4 pure-formatting errors,
               fixed via `eslint --fix`; re-lint of both returns exit 0. The ~3.9k pre-existing
               prettier-noise baseline elsewhere in the repo (documented in
               stage-03-sprint4-complete.md) is untouched and not this set's concern.
```

No test file was edited. No test suite was run.

**Stale-test sweep (do not edit/run):**

```
grep -rln "inline-create-product|onCreateNewProduct|onDisable|averageQuantity" Apps/web/tests
→ one false-positive hit (settings-primitives.test.tsx matches `onDisableFamily`/`onDisableBrand`/
  `onDisableModel` — unrelated props on a different component, not this set's `onDisable`).

grep -rln "supplierCredit|SupplierInvoiceRow" Apps/api/test
→ test/unit/modules/purchasing/purchasing.mapper.spec.ts — its `buildInvoiceRow` fixture
  constructs `supplier: { name: 'Acme Parts' }`, now missing the `credit` field
  `SupplierInvoiceRow.supplier` requires post-Action-3. **Newly stale, introduced by this set**
  (not previously flagged in S1/S5's lists). Not edited, per rule.
```

## Handoffs recorded per the plan's execution protocol

1. **To S8** — `SupplierInvoiceDto.supplierCredit` now exists and is populated on every read. S8's
   incoming-invoice payment dialog (`StaffInvoices.tsx`) must consume it. **Do not re-add the
   contract field in S8.**
2. **To S18** — the supplier-invoices list gained three columns (supplier ref., paid amount, paid
   date). There is no staff twin of this page today; confirm that when S18 audits staff parity.
3. **`updateInvoice`'s new `totalAmount <= 0` guard** — no previously-valid PATCH flow was found to
   reach this during implementation (the guard only fires when the composed line/amount-only
   result is genuinely empty), but the owner should watch for any 400 on an update that used to
   succeed, since this is the one place in the set where an existing flow could newly reject.

## Manual verification checklist

The owner performs these in the browser. No automated test runs. Have at least one supplier, one
disabled supplier, and one product with a known `avgPrice` **different from** its `avgStockPrice`
(confirm two supplier invoices at different unit costs to create the divergence).

**Add Invoice — Save and Cancel (I1, R1)**

1. `/admin/supplier-invoices/new` — the action bar shows exactly two buttons: **Save** and
   **Cancel**. No "Save draft", no "Confirm", no red "Cancel invoice".
2. Fill in a supplier, one product line, qty 2, a unit cost — click **Save**. One click lands you on
   `/admin/supplier-invoices/:id`, the invoice reads **CONFIRMED**, and its reference is a real
   sequence number (not `DRAFT-…`).
3. The product's stock rose by 2 (`/admin/inventory` → stock levels) and the supplier's credit rose
   by the invoice total (`/admin/suppliers`).
4. Press the browser **Back** button: you are **not** returned to a half-filled `/new` form.
5. Open `/new` again, fill anything in, click **Cancel**: you land on
   `/admin/supplier-invoices` and **no new invoice row exists**.
6. Open the invoice from step 2: there is **no cancel-invoice button anywhere** on the page (I8).

**Add Invoice — the empty-invoice guard (I2)**

7. `/new` → pick a supplier → remove the single product line → **Save**. A message appears under the
   lines area; nothing is written.
8. `/new` → pick a supplier → switch to **amount only** → leave it at **0** → **Save**. Same: a
   message, no write.
9. Amount-only with a real figure (e.g. 5000) still saves and confirms normally.

**Add Invoice — supplier field, shipping, product rows (I3, I4, I5, I6)**

10. `/new` — the **shipping cost** field reads **0** on first render, and the footer's shipping line
    reads 0 (not blank).
11. The **supplier** field shows the supplier's name immediately after selection and still shows it
    after you touch other fields.
12. Each product row has a small **+ button to its left** of the product dropdown. Typing a product
    name that matches nothing offers **no "Create new …" row** any more.
13. Click the **+** button: a dialog opens with fields in the order **family → brand → model → name**.
    Each of the first three is a dropdown; typing a new value in any of them offers "Create new …"
    and, on click, creates it and selects it by name.
14. The **model** dropdown is disabled until a brand is chosen.
15. As you pick family/brand/model the **name** field fills in automatically as `family brand model`.
    Type over it and it stops auto-filling.
16. Save the dialog: the new product is selected in the row you opened it from, **by name**.
17. Pick an **existing** product in a row. Beneath the quantity field two lines appear:
    *"Qty in stock is N"* and *"Avg price is X"*. Cross-check both against the database:
    `SELECT "quantityOnHand", "avgPrice", "avgStockPrice" FROM "Product" WHERE id = '…';`
    — **X must equal `avgPrice`, not `avgStockPrice`.** This is the single easiest thing to get
    backwards in this set.
18. Open a second row with a different product: each row shows **its own** figures.

**The reprice section (I7)**

19. Save an invoice for a product that already has prices. On the resulting page the reprice section
    is at the **very top**, above the invoice information — not at the bottom.
20. Its header line shows **qty in stock** and **avg stock price** side by side. The avg figure is no
    longer labelled "Average Quantity".
21. It shows a field for the **guest price**, the **default sale price**, and **one per client
    category** — including categories the product has never had a price for, which render **empty**.
22. Each field's label carries its previous value: `Guest price -previous 1000-`, or
    `-previous empty-` where there was none.
23. Type into any field: a coloured margin appears beneath it and **moves as you type** — green above
    the avg stock price, red at or below it.
24. Clear the guest price entirely and click **Apply**. The apply succeeds (it does not silently do
    nothing), and the product's guest price is now null:
    `SELECT "guestPrice", "defaultSalePrice" FROM "Product" WHERE id = '…';`
25. Fill a category that had no price and Apply. `SELECT * FROM "ProductPrice" WHERE "productId" = '…';`
    now has a row for it. Leave another category empty and confirm **no** 0-priced row was created
    for it.
26. **Skip** and **Skip all** still dismiss cards without writing anything.

**Invoice information (I9, I10)**

27. Open a **confirmed** invoice. Every product row shows the product **name** as plain text — no
    empty box, no uuid. Verify this on an invoice whose product was created a long time ago (i.e.
    outside the first 100 products by the list's default ordering).
28. Note the supplier's current credit on `/admin/suppliers`. Open an **older** confirmed invoice for
    that supplier and click **Record payment**: the dialog's "previous credit" equals the supplier's
    **current** credit, not the figure frozen on that invoice.
29. Type an amount: the preview shows `current credit → current credit − amount`. Submit, then
    re-check `/admin/suppliers` — the supplier's credit matches the preview's new figure exactly.

**Supplier invoices list (I11)**

30. `/admin/supplier-invoices` — the table shows **Supplier ref.**, **Paid** and **Paid on**.
31. An invoice created without a supplier reference shows `-` in that column.
32. An unpaid invoice shows `-` under **Paid on**; the invoice you paid in step 29 shows today's date.

**Suppliers (I12, I13, I14)**

33. `/admin/suppliers` — disable a supplier. Its status badge flips and the action icon becomes a
    **re-enable** icon.
34. Click it: the supplier is enabled again and a success toast appears. Repeat the round trip once
    more to confirm it is genuinely two-way.
35. While the supplier is **disabled**, its row shows **no "add invoice" (+) button**.
36. Still disabled: navigate directly to `/admin/supplier-invoices/new?supplierId=<that supplier>`,
    fill it in and **Save**. The request is **rejected** with an error — nothing is written.
37. Open the disabled supplier's page (`/admin/suppliers/:id`): a **Disabled** badge is shown, a
    notice says the information is read-only, and there is **no Edit button** on the details card.
38. The same page shows a **Re-enable** button. Click it: the page becomes editable again, the notice
    and badge disappear, and the Edit button returns.
39. An **enabled** supplier's page is unchanged from before this set — Edit works, Save works.

**Nothing else moved**

40. `/admin/invoices` → **Incoming** tab still loads and its rows still open the supplier-payment
    dialog. (Its own "previous credit" fix belongs to **S8**; expect it to still read the invoice's
    stale figure here.)
41. `/admin/pos` still completes a sale, and `/admin/inventory` → Movement ledger still resolves
    references to `FAC-…` for the invoices confirmed above.
