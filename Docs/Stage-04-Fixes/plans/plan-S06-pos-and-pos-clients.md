# Plan S6 — POS & POS Clients

*Frontend-heavy, plus one new backend endpoint (delete a draft sale). Consumes S2 and S5.*

Scope, from `app-issues-01.md` §S6 — twelve items, numbered here as **I1–I12** and referenced by
those tags throughout:

| # | Item |
|---|---|
| I1 | Re-resolve and refresh product prices when a client is selected, so prices follow his category |
| I2 | After saving, the receipt view gains a **return-to-fresh-POS** button beside print |
| I3 | Show the client's **previous and new credit** above the paid amount |
| I4 | **Draft bugs:** "clear" must delete the draft from the database; removing a product must update the draft's line list; emptying the last line must delete the draft |
| I5 | Default the **paid amount to the subtotal**, credit excluded |
| I6 | **Remove the discount from the UI** (keep the column, set 0) |
| I7 | **Search log:** record only the last search, debounced **2 seconds** between keystrokes |
| I8 | **Product card redesign:** name left, resolved price right, all four prices beneath, visually secondary |
| I9 | The quick-add-client dialog gains a **category select**, matching the POS-client dialog component |
| I10 | Wire the confirmation to the payment row introduced in S5 |
| I11 | POS clients: category field = dropdown of existing categories only, **no create-new**, shows the name after selection (RC-1) |
| I12 | POS clients: for a client linked to a user account, replace the raw client id with an **arrow linking to `/admin/clients/:id`** |

---

## 0. Before you start

### 0.1 Sets that must land first

**S2** and **S5** — both executed, reported and owner-approved (`results/report-S02.md`,
`report-S05.md`).

| From | What S6 uses |
|---|---|
| S2 | The rebuilt `AutocompleteInput` (RC-1: `value` is the entity id, the input displays the label). I11's "shows the name after selection" is **already done** — this set only removes the dead create-new row (F7). |
| S2 | `useDebouncedValue` — reused for I7's 2-second beacon. |
| S5 | POS confirm already creates a `ClientPayment` row and issues the invoice inside the confirm transaction. **I10 is therefore a verify-only item** (Action 13) — no frontend wiring is required, because no response shape changed. |
| S5 | The settled credit arithmetic `credit += (total − paid)` — which is what makes F4 below a bug rather than a preference. |

**S6 blocks S18** (staff parity) only. Nothing else in the programme waits on it.

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | When does the paid amount default to the total (I5)? | **Track the total until edited.** `paidAmount` mirrors the ticket total on every ticket change until the cashier types in the field; from then on their figure stands. Auto-tracking resumes after a confirm or a clear. Mirrors the `manualPrice` flag the ticket lines already use for exactly this problem. |
| **R2** | What shape is the POS-client category field (I9/I11)? | **Keep the searchable `AutocompleteInput`; kill create-new at the root.** The shared component currently offers "Create new …" even when no `onCreateNew` handler was passed — fixing that in the component fixes this field, the approve-client dialog and every future consumer at once. Quick-add uses the same component, per the brief's "matching the POS-client dialog". |
| **R3** | How wide is the 2-second search-log debounce (I7)? | **POS only.** `/admin/products` and `/staff/products` keep their 300 ms beacon. Do not touch them. |

### 0.3 Findings from reading the code — read before acting

**F1 — one page serves both POS routes.** `AdminPos.tsx` is four lines: it renders
`<StaffPos scope="admin" />`. **Every POS change in this set is made once, in
`Apps/web/src/pages/staff/pos/`, and both `/staff/pos` and `/admin/pos` get it.** There is no admin
POS fork to mirror. (This is also why S18 has nothing to do for POS.)

**F2 — there is no delete-draft endpoint anywhere.** `SALE_ROUTES` (contract) has
`CREATE_DRAFT`/`UPDATE_DRAFT`/`CONFIRM`/lists/detail/`RETURN` — no DELETE. `sales.routes.ts` (api)
registers six routes, none of them DELETE. `useSales.ts` has no delete hook. **I4 needs a new
endpoint built through the full stack** (Actions 1–3).

**F3 — `UpdateSaleDraftSchema.lines` is `.min(1).optional()`.** An empty line array is a 400. So
"emptying the last line" *cannot* be expressed as a PATCH — deletion is the only correct model,
which corroborates F2. Do not relax the `.min(1)`.

**F4 — the credit preview has an inverted sign (I3).** `StaffPos.tsx:453–457` renders
`newCredit={attachedClient.credit - (total - paidAmount)}`. S5's settled arithmetic is
`credit += (total − paid)` — the preview subtracts where the ledger adds, so a client who underpays
is shown their credit *falling*. `CreditMovementPreview` itself is correct (it colours a rise as
`text-destructive`, i.e. owing more is bad); only the caller's arithmetic is wrong. It is also
placed **below** the payment panel and only rendered when `paidAmount < total`, where I3 asks for
it **above** the paid amount.

**F5 — `resetTicket()` is called from two places with different meanings.**
`StaffPos.tsx:262` defines it; it is called by the Clear button (line 383) **and** by the confirm
success handler (line 285). I4 requires Clear to delete the draft — but after a confirm the draft
row has *become the completed sale* and must never be deleted. **These two call sites must be split
before wiring any deletion** (Action 11c). Getting this wrong deletes a completed sale.

**F6 — the draft-sync effect returns early on an empty ticket.** `StaffPos.tsx:246`:
`if (lines.length === 0) return;`. This is why emptying the ticket leaves a stale draft in the
database. Removing a *non-last* line does PATCH correctly today (the backend's `updateDraft`
replaces the whole line set via `deleteMany` + `create`), so I4's middle clause is expected to be
satisfied once the state flow is correct — **verify it in the browser and report it if it
persists**, rather than pre-emptively rewriting the sync effect.

**F7 — the dead "Create new" row (I11), root cause.** `autocomplete-input.tsx:104–107`:
```ts
const shouldShowCreateNew =
  showCreateNew &&                       // defaults to TRUE
  inputText.trim().length > 0 &&
  !suggestions.some((s) => s.label.toLowerCase() === inputText.toLowerCase());
```
It never checks that `onCreateNew` was actually passed. `handleCreateNew` then does
`if (onCreateNew && …)` — so on the POS-client dialogs (which pass neither prop) typing a
non-matching category name shows a **"Create new …"** button that does nothing when clicked. Fixing
`shouldShowCreateNew` to require `onCreateNew` is the root-cause fix (R2) and is safe: every
consumer that genuinely wants create-new (`AdminProductsAdd.tsx` ×3, `invoice-line-editor.tsx`)
already passes `onCreateNew`.

**F8 — `StaffProductDto` already carries all four prices.** The contract's
`StaffProductResponseSchema` has `defaultSalePrice` plus `categoryPrices: [{categoryId,
categoryName, price}]` — its own comment says *"the 4 sale prices"*. **I8's conditional ripple
("ripples to contract and backend if the card isn't sent those prices today") does not apply: no
contract change and no backend change are needed for the card.**

**F9 — the search card ignores the attached client entirely.** `PosProductSearch.tsx:92` renders
`formatDZD(product.defaultSalePrice ?? 0)` unconditionally. The ticket *lines* already re-resolve
on attach (`reresolveLines`, `StaffPos.tsx:183`), but the product list does not — that is exactly
I1's "prices follow his category" combined with I8's "resolved price on the right".

**F10 — a resumed draft cannot re-resolve, by design.** `handleOpenDraft` (`StaffPos.tsx:324`)
sets `categoryPrices: []` and `manualPrice: true` on every rehydrated line, with a 8-line comment
explaining why (no by-id product read exists, so the originating `categoryPrices` are unknown).
**Leave this as-is.** A draft resumed from the drawer will not re-price when a client is attached.
This is a pre-existing documented approximation, not something I1 asks to fix, and fixing it
properly needs a products-by-ids query the contract does not have. Record it in the report as a
known limitation.

**F11 — the quick-add schema already accepts a category.**
`quick-add-pos-client.schema.ts` already declares `categoryId: z.uuid().optional()` and carries a
compile-time guard against `CreatePosClientCommand`. **I9 is a dialog-rendering change only** — no
schema edit, no contract edit.

**F12 — `PosClientDto.linkedClientId` is already the `Client.id`** the arrow needs (I12); the table
renders it raw at `pos-clients-table.tsx:74`. No backend or DTO change.

### 0.4 Standing rules for this set

- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit` and lint
  on `Apps/contract`, `Apps/api`, `Apps/web`.
- **All user-facing text goes through `t()`**, keys added to `Apps/web/src/config/translations.json`
  — flat dotted keys → `{ en, fr, ar }`, **`ar` always `""`**.
- **Read the comment above every line you change.** Several comments in `StaffPos.tsx` and the POS
  components describe behaviour this set changes; each is named in its action.
- Layering: the POS components stay **dumb** (props in, callbacks out) — `StaffPos.tsx` owns every
  hook and every piece of state. Do not move a mutation into a component.
- Money is rendered with `formatDZD(value, language)` from `@/lib/utils`.

---

## 1. Actions

Execute in order. 1–3 build the delete-draft endpoint end to end; 4–5 are the shared-component and
text changes; 6–10 are the dumb POS components; 11 is the page orchestration (the largest action);
12–13 are POS clients and the S5 verification; 14 is the sweep and gate.

---

### Action 1 — Contract: the delete-draft route

**File:** `Apps/contract/src/modules/sales/sales.routes.ts`

Add one member to `SALE_ROUTES`, next to `UPDATE_DRAFT`:

```ts
  DELETE_DRAFT: '/staff/sales/:id',
```

It shares a path with `UPDATE_DRAFT` but differs by HTTP verb — declare it as its own constant so
no call site hardcodes the string (hard rule 1), mirroring how `STAFF_DETAIL`/`ADMIN_DETAIL` are
split. Add a one-line comment saying so.

**No new schema is needed** — the existing `SaleIdParamsSchema` validates `:id`, and a DELETE has
no body.

---

### Action 2 — Backend: `deleteDraft`

**File:** `Apps/api/src/modules/sales/sales.service.ts`

Add a method beside `updateDraft`, reusing that method's guards exactly:

```ts
  // A DRAFT sale is a scratch document — the POS deletes it outright when the cashier clears the
  // ticket or removes its last line (S6/I4). Guards mirror updateDraft: owner-or-admin, and DRAFT
  // only — a COMPLETED sale is an accounting record and can never be deleted here (a return is the
  // only way to reverse one). SaleLine has no cascade on its Sale relation (schema.prisma), so the
  // lines are removed first, in the same transaction.
  async deleteDraft(id: string, actor: JWTPayload): Promise<void> {
    const existing = await this.prisma.sale.findUnique({ where: { id }, select: { staffId: true, status: true } });
    if (!existing) throw new NotFoundError('Sale');
    const isAdmin = actor.type === UserType.ADMIN;
    if (!isAdmin && existing.staffId !== actor.staffId) throw new ForbiddenError();
    if (existing.status !== PrismaSaleStatus.DRAFT) throw new ConflictError('Sale is not deletable (not DRAFT)');

    await this.prisma.$transaction(async (tx) => {
      await tx.saleLine.deleteMany({ where: { saleId: id } });
      await tx.sale.delete({ where: { id } });
    });
  }
```

**Why the explicit `deleteMany`:** `SaleLine.sale` is a required relation with no `onDelete`
override, so Prisma's default `Restrict` would make `sale.delete()` fail with a foreign-key error.
Deleting the lines first inside the same transaction is the smaller, migration-free fix — **do not
add a cascade to the schema for this.**

**File:** `Apps/api/src/modules/sales/sales.interface.ts` — declare
`deleteDraft(id: string, actor: JWTPayload): Promise<void>;` on `ISalesService`, after
`updateDraft`.

**File:** `Apps/api/src/modules/sales/sales.controller.ts` — add a handler shaped like
`updateDraft`'s neighbour, returning **204**:

```ts
  deleteDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as { id: string };
      await this.service.deleteDraft(id, req.user!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
```
Check how the neighbouring handlers read `req.validated.params` and copy that exact form.

**File:** `Apps/api/src/modules/sales/sales.routes.ts` — register it with the **same guard as
`UPDATE_DRAFT`** (`staffPosOrAdmin`), immediately after that route:

```ts
router.delete(
  SALE_ROUTES.DELETE_DRAFT,
  staffPosOrAdmin,
  validateRequest({ params: SaleIdParamsSchema }),
  controller.deleteDraft,
);
```

---

### Action 3 — Frontend: service + hook for delete-draft

**File:** `Apps/web/src/services/sales.service.ts` — add beside `updateDraft`:

```ts
// 204, no body — the draft row is gone, there is nothing to map back.
export async function deleteDraft(id: string): Promise<void> {
  await api.delete(apiPath(SALE_ROUTES.DELETE_DRAFT, { id }));
}
```
Match the exact `apiPath(...)` param-substitution form the neighbouring `updateDraft`/`confirmSale`
already use in this file — read it first, do not invent one.

**File:** `Apps/web/src/hooks/useSales.ts` — add beside `useUpdateDraft`:

```ts
// Drafts don't touch stock/billing — invalidates only the sales domain, same as create/update.
export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesService.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sales.all() });
    },
  });
}
```

**Query keys:** no `query-keys.ts` change — `qk.sales.all()` already covers the drafts drawer's
`qk.sales.list(scope, query)`.

---

### Action 4 — Shared: the dead create-new row (I11 root cause, R2)

**File:** `Apps/web/src/components/shared/autocomplete-input.tsx`

Change `shouldShowCreateNew` (line 104) to require a handler:

```ts
  // "Create new" is only offered when the consumer actually supplied a handler for it — without
  // one the row rendered but clicking it did nothing (handleCreateNew's own `if (onCreateNew)`
  // guard swallowed it), which is exactly what the POS-client category field was showing (S6/I11).
  const shouldShowCreateNew =
    showCreateNew &&
    onCreateNew != null &&
    inputText.trim().length > 0 &&
    !suggestions.some((s) => s.label.toLowerCase() === inputText.toLowerCase());
```

Add `onCreateNew` to the `useCallback` dependency list of `handleKeyDown` **only if** the linter
demands it — `shouldShowCreateNew` is already a dependency there, and it now closes over
`onCreateNew`.

Update the `showCreateNew` prop's meaning in the component doc comment (lines 42–52): it is now a
*suppressor* for consumers that pass `onCreateNew` but want the row hidden — passing no handler
suppresses it by itself.

**Consumers that must keep working, verify by reading each:** `AdminProductsAdd.tsx` (3 sites, all
pass `onCreateNew`), `invoice-line-editor.tsx` (passes both). **No call site needs
`showCreateNew={false}` added** — the POS-client dialogs and the approve-client dialog are fixed by
this change alone.

---

### Action 5 — Translation keys

**File:** `Apps/web/src/config/translations.json`. Insert each beside its existing siblings in the
`staff.pos.*` / `admin.posClients.*` blocks.

| Key | en | fr |
|---|---|---|
| `staff.pos.receipt.newSale` | `New sale` | `Nouvelle vente` |
| `staff.pos.search.defaultPriceLabel` | `Default` | `Par défaut` |
| `staff.pos.payment.creditPreviewLabel` | `Client credit` | `Crédit du client` |
| `staff.pos.quickAddClient.categoryLabel` | `Category` | `Catégorie` |
| `staff.pos.quickAddClient.categoryPlaceholder` | `Select a category` | `Sélectionner une catégorie` |
| `admin.posClients.table.viewLinkedAccount` | `View client account` | `Voir le compte client` |

**Delete nothing.** `staff.pos.ticket.discount` becomes unreferenced when Action 7 removes the
discount input — **leave the key in place**: the `discountAmount` column, the DTO field and the
sale-detail views all still exist (S12 renders sale details), so the label has a foreseeable
consumer. Note it in the report as deliberately retained.

---

### Action 6 — Product card redesign (I1 + I8)

**New file:** `Apps/web/src/pages/staff/pos/pos-pricing.ts`

The resolution rule currently lives as a private function inside `StaffPos.tsx` (line 52), but the
search card now needs it too. Extract it verbatim into a shared POS-local helper — **one
implementation, two consumers** (a component must not import from a page module):

```ts
import type { StaffProductDto } from "@dragon-telecom/contract";

/** The POS price rule (STF-02): a category price when the attached client's category has one,
 *  the product's default sale price otherwise. Kept here rather than in either consumer so the
 *  ticket (StaffPos.tsx) and the search card (PosProductSearch.tsx) can never drift apart. */
export function resolvePosPrice(
  categoryPrices: { categoryId: string; price: number }[],
  defaultSalePrice: number,
  categoryId?: string,
): number {
  if (categoryId) {
    const match = categoryPrices.find((cp) => cp.categoryId === categoryId);
    if (match) return match.price;
  }
  return defaultSalePrice;
}

/** The four figures the POS card lists beneath a product (S6/I8): the default sale price plus one
 *  entry per client category that has its own price. Data-driven — a product priced for only two
 *  categories lists three figures, not four. */
export function posPriceBreakdown(product: StaffProductDto): { label: string; price: number }[] {
  return product.categoryPrices.map((cp) => ({ label: cp.categoryName, price: cp.price }));
}
```

**File:** `Apps/web/src/pages/staff/pos/components/PosProductSearch.tsx`

**6a.** New prop `attachedCategoryId?: string` (the attached client's `categoryId`, or undefined).
Add it to `PosProductSearchProps` with a doc comment: *"When a POS client is attached, the card
shows the price his category resolves to (I1) — the four-price breakdown beneath is unchanged."*

**6b.** Replace the card body (lines 85–93) with the three-row layout:

- **Row 1** — `product.name` on the left (`truncate font-medium`), the **resolved** price on the
  right (`shrink-0 font-semibold`), computed with
  `resolvePosPrice(product.categoryPrices, product.defaultSalePrice ?? 0, attachedCategoryId)`.
- **Row 2** — unchanged: `{brand.name} · {availableQuantity} {t("common.units.inStock")}` in
  `text-xs text-muted-foreground`.
- **Row 3 (new)** — the breakdown, **visually secondary**: `text-xs text-muted-foreground`, entries
  joined by ` · `, leading with the default —
  `{t("staff.pos.search.defaultPriceLabel")} {formatDZD(defaultSalePrice, language)}` followed by
  one `{label} {formatDZD(price, language)}` per `posPriceBreakdown(product)` entry.

Keep the outer `<button>`, its `disabled={product.availableQuantity <= 0}` and its existing classes.
Row 1 must stay a flex row with the name `min-w-0` so long names truncate rather than push the
price off.

**6c.** Update the component's header comment to say the card renders a client-resolved price and a
secondary four-price breakdown.

---

### Action 7 — Remove the discount from the ticket UI (I6)

**File:** `Apps/web/src/pages/staff/pos/components/PosTicket.tsx`

- Delete the `discountAmount` prop, the `onDiscountChange` prop, and the whole discount row
  (lines 133–142) — the `<Input>` and its label. The footer keeps only the total row.
- Remove the now-unused `Input` import **only if** nothing else in the file uses it — the per-line
  charged-price `<Input>` (line 100) still does, so **keep the import**.
- Update the component's header comment to record that the discount is intentionally not editable
  from the POS (S6/I6); the `Sale.discountAmount` column still exists and is always written as 0.

`StaffPos.tsx` stops passing both props in Action 11.

---

### Action 8 — Credit preview above the paid amount (I3)

**File:** `Apps/web/src/pages/staff/pos/components/PosPaymentPanel.tsx`

**8a.** New optional props:

```ts
  /** The attached POS client's credit before this sale — omitted for a walk-in, where no credit
   *  exists to move (S5/D5). */
  previousCredit?: number;
  /** Credit after this sale: previousCredit + (total − paidAmount), computed by the caller with
   *  S5's arithmetic. */
  newCredit?: number;
```

**8b.** Render `<CreditMovementPreview previousCredit={…} newCredit={…} />` **above** the paid-amount
field — between the `<h3>` and the paid-amount `<div className="space-y-1">` — wrapped in a
`{previousCredit !== undefined && newCredit !== undefined && ( … )}` guard, with
`{t("staff.pos.payment.creditPreviewLabel")}` as a small `text-sm text-muted-foreground` heading
above it. Import `CreditMovementPreview` from `@/components/shared/CreditMovementPreview`.

**8c.** Update the header comment — it currently says *"changeDue/newCredit previews are the
caller's job … so this only renders what's passed in"*. Still true of the arithmetic, but the
credit preview now lives **inside** this panel; say that explicitly.

The panel keeps rendering the change-due row and the confirm button unchanged.

---

### Action 9 — Return-to-fresh-POS button (I2)

**File:** `Apps/web/src/pages/staff/pos/components/PosReceiptView.tsx`

Add a required `onNewSale: () => void` prop. Put the two buttons side by side in a
`flex gap-2` row, both `flex-1`: the existing **Print** (`variant="outline"`, unchanged) and a new
primary **New sale** button using `t("staff.pos.receipt.newSale")` with a `Plus` icon from
`lucide-react` (matching the icon convention used elsewhere in this tree).

Update the header comment's parenthetical list of what this view renders.

---

### Action 10 — Quick-add dialog gains a category (I9)

**File:** `Apps/web/src/pages/staff/pos/components/QuickAddPosClientDialog.tsx`

**10a.** New prop `categoryOptions: AutocompleteOption[]` (imported from
`@/components/shared/autocomplete-input`), supplied by the page in Action 11.

**10b.** The dialog currently uses bare `register(...)` calls, not RHF's `<Form>` wrapper, so wire
the category through a `<Controller>` (import from `react-hook-form`) rather than `register` — an
`AutocompleteInput` is not a native input:

```tsx
<div className="space-y-1">
  <Label htmlFor="quick-add-category">{t("staff.pos.quickAddClient.categoryLabel")}</Label>
  <Controller
    control={control}
    name="categoryId"
    render={({ field }) => (
      <AutocompleteInput
        inputId="quick-add-category"
        value={field.value ?? ""}
        onChange={(value) => field.onChange(value === "" ? undefined : value)}
        suggestions={categoryOptions}
        placeholder={t("staff.pos.quickAddClient.categoryPlaceholder")}
      />
    )}
  />
</div>
```
Destructure `control` from the existing `useForm(...)` call. Place the field between phone and the
footer. `categoryId` is **optional** — mapping `""` back to `undefined` keeps the command clean
(the schema is `z.uuid().optional()`, and `""` would fail it).

**No create-new appears here** because no `onCreateNew` is passed — that is Action 4's fix working
(R2), which is also what makes this dialog "match the POS-client dialog component" (I9).

**10c.** `quick-add-pos-client.schema.ts` is **unchanged** — it already declares `categoryId`
(F11). Do not touch it.

---

### Action 11 — `StaffPos.tsx`: the orchestration

**File:** `Apps/web/src/pages/staff/pos/StaffPos.tsx`. This is the largest action; the sub-steps
are independent unless stated.

**11a — use the shared price helper.** Delete the local `resolveCategoryPrice` function (lines
52–62) and import `resolvePosPrice` from `@/pages/staff/pos/pos-pricing`. Its call sites are
`handleSelectProduct` (line 144) and `reresolveLines` (line 187); both pass
`client?.categoryId` where the old helper took the whole client — adjust both call sites to pass
`attachedClient?.categoryId` / `client?.categoryId`.

**11b — feed the card the attached category (I1/I8).** Pass
`attachedCategoryId={attachedClient?.categoryId}` to `<PosProductSearch>`. No refetch is involved:
every price the card needs is already in `StaffProductDto` (F8), so attaching a client re-renders
the list with resolved prices immediately.

**11c — split `resetTicket` (F5 — do this before 11d).** Rename the existing pure-local function to
**`resetTicketState()`** (unchanged body) and add a separate handler for the Clear button:

```ts
  // The Clear button discards the whole ticket AND its persisted draft (S6/I4) — distinct from the
  // post-confirm reset below, which must NOT delete anything: by then the draft row has become the
  // COMPLETED sale.
  const handleClearTicket = () => {
    if (draftId) deleteDraft.mutate(draftId);
    resetTicketState();
  };
```
Wire the Clear button (line 383) to `handleClearTicket`; **leave the confirm success handler
(line 285) calling `resetTicketState()`**. Getting this backwards deletes a completed sale — the
comment above `handleClearTicket` must say so.

**11d — delete the draft when the last line goes (I4/F6).** Add `const deleteDraft = useDeleteDraft();`
beside the other draft mutations, and an effect after the existing sync effect:

```ts
  // Emptying the ticket deletes the draft rather than PATCHing it: UpdateSaleDraftSchema.lines is
  // .min(1), so a zero-line draft is not expressible (S6/I4). Cannot fire on mount — draftId is
  // null until the sync effect above has created a draft, which only happens with ≥1 line.
  useEffect(() => {
    if (lines.length !== 0 || draftId == null) return;
    deleteDraft.mutate(draftId);
    setDraftId(null);
    lastSyncedSnapshotRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, draftId]);
```
Leave the sync effect's own `if (lines.length === 0) return;` guard in place — this effect is what
now handles that case.

**11e — paid amount tracks the total (I5/R1).** Add `const [paidAmountTouched, setPaidAmountTouched] = useState(false);`
and an effect:

```ts
  // The paid amount defaults to the ticket total — the cashier's most common case is exact payment
  // — and keeps following it until they type their own figure (R1). The client's outstanding credit
  // is deliberately NOT added in: this field is what is being paid for THIS sale (I5, "credit
  // excluded"); settling an older balance is the separate record-payment flow.
  useEffect(() => {
    if (!paidAmountTouched) setPaidAmount(total);
  }, [total, paidAmountTouched]);
```
Wrap the panel's callback so typing marks it manual:
`onPaidAmountChange={(value) => { setPaidAmountTouched(true); setPaidAmount(value); }}`.
Reset the flag (`setPaidAmountTouched(false)`) in **`resetTicketState()`** and in
**`handleOpenDraft`**, so both a fresh ticket and a resumed draft start on auto-tracking.

**11f — credit preview above the paid amount (I3/F4).** Delete the `<CreditMovementPreview>` block
at lines 453–458 entirely, along with its now-unused import. Pass the two figures into the payment
panel instead, **with the sign corrected to S5's arithmetic**:

```tsx
<PosPaymentPanel
  total={total}
  paidAmount={paidAmount}
  onPaidAmountChange={(value) => { setPaidAmountTouched(true); setPaidAmount(value); }}
  onConfirm={handleConfirm}
  isConfirming={confirmSale.isPending || isSyncing}
  paidAmountError={paymentError}
  {...(attachedClient
    ? {
        previousCredit: attachedClient.credit,
        // S5: credit += (total − paid). The old inline preview SUBTRACTED this, showing a client
        // who underpays as owing less.
        newCredit: attachedClient.credit + (total - paidAmount),
      }
    : {})}
/>
```
The preview now shows for **every** attached client, including when they overpay (credit falls —
`CreditMovementPreview` renders that in `text-success`), not only when `paidAmount < total`.

**11g — discount out of the UI (I6).** Delete the `discountAmount` state and its `setDiscountAmount`
setter, drop both props from `<PosTicket>`, and make `buildDraftCommand()` send a literal
`discountAmount: 0` with a comment: *"Always 0 — the discount is no longer settable from the POS
(S6/I6); the column and the DTO field remain."* Remove `discountAmount` from the `draftSnapshot`
`useMemo` dependency array. `total` becomes `subtotal`; keep the `total` local (many call sites read
it) and define it as `const total = subtotal;` with a one-line comment, **or** replace `total` with
`subtotal` throughout — either is acceptable, but do it consistently. `handleOpenDraft` must stop
calling `setDiscountAmount` (a resumed draft's stored discount is simply not re-editable).

**11h — the 2-second search beacon (I7/R3).** Add a second debounce off the *raw* query and fire the
beacon from that alone:

```ts
  // The staff-search log records only the last thing typed, 2s after typing stops (S6/I7) — a much
  // longer window than the 300ms that drives the result list, so a cashier typing a product name
  // logs one row, not one per keystroke. POS only: the product-list pages keep their own 300ms
  // beacon (R3).
  const beaconQuery = useDebouncedValue(productQuery, 2000);
  useEffect(() => {
    if (beaconQuery.trim()) sendStaffSearch.mutate({ query: beaconQuery.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beaconQuery]);
```
This **replaces** the existing beacon effect (lines 97–102), which fired off
`debouncedProductQuery` (300 ms). Leave `debouncedProductQuery` itself alone — it still drives
`useStaffProducts`. Update the stale comment at line 94 (*"same beacon StaffProducts.tsx/
AdminProducts.tsx already fire on their own debounced search"*), which is no longer true of the
cadence.

**11i — receipt "New sale" (I2).** Pass `onNewSale={() => { setReceipt(null); resetTicketState(); }}`
to `<PosReceiptView>`. `resetTicketState()` — never `handleClearTicket` — because the draft is gone
(it became the sale); `setReceipt(null)` is what returns the page to the ticket view.

**11j — quick-add categories (I9).** Add `const categories = useCatalogClientCategories();` (from
`@/hooks/useClientCategories`) and build the options exactly as `AdminPosClients.tsx:39` does:

```ts
  const categoryOptions: AutocompleteOption[] = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );
```
Pass `categoryOptions={categoryOptions}` to `<QuickAddPosClientDialog>`. Import the
`AutocompleteOption` type.

**11k — comments.** Update the file header comment if any clause it makes is now false, and the
`reresolveLines` comment (line 180) if 11a changed its signature.

---

### Action 12 — POS clients page (I11, I12)

**File:** `Apps/web/src/pages/admin/pos-clients/components/pos-clients-table.tsx`

Replace the `linkedClientId` cell (line 74) with an arrow link:

```tsx
        cell: ({ row }) =>
          row.original.linkedClientId ? (
            <Link
              to={`/admin/clients/${row.original.linkedClientId}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={t("admin.posClients.table.viewLinkedAccount")}
              className="inline-flex text-primary hover:underline"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            "—"
          ),
```
Imports: `Link` from `react-router-dom`, `ArrowUpRight` from `lucide-react`. The
`stopPropagation` matters — the row itself has an `onRowClick` that opens the detail drawer, and
without it clicking the arrow would do both. Verify the admin client route is
`/admin/clients/:id` in `App.tsx` before writing the path.

**Files:** `add-pos-client-dialog.tsx`, `edit-pos-client-dialog.tsx` — **no change**. Action 4
already removed the dead create-new row from both, and S2 already made the field display the
category name. **Verify both in the browser** (checklist items 21–23) rather than editing them.

---

### Action 13 — I10: verify the S5 payment wiring, change nothing

S5 already made a POS confirm create a `ClientPayment` row and issue the invoice inside the confirm
transaction, and **no response shape changed** (`report-S05.md` §"Contract"). There is therefore no
frontend wiring left to do for I10.

**Do:** confirm a POS sale for a known client with a partial payment and check that a
`ClientPayment` row exists with the right `invoiceId` (checklist items 12–14). **If it does not**,
report it as an S5 regression — do not patch it from the frontend.

---

### Action 14 — Sweep, stale tests, validation gate

**14a. Greps to run and report:**
```
grep -rn "resolveCategoryPrice" Apps/web/src              # must be empty (renamed to resolvePosPrice)
grep -rn "discountAmount" Apps/web/src/pages/staff/pos    # only buildDraftCommand's literal 0
grep -rn "staff.pos.ticket.discount" Apps/web/src         # only the retained translations.json entry
grep -rn "DELETE_DRAFT\|deleteDraft" Apps/web/src Apps/api/src Apps/contract/src
grep -rn "CreditMovementPreview" Apps/web/src             # StaffPos.tsx must no longer be a consumer
```

**14b. Stale tests — list them, do not edit or run.** Start from:
```
grep -rln "StaffPos\|PosTicket\|PosPaymentPanel\|PosReceiptView\|PosProductSearch\|QuickAddPosClientDialog\|AutocompleteInput\|pos-clients-table" Apps/web/tests
grep -rln "updateDraft\|createDraft\|ISalesService" Apps/api/test
```
Expect POS component tests to break on the changed prop shapes (`PosTicket` losing two props,
`PosPaymentPanel`/`PosReceiptView`/`PosProductSearch` gaining them) and the api sales specs to break
on `ISalesService` gaining `deleteDraft`. Name each file and what is stale in it, distinguishing
"already stale from S1/S5" from "newly stale from S6" — `report-S05.md`'s table is the format.

**14c. Validation gate:**
```
Apps/contract: npx tsc --noEmit  &&  npm run lint
Apps/api:      npx tsc --noEmit  (src/** must be clean; test/** errors are the known list)
               npm run lint      (6 pre-existing errors: seed.ts ×3, validate-request.middleware.ts ×3)
Apps/web:      npx tsc --noEmit  (0 errors)
               npx eslint <every file this set touched>   (0 new problems; the repo-wide run has
                                                           ~3900 pre-existing prettier issues)
```
Filter the api `tsc` output to error headers outside `test/` to judge `src/` cleanliness — the
technique S4's and S5's reports used.

**14d.** Write `Docs/Stage-04-Fixes/results/report-S06.md`: what changed per file, the findings, the
sweep output, the stale-test list, the gate, and the checklist below.

---

## 2. Ripple summary

| Layer | File | Change |
|---|---|---|
| prisma | — | **none**. No column, no migration. `Sale.discountAmount` stays and is written 0. |
| contract | `sales.routes.ts` | `SALE_ROUTES.DELETE_DRAFT` (one constant) |
| api | `sales.service.ts`, `sales.interface.ts`, `sales.controller.ts`, `sales.routes.ts` | `deleteDraft` end to end |
| web service | `services/sales.service.ts` | `deleteDraft(id)` |
| web hook | `hooks/useSales.ts` | `useDeleteDraft()` |
| query keys | — | **none** (`qk.sales.all()` already covers it) |
| web shared | `components/shared/autocomplete-input.tsx` | create-new requires `onCreateNew` (I11 root cause) |
| web POS | new `pages/staff/pos/pos-pricing.ts`; `PosProductSearch`, `PosTicket`, `PosPaymentPanel`, `PosReceiptView`, `QuickAddPosClientDialog`, `StaffPos.tsx` | Actions 6–11 |
| web POS clients | `components/pos-clients-table.tsx` | linked-account arrow |
| translations | `config/translations.json` | 6 new keys, 0 deleted |

**Both POS routes are covered by one edit** (F1): `AdminPos.tsx` renders `StaffPos` and needs no
change. **No staff/admin twin work** — S18 has nothing to mirror for POS.

---

## 3. Known limitations to record in the report

1. **A resumed draft still cannot re-price** (F10). Lines rehydrated from the drafts drawer carry
   `categoryPrices: []` and `manualPrice: true`, so attaching a client after resuming does not move
   their prices. Pre-existing and documented in `handleOpenDraft`'s own comment; fixing it needs a
   products-by-ids query the contract does not have. Not in S6's scope — flag it.
2. **I4's middle clause is expected to already work** (F6): removing a non-last product PATCHes the
   draft, because the backend replaces the whole line set. Verify it (checklist 17) and report it as
   a distinct defect if it still misbehaves after this set.
3. **The discount column is retained but never non-zero from the POS** (I6). Any historical sale
   with a non-zero discount still renders it wherever sale details are shown.
4. **`staff.pos.ticket.discount`** is deliberately retained though currently unreferenced (Action 5).

---

## 4. Manual verification checklist

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
