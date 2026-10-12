# Report S31 — Shared product-picker dialog (repairs & supplier invoices)

Executed from `Docs/Stage-04-Fixes/plans/plan-S31-shared-product-picker.md` on 2026-10-11. The
changes are in the working tree on `main`, on top of the approved but still uncommitted S30.
Nothing is committed.

**Gates:** contract, api and web all pass `tsc --noEmit` with zero errors outside test files.
Lint is clean on every touched file. Test-compile error counts are identical to the S30 end
state. No test file was read, edited or run.

**No database change and no migration.**

---

## 1. Problems found while reading the code

- **Supplier invoices could only pick from the newest 100 products.** The editor loaded
  `useAdminCatalogProducts({ page: 1, limit: 100 })` once and filtered it in the browser. Any
  product older than the newest 100 simply could not be put on an invoice. The new picker
  searches the whole catalog on the server (`/admin/products`, name or barcode).
- **Repairs had no list for staging parts.** Each part was reserved the moment its single-row
  form was submitted. The set wants a list where quantity and price stay editable until **Add
  parts** is pressed, so that list now exists. A new endpoint reserves all the staged parts in a
  single transaction.

## 2. Decisions I made myself — tell me if any of these should change

| # | Decision |
|---|---|
| P1 | **New batch endpoint `POST …/repairs/:id/parts/batch`** (1 to 50 parts). Everything is reserved in one transaction: if one part is out of stock, nothing is reserved. The old single-part endpoint still exists and behaves the same, now as a batch of one. |
| P2 | A staged repair part's unit price defaults to the product's **default sale price**, the same default as before. The picker shows all four prices, so the tech can type a category price. |
| P3 | A supplier line's unit cost defaults to **0**, as before. The picker shows the average purchase price and average stock price only as a reminder. |
| P4 | **No duplicates from one Add.** A product that is already staged, or already on an invoice line, is skipped. Adding a product that is already a *saved* repair part is still allowed; the backend has always treated that as a separate fitting. |
| P5 | **Order when the search box is empty:** repairs list products A→Z, supplier invoices list the newest first. These are each endpoint's existing defaults. |
| P6 | **One shared dialog that holds no data of its own.** A thin wrapper per page owns the search text, the page number, the selection and the data query. This is what lets the supplier wrapper tick a product it has just created. |
| P7 | **A supplier invoice now needs at least one product line.** The form shows a translated message otherwise. Switching back from amount-only mode leaves the line list empty instead of one blank line. The backend has no check against an empty invoice. |

## 3. What changed, by layer

### Contract
- `repairs.command.ts`: new `AddRepairPartsSchema` / `AddRepairPartsCommand`, `{ parts: AddRepairPartCommand[] }` with 1 to 50 parts.
- `repairs.routes.ts`: new `STAFF_PARTS_BATCH` and `ADMIN_PARTS_BATCH` routes, at `…/repairs/:id/parts/batch`.

### Backend (repairs module)
- **`repairs.service.ts`:** new `addParts` method.
  - Before the transaction it looks up all product names in one query. An unknown id gets the same `Unknown productId` error as before.
  - Inside the transaction it applies S30's `lockRepair` and editable check, then reserves and creates each part in the order sent. The first stock shortfall cancels the whole batch.
  - It then recomputes the totals once.
  - `addPart` now just calls `addParts` with one part.
- **`repairs.interface.ts`, `repairs.controller.ts`, `repairs.routes.ts`:** the `addParts` declaration, its handler (returns 201), and the two new routes (staff + admin), placed before the `DELETE` part routes.

### Frontend
- **New `types/product-picker.types.ts`:** the `ProductPickerRow` and `ProductPickerColumn<T>` types.
- **New `components/shared/product-picker-dialog.tsx`:** the shared dialog. It only displays what it is given.
  - Search box, a selected count with **Clear selection**, and a table of up to 10 rows with a checkbox each. Clicking anywhere on a row also toggles it.
  - Disabled rows are greyed out and show a hover hint.
  - Previous/Next buttons with "Page x of y", shown even when there is only one page.
  - Footer: **Cancel**, **Add (n)**, and a slot on the left for an extra button.
  - Only the table scrolls; the search, selection bar, pager and footer stay in view.
- **Repairs:**
  - **New `RepairPartPickerDialog.tsx`.**
    - It searches `/staff/products`, waiting 300 ms after typing, and lists products even when the search is empty.
    - Columns: available quantity, default price, then one column per client category, headers sorted by name and taken from the category list.
    - Products with 0 available are disabled.
    - It resets its search, page and selection when closed.
  - **New `RepairPartsStaging.tsx`.** An **Add products** button opens the picker. Below it is the staged list: name, "N available", and editable quantity, price and serials, plus a remove button. **Add parts** sends the batch. On success the list clears; on failure it stays on screen.
  - **`add-repair-part.schema.ts`:** rewritten as the staged-list schema. Each row is checked so its quantity is at most what was available when picked, and the compile-time check against the contract stays.
  - **`RepairTicketDetail.tsx`:** the inline autocomplete form and its props (`productSearchResults`, `onProductSearch`, `onAddPart`) are gone. It now takes `onAddParts` / `isAddingParts` and shows `RepairPartsStaging`.
  - **`StaffRepairs.tsx`:** the part-search state and `useStaffProducts` call are removed, and the page uses the new `useAddRepairParts` hook. `<RepairTicketDetail>` now carries `key={repair id}`, so a staged list never carries over to another ticket.
  - **`repairs.service.ts` and `useRepairs.ts` (web):** new `addRepairParts` call and `useAddRepairParts` hook, which refreshes repairs, inventory and catalog. The old single-part hook is kept.
- **Supplier invoices:**
  - **New `invoice-product-picker-dialog.tsx`.**
    - It searches `/admin/products` and lists newest first when the search is empty.
    - Columns: in stock, average purchase price, average stock price. Nothing is disabled.
    - The footer has the **Add a new product** button, which opens the existing create-product dialog. The product it creates comes back already ticked.
  - **`invoice-line-editor.tsx`:** each row now shows the product name instead of a search box, and the per-row "+" is gone. `AddLineButton` is deleted (the editor page was its only user).
  - **`AdminSupplierInvoiceEditor.tsx`:**
    - The 100-product load, the per-row product options and the quick-add wiring are removed; quick-add now lives inside the picker.
    - A `pickedById` map keeps the name, stock and average purchase price for every product picked during the session.
    - The form starts with no lines. **Add products** opens the picker, and each picked product becomes one line with quantity 1 and unit cost 0.
    - Line names now come from the picked product, or the saved invoice's own name snapshot, matched by **product id**. The old code matched by row position, which breaks once lines can be removed and re-added.
    - The "at least one line" message shows under the line list.
  - **`supplier-invoice.schema.ts`:** new rule requiring at least one line. Prettier also re-indented the rest of the function body; this is formatting only.
  - **`amount-only-switch.tsx`:** going back to line mode now sets `lines` to an empty list.
- **`translations.json`:**
  - 23 keys added under `common.productPicker.*`, `staff.repairs.partPicker/addPart.*` and `admin.supplierInvoices.*`.
  - `staff.repairs.addPart.submit` now reads "Add parts" / "Ajouter les pièces".
  - 7 keys removed after a search showed nothing uses them: `staff.repairs.addPart.{productLabel, productPlaceholder, noResults, productRequired, title}` and `admin.supplierInvoices.editor.{addLine, product}`.
  - A scan of every touched or new web file found **no `t("…")` key missing** from the file.

### Docs
- `Docs/Stage-00-Conception/Module-Contracts/repairs.md`: added the API row for the new batch endpoint.

## 4. Not fixed, out of scope

- **The supplier dropdown on the invoice editor has the same 100-item limit.** It loads `usePurchasingSuppliers({ page: 1, limit: 100 })`, so from the 101st supplier onward some suppliers can't be chosen. S31 covers only products.
- **A picked product's availability isn't refreshed while it sits in the staged list.** The staged row remembers the available quantity from when it was picked, and the form checks against that number. The server's out-of-stock check is the final word. Checklist step 14 covers this.

## 5. Validation gate

| Gate | Result |
|---|---|
| `Apps/contract` `tsc --noEmit` / `npm run lint` | ✅ / ✅ |
| `Apps/api` `tsc --noEmit` (`src/**`) | ✅ 0 errors |
| `Apps/api` test files | 198 errors in 29 files, **identical per file** to the S30 end state |
| `Apps/api` `npm run lint` | The 7 errors that were already there before S30, all in files I didn't touch (`seed.ts`, `validate-request.middleware.ts`, `orders.service.ts`). `src/modules/repairs` is clean. |
| `Apps/web` `tsc --noEmit` | ✅ 0 errors |
| `Apps/web` `tsc -p tsconfig.test.json` | **identical per file** to the S30 end state. The plan expected some staleness in test files; none appeared. |
| `Apps/web` eslint on touched/new files | ✅ clean, after `eslint --fix` corrected formatting only, in 8 places |
| Plan §5 grep checks | ✅ no `limit: 100` product query left (only the suppliers one, above); no `AutocompleteInput` in the repair drawer or the line editor; no `AddLineButton`, `quickAddLineIndex`, `productSearchResults` or `onProductSearch` left (the only near match is the unrelated `onProductSearchChange` in Settings) |
| `translations.json` | ✅ valid JSON, saved through a load-and-save that leaves untouched entries byte-for-byte as they were |

**Nothing was run in a browser.** Under the programme rules no test or script exercised these
flows. The checklist below is the real verification.

---

## 6. Manual verification checklist (browser)

Before starting, note the on-hand, reserved and available figures of three products from the
admin products list:
- **A**: in stock, at least 3 available.
- **B**: in stock.
- **Z**: 0 available.

Also note the client-category names.

### A. Repairs — the picker
1. Open a repair in INTAKE. The old product autocomplete is gone, and an **Add products** button
   sits in the parts box.
2. Click it, with the search empty. The table immediately lists products (A→Z), 10 per page.
   Previous is disabled on page 1. Next moves to page 2, and "Page x of y" is correct.
3. Columns: product (with barcode under it), Available, Default price, then one column per client
   category (three), with prices matching the POS card for the same products.
4. **Z's row is greyed out**: its checkbox can't be ticked, clicking the row does nothing, and
   hovering shows "Out of stock — cannot be fitted".
5. Tick A on page 1, go to page 2 and tick another product, then search B's barcode and tick B.
   The counter reads "3 selected" throughout. Clear the search: A is still ticked.
6. Click **Clear selection**: the counter reads 0, and Add is disabled. Tick A and B again.
7. **Cancel.** Reopen the picker: nothing is selected and the search is empty.
8. Select A and B, then click **Add (2)**. The dialog closes, and a "Parts to add" list shows A
   and B. Each row has qty 1, the default price pre-filled, a serials box, and an "N available"
   hint.
9. **Movements ledger: no new rows.** Admin products list: A and B are unchanged. Nothing is
   reserved yet.
10. Open the picker again and add A once more. A is **not** duplicated in the staged list.
11. Set A's quantity above its available figure. The row shows the "exceeds available" error, and
    Add parts does nothing. Set it back to 2, and change B's price.
12. Click **Add parts**. Both appear as saved parts with the edited quantity and price, the staged
    list empties, and the total updates.
13. **Movements ledger, filtered on A, then on B:** one `Repair reservation` row each (+2, +1),
    reference `REP-…`. The admin products list, **without reloading**, shows A's and B's reserved
    up and available down by exactly those amounts.
14. **All-or-nothing:** stage A (qty 1) and a product whose available figure you first drop to 0
    in a second tab (another repair, or an adjustment), then click Add parts. You get the
    out-of-stock toast. **Neither** part is saved, the ledger shows **no** new row for A, and the
    staged list is still there to fix.
15. Switch to another repair ticket and back. The staged list does not leak between tickets.
16. Picked-up, cancelled or returned ticket: no Add products button (read-only, as before).
17. Staff account holding only the repairs page: the picker loads products and the category
    headers (no 403).

### B. Supplier invoices — the picker
18. Admin → Supplier invoices → New. The page starts with **no line** and an **Add products**
    button. There is no per-row autocomplete and no per-row "+".
19. Open the picker with the search empty. Products are listed **newest first**, 10 per page.
    Columns: In stock, Avg purchase price, Avg stock price, with values matching the product
    pages.
20. **Z (0 in stock) is selectable.**
21. Search a product that is **older than the newest 100**. It is found. (Before S31 it could not
    be picked at all.)
22. Click **Add a new product** in the picker footer. The existing create dialog opens over the
    picker. Create a product: it closes, the new product is **already ticked**, and it appears at
    the top of the table.
23. Select 3 products and click **Add**. Three lines appear, each with the product name, qty 1,
    unit cost 0, and the "in stock / avg price" hints under the quantity.
24. Add one of them again through the picker. It is not duplicated.
25. Remove every line and click Save. The form shows "Add at least one product" and nothing is
    saved. Switch to amount-only and back: the line list is empty, not one blank line.
26. Add lines, set quantities and unit costs, and Save. The invoice is created and confirmed as
    before. **Movements ledger:** one `Supplier invoice` IN row per line, with the entered unit
    cost. **Product pages:** on-hand increased, `avgPrice`/`avgStockPrice` recomputed as before.
    The supplier's credit moves by the invoice total, exactly as before S31. The payments ledger
    is untouched unless you record a payment.
27. Reopen the saved invoice. It is read-only, and every line shows its product name (snapshot).

### C. Regression
28. POS product search and the products pages are unchanged.
29. Staff and admin repair intake, status changes, pickup and return (S30) are unaffected.

---
