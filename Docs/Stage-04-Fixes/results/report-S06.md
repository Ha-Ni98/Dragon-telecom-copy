# Report — Set 6 (POS & POS Clients)

Executed against `Docs/Stage-04-Fixes/plans/plan-S06-pos-and-pos-clients.md`, all 14 actions,
2026-07-26. Both validation gates green (tsc + lint, contract/api/web). No test file was edited.
No test suite was run. Covers all twelve brief items (I1–I12) per the plan's owner decisions
R1–R3.

---

## What changed

### Contract (`Apps/contract`)

- `sales.routes.ts`: `SALE_ROUTES.DELETE_DRAFT = '/staff/sales/:id'` — same path as
  `UPDATE_DRAFT`, its own constant since it's distinguished only by HTTP verb (I4).

### Backend (`Apps/api`)

- `sales.service.ts`: new `deleteDraft(id, actor)` — owner-or-admin + DRAFT-only guards (mirrors
  `updateDraft`), deletes `SaleLine` rows before the `Sale` row in one transaction (no cascade
  exists on that relation, so this avoids a foreign-key failure without a schema change).
- `sales.interface.ts`: `ISalesService.deleteDraft` declared.
- `sales.controller.ts`: `deleteDraft` handler, returns **204** with no body.
- `sales.routes.ts`: `DELETE /staff/sales/:id`, guarded by the same `staffPosOrAdmin` middleware
  as `UPDATE_DRAFT`.

### Frontend service/hook (`Apps/web`)

- `services/sales.service.ts`: `deleteDraft(id)` — `api.delete(...)`, no response body to map.
- `hooks/useSales.ts`: `useDeleteDraft()` — invalidates `qk.sales.all()`, same as create/update.

### Shared component — the dead "Create new" row (I11 root cause, R2)

`components/shared/autocomplete-input.tsx`: `shouldShowCreateNew` now requires
`onCreateNew != null` in addition to its existing conditions. Previously the row rendered whenever
`showCreateNew` (default `true`) was set and the typed text matched nothing — regardless of
whether a handler existed — so clicking it silently did nothing (`handleCreateNew`'s own
`if (onCreateNew)` guard swallowed the call). This is the shared root cause behind the POS-client
category field's dead row; fixing it here also covers the approve-client dialog and every future
consumer. Verified the four consumers that legitimately want create-new
(`AdminProductsAdd.tsx` ×3, `invoice-line-editor.tsx`) all pass `onCreateNew` and are unaffected.
`showCreateNew`'s doc comment updated to describe its now-narrower role (a suppressor for a
consumer that *has* a handler but wants the row hidden anyway).

### Translations (`Apps/web/src/config/translations.json`)

6 new keys, 0 deleted: `staff.pos.receipt.newSale`, `staff.pos.search.defaultPriceLabel`,
`staff.pos.payment.creditPreviewLabel`, `staff.pos.quickAddClient.categoryLabel`,
`staff.pos.quickAddClient.categoryPlaceholder`, `admin.posClients.table.viewLinkedAccount`.
`staff.pos.ticket.discount` is deliberately **retained** though no longer referenced by any
component — `Sale.discountAmount` and its DTO field still exist and may be rendered wherever a
sale's own details are shown.

### New file: `pages/staff/pos/pos-pricing.ts`

Extracted the POS price-resolution rule (previously a private function inside `StaffPos.tsx`) into
a shared module: `resolvePosPrice(categoryPrices, defaultSalePrice, categoryId?)` and
`posPriceBreakdown(product)`. Both the ticket (`StaffPos.tsx`) and the new product-card breakdown
(`PosProductSearch.tsx`) now share one implementation — they cannot drift apart.

### `PosProductSearch.tsx` — product card redesign (I1, I8)

New optional prop `attachedCategoryId`. The card is now three rows: **name (left) / resolved
price (right)** on top, the existing brand/stock line unchanged in the middle, and a new muted
`text-xs` breakdown line at the bottom — *"Default 1200 DZD · Gold 1000 DZD · Silver 1100 DZD"* —
built from `posPriceBreakdown`, entirely data-driven (a product priced for two categories lists
two entries, not four). No contract or backend change was needed: `StaffProductDto` already
carries `defaultSalePrice` and `categoryPrices` with names (F8 in the plan).

### `PosTicket.tsx` — discount removed from the UI (I6)

Dropped the `discountAmount`/`onDiscountChange` props and the discount input row entirely. The
footer now shows only the total. `Input` import kept — the per-line charged-price field still
uses it.

### `PosPaymentPanel.tsx` — credit preview moved in, above the paid amount (I3)

New optional props `previousCredit`/`newCredit`. When both are supplied, a
`<CreditMovementPreview>` renders above the paid-amount field, under a
`staff.pos.payment.creditPreviewLabel` heading. Rendered for **every** attached client now (the
old inline version in `StaffPos.tsx` only showed when underpaying) — an overpay correctly shows
credit falling in the success colour.

### `PosReceiptView.tsx` — "New sale" button (I2)

New required prop `onNewSale`. Print and New sale now sit side by side, each `flex-1`. Clicking
New sale is the caller's job to wire to a reset that does **not** touch the (already-gone) draft.

### `QuickAddPosClientDialog.tsx` — category field (I9)

New required prop `categoryOptions: AutocompleteOption[]`. A `Controller`-wrapped
`AutocompleteInput` (the dialog previously used bare `register(...)`, which doesn't work for a
non-native input) renders between phone and the footer, with no `onCreateNew` passed — so, thanks
to the shared-component fix above, no dead create-new row appears here either.
`quick-add-pos-client.schema.ts` needed **no change** — it already declared `categoryId` (F11 in
the plan).

### `pos-clients-table.tsx` — linked-account arrow (I12)

The `linkedClientId` column now renders an `ArrowUpRight` icon inside a `<Link
to={`/admin/clients/${id}`}>` (verified `/admin/clients/:id` in `App.tsx` before writing the
path), with `stopPropagation` on the click so the row's own detail-drawer `onRowClick` doesn't
also fire. A client with no linked account still renders `—`.

### `StaffPos.tsx` — the orchestration (the largest action)

This is the single file both `/staff/pos` and `/admin/pos` render (`AdminPos.tsx` is a 4-line
wrapper — confirmed, no separate admin fork exists), so every change below applies to both routes
from one edit.

- **11a** — the local `resolveCategoryPrice` helper deleted; both call sites
  (`handleSelectProduct`, `reresolveLines`) now import `resolvePosPrice` from the new
  `pos-pricing.ts` and pass `attachedClient?.categoryId` / `client?.categoryId` instead of the
  whole client object.
- **11b** — `attachedCategoryId={attachedClient?.categoryId}` passed to `<PosProductSearch>`. No
  new query: `StaffProductDto` already carries everything the card needs (F8).
- **11c** — `resetTicket` split into **`resetTicketState()`** (unchanged body, called after a
  successful confirm and by the receipt's New-sale action — never deletes anything) and
  **`handleClearTicket()`** (calls `deleteDraft.mutate(draftId)` when one exists, then
  `resetTicketState()`) — wired to the Clear button. This was the highest-risk step: getting the
  two mixed up would delete a completed sale.
- **11d** — a new effect deletes the draft and clears `draftId`/`lastSyncedSnapshotRef` the moment
  `lines.length` reaches 0 while a `draftId` still exists (I4's "emptying the last line" clause).
  The existing sync effect's own `lines.length === 0` early-return is untouched — this new effect
  is what now handles that state.
- **11e** — `paidAmountTouched` state plus an effect: `paidAmount` mirrors `total` whenever
  `!paidAmountTouched`. The payment panel's `onPaidAmountChange` now sets the flag before setting
  the value. Reset to `false` in both `resetTicketState()` and `handleOpenDraft` (R1: both a fresh
  ticket and a resumed draft start on auto-tracking).
- **11f** — the standalone `<CreditMovementPreview>` block (and its import) deleted from
  `StaffPos.tsx`; the two figures are now passed into `<PosPaymentPanel>` **with the sign
  corrected**: `newCredit: attachedClient.credit + (total - paidAmount)` — the old code computed
  `credit - (total - paidAmount)`, the literal inverse of S5's settled arithmetic
  (`credit += (total − paid)`). This was a real, previously-shipped bug (F4 in the plan), not a
  new one introduced by this set.
- **11g** — `discountAmount` state deleted; `total` is now simply `subtotal`; `buildDraftCommand`
  sends a literal `discountAmount: 0` with a comment explaining why; `handleOpenDraft` no longer
  calls `setDiscountAmount` (a resumed draft's stored discount is not re-editable, matching the
  ticket UI).
- **11h** — the staff-search beacon now fires off its own 2-second debounce
  (`useDebouncedValue(productQuery, 2000)`) instead of the 300ms debounce that drives the result
  list. `/admin/products` and `/staff/products` are untouched (R3) — confirmed by grep, see sweep
  below.
- **11i** — `<PosReceiptView onNewSale={...}>` calls `setReceipt(null)` + `resetTicketState()` —
  never `handleClearTicket`, since the draft is already gone by the time a receipt exists.
- **11j** — `useCatalogClientCategories()` + a `categoryOptions` memo (identical shape to
  `AdminPosClients.tsx`'s own) passed to `<QuickAddPosClientDialog>`.

---

## Findings during execution

No deviations from the plan were required. One minor implementation detail worth recording: the
plan's Action 3 sketch used `apiPath(ROUTE, { id })` for `deleteDraft`, but the codebase's actual
convention (confirmed by reading every neighbouring function in `sales.service.ts`) is
`withParams(apiPath(ROUTE), { id })` — used that form instead, consistent with `updateDraft` and
`confirmSale` in the same file.

---

## Sweep results (plan Action 14a) — all five green

```
1. grep -rn "resolveCategoryPrice" Apps/web/src
   → empty. Fully replaced by the shared resolvePosPrice.

2. grep -rn "discountAmount" Apps/web/src/pages/staff/pos
   → StaffPos.tsx:247 (the literal `discountAmount: 0` in buildDraftCommand) and one comment in
     PosTicket.tsx explaining why the field is gone. No live UI binding remains.

3. grep -rn "staff.pos.ticket.discount" Apps/web/src
   → only its own translations.json entry — deliberately retained, no component references it.

4. grep -rn "DELETE_DRAFT\|deleteDraft" Apps/web/src Apps/api/src Apps/contract/src
   → present end to end: contract route constant, api interface/service/controller/routes, web
     service/hook, and StaffPos.tsx's two call sites (the auto-delete effect and
     handleClearTicket). No stray or duplicate definitions.

5. grep -rln "CreditMovementPreview" Apps/web/src
   → StaffPos.tsx is NO LONGER a consumer (confirmed — the only hit left in that file's
     neighbourhood is PosReceiptView.tsx's pre-existing comment noting it deliberately does NOT
     use CreditMovementPreview, which is untouched by this set). PosPaymentPanel.tsx is now a
     consumer, as intended.
```

All five match the plan's expected outcome exactly.

---

## Stale tests (plan Action 14b) — not edited, not run

**Backend:** ran `npx tsc --noEmit` against the full api tsconfig
(`include: ["src", "test", "prisma"]`) — the stale-file list is **byte-for-byte identical to
S5's** (21 files: the 4 factories, 2 integration specs, and the 15 unit specs already itemized in
`report-S05.md`). Adding `deleteDraft` to `ISalesService`/`SalesService` introduced **zero new
backend test staleness** — no existing test constructs a full `ISalesService` mock that would need
the new method.

**Frontend — genuinely affected:**

| File | What's stale |
|---|---|
| `Apps/web/tests/unit/pages/staff-pos/pos.test.tsx` | Renders `<StaffPos>` with `vi.mock("@/hooks/useSales")` (whole-module auto-mock) but sets no `mockReturnValue` for the new `useDeleteDraft` export — calling `deleteDraft.mutate(...)` inside `StaffPos.tsx` would throw against the auto-mocked `undefined`. It also does not mock `@/hooks/useClientCategories` at all, a new dependency of this page as of this set (`useCatalogClientCategories`) — that hook's real implementation would fire an unmocked query in the test environment. **Neither gap is compile-time visible** (confirmed by `tsc --noEmit`'s clean result) — both are runtime gaps that would only surface if the suite were run, which this session does not do. |

**Frontend — inspected, not actually stale:**

| File | Why it survives |
|---|---|
| `Apps/web/tests/unit/pages/pos-clients/pos-clients-primitives.test.tsx` | Renders `<PosClientsTable>` only with `data={undefined}` (loading/empty-state cases) — no row with a `linkedClientId` is ever exercised, so the new `<Link>` cell never mounts. No `MemoryRouter` wrapper exists in this test, which would matter if a row *were* rendered, but none is. Verified by reading the file in full; left untouched per the no-test-edit rule. |

---

## Validation gate — all green

```
Apps/contract: npx tsc --noEmit ✓ (0 errors)      npm run lint ✓ (0 problems)

Apps/api:      npx tsc --noEmit — src/** is 0 errors (confirmed by filtering error-header lines
               to paths outside test/). The full test/** stale-symbol list is byte-for-byte
               identical to S5's 21-file baseline — deleteDraft introduced no new backend
               staleness.
               npm run lint — 6 pre-existing errors (prisma/seed.ts ×3,
               validate-request.middleware.ts ×3), both files untouched this session.

Apps/web:      npx tsc --noEmit ✓ (0 errors) on src/** (tsconfig.json, tests excluded by its own
               include list — consistent with every prior report in this programme).
               npx eslint on every file this set touched — one prettier line-wrap violation found
               and fixed (StaffPos.tsx's reresolveLines call), 0 problems remaining.
```

No test file was edited. No test suite was run.

---

## Known limitations (plan §3) — not fixed here, recorded for the owner

1. **A resumed draft still cannot re-price.** Lines rehydrated via `handleOpenDraft` carry
   `categoryPrices: []` and `manualPrice: true` (pre-existing, documented in that function's own
   comment) — attaching a client after resuming a draft does not move their prices. Fixing this
   needs a products-by-ids query the contract does not have; out of this set's scope.
2. **I4's middle clause** ("removing a product must update the draft's line list") was already
   expected to work via the existing PATCH-replaces-all-lines behavior once the surrounding state
   flow was correct — verify it in the browser (checklist item 17); if it still misbehaves, it is
   a distinct defect from the two this set explicitly fixed (delete-on-clear, delete-on-empty).
3. **The discount column/field is retained but never non-zero from the POS.** Any historical sale
   with a non-zero discount still renders it wherever sale details are shown elsewhere in the app.
4. **`staff.pos.ticket.discount`** is deliberately retained though currently unreferenced.

**Staff parity confirmed by construction (F1):** `AdminPos.tsx` is a 4-line wrapper around
`StaffPos`. Every change in this report applies to `/staff/pos` and `/admin/pos` identically —
there is no separate admin POS tree for S18 to reconcile.

---

## Manual verification checklist

The owner performs these in the browser. No automated test runs. Everything under "POS" should be
checked on **`/admin/pos`**, then spot-checked on **`/staff/pos`** — they are the same component
(F1), so a difference between them is itself a bug.

**Product card and client-driven prices (I1, I8)**
1. `/admin/pos` — search a product. Its card shows the **name on the left** and a **price on the
   right**, with a smaller line beneath listing **Default** plus one figure per client category
   that has a price. The breakdown is visibly secondary (small, muted) — not competing with the
   name.
2. Attach a POS client **whose category has its own price** for that product. The price on the
   right **changes to that category's price**; the breakdown line is unchanged.
3. Detach the client → the right-hand price returns to the default.
4. Add the product to the ticket while the client is attached: the ticket line is priced at the
   category price too.

**Paid amount (I5)**
5. With an empty ticket, add a 1200 DZD product → the **paid amount reads 1200** without typing.
6. Add another product → the paid amount **follows the new total**.
7. Type your own figure (say 500) → it stays 500 even after adding another product.
8. Clear the ticket, start a new one → the paid amount is auto-tracking again.

**Credit preview (I3)**
9. Attach a client with an existing credit, build a 1000 DZD ticket and set the paid amount to
   **300**. Above the paid-amount field, the preview shows previous → new credit **rising by 700**
   (the client owes more), in the warning colour. Before this set it fell by 700 — the opposite.
10. Set the paid amount to **1000** → the preview shows no change.
11. Set it to **1500** (overpay) → the new credit **falls by 500** and renders in the success
    colour. The preview is visible in all three cases, not only when underpaying.

**Confirm and the S5 payment row (I10) — verify only**
12. Confirm the 1000 / paid 300 sale above. Check the database:
    `SELECT reference, "invoiceId", amount FROM "ClientPayment" ORDER BY "paidAt" DESC LIMIT 1;`
    — one row, amount **300**, `invoiceId` **not null**.
13. `/admin/invoices` → the new invoice reads **PARTIALLY_PAID** with paid amount 300.
14. The client's credit rose by 700 (`/admin/pos-clients`). *If any of 12–14 fails, it is an S5
    regression, not an S6 one.*

**Receipt (I2)**
15. After the confirm, the receipt shows **Print** and **New sale** side by side. Click **New
    sale** → you land on a fresh, empty ticket (no lines, no client, paid amount 0) and the
    receipt is gone.
16. Confirm another sale and click **Print** → the print dialog opens and the receipt stays on
    screen.

**Draft bugs (I4)**
17. Build a ticket with **two** products, wait ~1s, then remove one. Open the **drafts** drawer:
    the draft lists **one** line, not two.
18. Remove the **last** line. The drafts drawer no longer lists that draft at all — it is gone from
    the database, not merely empty.
19. Build a new ticket, wait ~1s for the draft to be created, then press **Clear**. The draft
    disappears from the drawer.
20. **The critical one:** build a ticket, **confirm** it, then open the drafts drawer and the sales
    list. The draft is gone from drafts (it became the sale) and the **sale exists** in
    `/admin/sales`. Confirm the sale was *not* deleted.

**POS clients (I9, I11, I12)**
21. `/admin/pos-clients` → **Add**. Click into **Category** → a dropdown of the existing categories
    appears. Type a name that matches **nothing** (e.g. "zzz") → **no "Create new zzz" row appears**.
    Before this set a dead one did.
22. Pick a category → the field shows its **name**. Save, reopen the client for **Edit** → the
    field is pre-filled with the name, not an id. Repeat 21 in the Edit dialog.
23. `/admin/pos` → **Quick add** → the dialog now has a **Category** field behaving exactly like
    21–22. Create a client with a category, and confirm the newly-created client is attached and
    the ticket re-prices to that category.
24. `/admin/pos-clients` → a client **linked to a user account** shows an **arrow**, not a uuid.
    Click it → you land on `/admin/clients/:id` for that client, and the row's detail drawer does
    **not** also open. A client with no linked account still shows "—".

**Search log (I7)**
25. `/admin/pos` — type a product name at a normal pace and stop. Results still appear quickly
    (~300 ms). Then check `/admin/logs` (or the staff-searches view): **one** search row for what
    you typed, ~2s after you stopped — not one row per keystroke, and not the partial prefixes.
26. `/admin/products` — search there and confirm its logging is **unchanged** (still fires on its
    own 300 ms debounce), per R3.

**Discount (I6)**
27. `/admin/pos` — the ticket footer has **no discount input**; only the total. Confirm a sale and
    check `SELECT "discountAmount" FROM "Sale" ORDER BY "createdAt" DESC LIMIT 1;` → **0**.

**Nothing else moved**
28. `/staff/pos` — spot-check items 1, 5, 9, 15 and 21. Being the same component, all must behave
    identically.
29. `/admin/products/add` — the family/brand/model autocompletes **still offer "Create new"** when
    you type an unknown name (Action 4 must not have suppressed the consumers that want it).
30. `/admin/supplier-invoices/new` — the product line autocomplete still offers its quick-create
    row too.

---

The owner reviews and approves before S7 begins.
