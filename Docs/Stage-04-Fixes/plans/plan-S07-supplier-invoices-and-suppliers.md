# Plan S7 — Supplier Invoices & Suppliers

*Contract + backend (purchasing) + frontend. Consumes S1 and S2.*

Scope, from `app-issues-01.md` §S7 — fourteen items, numbered here as **I1–I14** and referenced by
those tags throughout.

| # | Item |
|---|---|
| **Add Invoice** (`/admin/supplier-invoices/new`) |
| I1 | Remove **save-draft from the UI only** (hook, service and backend untouched); the buttons are **Save** and **Cancel**, where Cancel makes no changes and returns to the supplier-invoices list |
| I2 | **Reject an empty invoice** (no products, and an amount-only of 0) with a message |
| I3 | The supplier field shows the **name** (RC-1) |
| I4 | **Shipping cost defaults to 0** |
| I5 | Product rows show the product **name**, drop create-on-no-result, and become a dropdown plus a small **quick-add button to its left**, opening a dialog ordered like Add Product — family, brand and model (each a dropdown with its own quick-add), then the auto-generated name |
| I6 | Beneath the quantity field, two helper texts: **"qty in stock is …"** and **"avg price is …"**, the latter being the unweighted **`avgPrice`** (D10) |
| I7 | The **reprice section moves to the top** of the invoice information, showing per product the qty in stock beside the avg stock price, and every price field (guest, default, each category) prefilled with current values, each labelled with its previous value in the form `guest price -previous 1000-` or `-previous empty-`, carrying the shared margin display (RC-2) |
| I8 | **A saved invoice can never be cancelled** — remove the affordance entirely |
| **Invoice information** (`/admin/supplier-invoices/:id`) |
| I9 | The record-payment dialog shows the **supplier's** previous credit, not the invoice's |
| I10 | Product rows show **names**, not ids |
| **Supplier invoices list** |
| I11 | Add **supplier reference** (`-` when null), **paid amount**, and **paid date** (S1) |
| **Suppliers** |
| I12 | Allow **re-enabling** a disabled supplier |
| I13 | Block **adding an invoice** to a disabled supplier |
| I14 | A disabled supplier's **information page is read-only** |

---

## 0. Before you start

### 0.1 Sets that must land first

**S1** and **S2** — both executed, reported and owner-approved (`results/report-S01.md`,
`report-S02.md`).

| From | What S7 uses |
|---|---|
| S1 | `AdminProductDto.avgPrice` (the unweighted mean — I6's second helper text) and `AdminProductDto.quantityOnHand` (I6's first). |
| S1 | `ConfirmResultDto.repriceCandidates[].quantityOnHand` and `.avgStockPrice` — both added/renamed in S1, both consumed by I7's rewritten section. |
| S1 | `SupplierInvoiceDto.paidDate` — I11's third new column. |
| S1 | The recorded handoff that `admin.suppliers.averageQuantity` mislabels an avg **cost** as a quantity, and that **S7** should replace that key when it rewrites the reprice section (**F9** below). |
| S2 | The rebuilt `AutocompleteInput` (`value` is the entity id, the input displays the label). I3 and half of I10 are already satisfied by it — **verify only** (F2). |
| S2 | The shared `<MarginDisplay>` (`@/components/shared/MarginDisplay`), already wired into `reprice-prompt.tsx` for guest + default. I7 extends it to every category price. |

**S7 blocks S18** (staff parity) only, and only for the supplier-invoice list columns — there is no
staff supplier-invoice editor. Nothing else in the programme waits on it.

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | With save-draft gone from the UI (I1), what does **Save** do? | **Save = create + confirm.** One click POSTs `createInvoice`, then immediately POSTs `confirmInvoice` with the returned id: stock layers are booked, supplier credit moves, the real `FAC-…`-class reference is allocated. The page then lands on `/admin/supplier-invoices/:id`, read-only, with the reprice section at the top. `DRAFT` still exists in the backend and its endpoints stay untouched — it is simply never a UI state on this page any more. This is what makes I8 ("a saved invoice can never be cancelled") and I7 ("reprice section at the top of the invoice information") simultaneously true. |

### 0.3 Findings from reading the code — read before acting

**F1 — one component serves both routes.** `AdminSupplierInvoiceEditor.tsx` is mounted at
`/admin/supplier-invoices/new` *and* `/admin/supplier-invoices/:id`; `id === "new"` is the
create-flow sentinel (line 61, `const isCreate = id === "new"`). **Every "Add Invoice" item (I1–I8)
and every "Invoice information" item (I9–I10) lands in the same file tree.** Do not go looking for a
second editor page.

**F2 — I3 is already done; I10 is only half done.** `invoice-header-form.tsx:26–37` binds
`value={field.value}` against `supplierOptions` built as `{value: s.id, label: s.name}`, and S2's
rebuilt `AutocompleteInput` derives its displayed text from `value` → that option's `label` whenever
the input is not focused. **I3 is verify-only.** The same is true for the line rows
(`invoice-line-editor.tsx:38–53`) *while the product is inside the loaded page of products* — but the
editor loads `useAdminCatalogProducts({ page: 1, limit: 100 })` (line 81), so on a **CONFIRMED**
invoice whose product falls outside the first 100 the disabled autocomplete renders **empty**, not
the name. The invoice DTO already carries `lines[].productNameSnapshot`. **Action 7c** closes I10
properly by rendering the snapshot as plain text in read-only mode instead of a disabled
autocomplete — which is both correct and immune to the pagination limit.

**F3 — `SupplierInvoiceDto` carries no supplier credit; that is I9's root cause.**
`AdminSupplierInvoiceEditor.tsx:338` passes `previousCredit={invoice.newCredit ?? 0}` —
`SupplierInvoice.newCredit` is the supplier's credit **snapshot at the moment that invoice was
confirmed**, not the supplier's credit now. Recording a payment against an older invoice therefore
previews a movement from a stale figure. The same wrong expression appears at
`StaffInvoices.tsx:240` (`previousCredit={supplierPaymentTarget?.newCredit ?? 0}`), which is
**S8's I-item for the incoming tab** — same root cause, two call sites. **S7 fixes it once in the
contract** (Action 1: `SupplierInvoiceDto.supplierCredit`) and repairs its own call site (Action
11f); **S8's plan repairs the other one** and states that it consumes this field. Do not duplicate
the contract change in S8.

**F4 — I11 needs no backend work at all.** `SupplierInvoiceResponseSchema` already carries
`supplierReference` (optional), `paidAmount` and `paidDate` (S1). `supplier-invoices-table.tsx`
simply never rendered them. Pure column work.

**F5 — I12 needs no backend work either.** `UpdateSupplierSchema.isEnabled` exists
(`purchasing.command.ts:21`) and `PurchasingService.updateSupplier` already writes it
(`purchasing.service.ts:182`). `AdminSuppliers.tsx:46` only ever sends `{ isEnabled: false }`, and
`admin-suppliers-table.tsx:84` hard-disables the button once the supplier is already disabled — so
there is no path back. Pure UI.

**F6 — nothing stops an invoice being written against a disabled supplier (I13).**
`createInvoice` (`purchasing.service.ts:241`) checks only that the supplier **exists**
(`select: { id: true }`). Action 4 adds the guard; Action 13 hides the UI affordance. Both are
needed — the "Add invoice" link at `admin-suppliers-table.tsx:75` is not the only way to reach
`/admin/supplier-invoices/new?supplierId=…`.

**F7 — the quick-add product dialog is built on the wrong shape (I5).**
`inline-create-product.schema.ts` sends `newFamilyName` / `newBrandName` as **free text**, and the
dialog renders three plain `<Input>`s (`inline-create-product-dialog.tsx:52–90`). I5 asks for the
Add Product ordering — family, brand, model as **dropdowns each with their own quick-add**, then the
**auto-generated** name. `AdminProductsAdd.tsx:200–300` already implements exactly that (three
`AutocompleteInput`s with `onCreateNew` committing through
`useCreateCatalogFamily`/`useCreateCatalogBrand`/`useCreateCatalogModel`, plus `recomputeName`
concatenating `family brand model`). **Port that pattern; do not invent a second one.** Note the
Add-Product constraints the port must preserve: the **model** input is `disabled={!brandId}` and its
`onCreateNew` needs `brandId`; `createModel` takes `{ brandId, name }`.

**F8 — I7 needs no contract change.** `ConfirmResultResponseSchema.repriceCandidates[]` already
carries `avgStockPrice`, `quantityOnHand` (S1) and
`current.{guestPrice?, defaultSalePrice?, categoryPrices[]}`, and `CatalogService.getRepriceCandidates`
(`catalog.service.ts:795–830`) genuinely populates all of them. The one thing `current.categoryPrices`
cannot give you is a category the product has **no price row for** — for those, read the full list
from `useCatalogClientCategories()` and render an **empty** field, exactly as **S3's R2** settled for
Product Info. `UpdatePricingSchema` accepts `{ guestPrice: number|null, defaultSalePrice?, categoryPrices?: [{categoryId, price}] }`
as plain JSON (`zJson` passes non-strings straight through), so a single `updatePricing` call can
apply every field at once.

**F9 — three wrong labels in the reprice section, all inside `reprice-prompt.tsx`:**

| Line | Renders | Key used | Why it is wrong |
|---|---|---|---|
| 61 | the avg **stock price** | `admin.suppliers.averageQuantity` ("Average Quantity") | S1's recorded handoff: it is a cost, not a quantity. |
| 65 | the **guest price** input's label | `common.pricing.resolvedPrice` ("Resolved price") | Copy-paste; it is the guest price. |
| 74 | the **default sale price** input's label | `admin.supplierInvoices.editor.reprice.title` | That key is the section heading, reused as a field label. |

Action 9 replaces all three.

**F10 — nothing rejects an empty invoice today (I2).**
`CreateSupplierInvoiceSchema`'s refine only enforces `amountOnly` **XOR** `lines`; `lines: []`
satisfies `!== undefined`, and `amountOnly: 0` passes `.min(0)`. `buildInvoiceLines` then returns
`totalAmount: 0` happily. Confirming such an invoice books nothing, allocates a real reference and
moves the supplier's credit by 0 — a permanent junk row. Guarded in the contract (Action 2), in the
service (Action 5) and in the form schema with a translated message (Action 6).

**F11 — `shippingCost` has no default (I4).** `AdminSupplierInvoiceEditor.tsx:89–93`'s
`defaultValues` omits it, and `invoice-header-form.tsx:78` renders `value={field.value ?? ""}` with
an `onChange` that maps `""` → `undefined`. The field therefore starts **blank**, and a blank field
submits `shippingCost: undefined` (the backend's `?? 0` saves it, but the footer total reads
`watch("shippingCost") ?? 0` and the user sees an empty box where the spec wants a 0).

**F12 — the cancel affordance (I8) is UI-only, exactly like save-draft.** `ConfirmBar` renders the
destructive Cancel-invoice button for every non-`CANCELLED` status (`confirm-bar.tsx:53–58`).
`useCancelPurchasingInvoice` and `PurchasingService.cancelInvoice` stay **untouched** — I1's "leaving
hook, service and backend untouched" is the standing instruction for both removals. Only the imports
and the handler in `AdminSupplierInvoiceEditor.tsx` go.

### 0.4 Standing rules for this set

- **No test file may be edited and no test suite may be run** (D12). Validation is `npx tsc --noEmit`
  and `npm run lint` on `Apps/contract`, `Apps/api` and `Apps/web`.
- Every user-facing string goes through `t()` with a key added to
  `Apps/web/src/config/translations.json` (flat keys, `{ "en": …, "fr": …, "ar": "" }`).
- No new magic strings: anything shared front↔back belongs in `Apps/contract`.
- Read the comments in every file you touch and rewrite any your change falsifies. Several files
  here carry long "ADM-08 / Sprint N" rationale comments that this set makes wrong — they are named
  per action.
- Money caches (`Supplier.credit`, `totalPaid`, `totalInvoiced`, `SupplierInvoice.paidAmount`,
  `paidDate`) stay written inside the owning transaction on a locked row. **No action in this set
  changes any of that arithmetic** — Action 4 and Action 5 only *reject earlier*.

---

## 1. Contract

### Action 1 — `SupplierInvoiceDto.supplierCredit` (I9, and S8's incoming tab)

**File:** `Apps/contract/src/modules/purchasing/purchasing.dtos.ts`

In `SupplierInvoiceResponseSchema`, immediately after the existing `newCredit` field, add:

```ts
  // The supplier's credit *right now* — distinct from previousCredit/newCredit, which are the
  // snapshot bracketing this invoice's own confirm. The record-payment dialog previews
  // `supplierCredit - amount`; using newCredit there previewed a movement from a stale figure
  // (S7 F3).
  supplierCredit: z.number(),
```

Required, not optional: every read path already joins `Supplier` for `supplierName`.

### Action 2 — Reject an empty invoice at the schema level (I2)

**File:** `Apps/contract/src/modules/purchasing/purchasing.command.ts`

Add a second `.refine` to **`CreateSupplierInvoiceSchema`**, chained after the existing one:

```ts
  // An invoice with neither goods nor money is a junk row: confirming it allocates a real
  // reference and moves the supplier's credit by 0, permanently (S7 I2/F10).
  .refine((d) => (d.lines === undefined ? (d.amountOnly ?? 0) > 0 : d.lines.length > 0), {
    message: 'An invoice must carry at least one line, or an amount-only above 0',
    path: ['lines'],
  })
```

Add the equivalent to **`UpdateSupplierInvoiceSchema`**, but only when the field is actually present
(a PATCH may legitimately omit both):

```ts
  .refine((d) => d.lines === undefined || d.lines.length > 0, {
    message: 'An invoice must carry at least one line',
    path: ['lines'],
  })
  .refine((d) => d.amountOnly === undefined || d.amountOnly > 0, {
    message: 'An amount-only invoice must be above 0',
    path: ['amountOnly'],
  })
```

These messages are the backend's 400 text only; the user-facing message is Action 6's translated
form-level refine, in the same duplicate-with-translation pattern the existing
`amountOnlyXorLines` refine already follows.

---

## 2. Backend — `Apps/api/src/modules/purchasing/`

### Action 3 — Emit `supplierCredit` (I9)

**a. `purchasing.service.ts`, line 46** — widen `INVOICE_INCLUDE`:

```ts
const INVOICE_INCLUDE = {
  supplier: { select: { name: true, credit: true } },
  staff: { select: { firstName: true, lastName: true } },
  lines: true,
} satisfies Prisma.SupplierInvoiceInclude;
```

**b. `purchasing.mapper.ts`, line 28** — widen the row type:

```ts
export type SupplierInvoiceRow = SupplierInvoice & {
  supplier: Pick<Supplier, 'name' | 'credit'>;
  …
};
```

**c. `purchasing.mapper.ts`, `toSupplierInvoiceDto`** — emit the field beside `supplierName`:

```ts
      supplierCredit: PurchasingMapper.toMoney(invoice.supplier.credit),
```

(use whatever the private money helper in that class is actually named — read it, do not assume).

**Ripple check:** `toInvoiceDtoWithProjection` spreads `{ ...invoice, lines: … }`, so the new
`supplier.credit` survives untouched. `getSupplier`'s `invoiceRows` and `listInvoices` both already
query with `INVOICE_INCLUDE`. Grep `INVOICE_INCLUDE` in this file and confirm **every** invoice read
uses it before you finish — a read that does not will fail `SupplierInvoiceResponseSchema.parse` at
runtime, not at compile time.

### Action 4 — Block invoices against a disabled supplier (I13)

**File:** `purchasing.service.ts`, `createInvoice` (line 240)

```ts
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: cmd.supplierId },
      select: { id: true, isEnabled: true },
    });
    if (!supplier) throw new BadRequestError('Unknown supplierId');
    // A disabled supplier is out of business with the store: no new purchase document may be
    // opened against it (S7 I13). Existing invoices stay fully readable and payable.
    if (!supplier.isEnabled) throw new BadRequestError('Supplier is disabled');
```

`BadRequestError` is already imported in this file. Do **not** add the same guard to
`createPayment` — settling an existing debt to a supplier you have stopped buying from must stay
possible.

### Action 5 — Service-level empty-invoice guard (I2)

**File:** `purchasing.service.ts`

The contract refines (Action 2) cover the shapes a client can post, but `updateInvoice` composes the
patch with the **existing** row (line 276's `usesLines` branch resolves `cmd.lines ?? existing.lines`),
so a PATCH can still land on an empty result. Add, in `createInvoice` right after
`buildInvoiceLines` returns, and in `updateInvoice` right after `totalAmount` is computed:

```ts
    // Defence in depth behind the contract refine — updateInvoice composes the patch with the
    // stored row, so an empty result is reachable through a shape the schema alone can't see.
    if (totalAmount <= 0) throw new BadRequestError('An invoice must carry goods or an amount above 0');
```

In `createInvoice` the local is `const { linesData, totalAmount } = await this.buildInvoiceLines(…)`;
in `updateInvoice` it is the `let totalAmount` assigned in both branches. Place the check **before**
any write in each method.

---

## 3. Frontend — the invoice editor (`Apps/web/src/pages/admin/supplier-invoices/`)

### Action 6 — Form schema: empty-invoice message + shipping default (I2, I4)

**File:** `components/supplier-invoice.schema.ts`

**a.** Mirror Action 2's refines with translated messages, chained after the existing
`amountOnlyXorLines` refine:

```ts
    .refine((d) => (d.lines === undefined ? (d.amountOnly ?? 0) > 0 : d.lines.length > 0), {
      message: t("admin.supplierInvoices.editor.emptyInvoice"),
      path: ["lines"],
    })
```

**b.** Leave the shape itself alone — `shippingCost` stays `.optional()`; the default is a *form*
default (Action 11a), not a schema change, so the compile-time `_CreateSupplierInvoiceCommandCheck`
guard at the bottom of the file keeps holding.

**c.** Update the file's header comment: it currently claims the wrapper exists solely to translate
the XOR refine. It now carries two refines.

### Action 7 — Invoice line rows (I5 first half, I6, I10)

**File:** `components/invoice-line-editor.tsx`

**a. Props** — the row needs the product's stock figures for I6's helper texts, and a distinct
quick-add handler for I5. Replace `onCreateNewProduct?: (name: string) => void` with:

```ts
  /** Opens the quick-add-product dialog for this row (I5) — a button, not the autocomplete's
   *  own create-on-no-result, which this row no longer offers. */
  onQuickAddProduct?: () => void;
  /** The selected product's live stock figures, for the two helper texts under quantity (I6).
   *  Undefined until a product is picked, or when the product is outside the loaded page. */
  productStock?: { quantityOnHand: number; avgPrice: number };
  /** Read-only rows render this snapshot instead of a disabled autocomplete (I10, F2). */
  productNameSnapshot?: string;
```

**b. Product cell, editable mode** — a flex row: the quick-add button **to the left** of the
dropdown, and `showCreateNew={false}`:

```tsx
      <div className="flex items-center gap-2">
        {onQuickAddProduct && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onQuickAddProduct}
            aria-label={t("admin.supplierInvoices.editor.quickAddProduct")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Controller … render={({ field }) => (
          <AutocompleteInput
            inputId={`invoice-line-${index}-product`}
            value={field.value ?? ""}
            onChange={field.onChange}
            suggestions={productOptions}
            placeholder={t("admin.supplierInvoices.editor.product")}
            showCreateNew={false}
            disabled={disabled}
          />
        )} />
      </div>
```

Drop the `onCreateNew` prop entirely from this call site. `Plus` is already imported in this file
(it is used by `AddLineButton`).

**c. Product cell, read-only mode (I10)** — when `disabled` is true, render plain text instead:

```tsx
        <div className="text-sm font-medium">
          {productNameSnapshot ?? t("common.labels.notAvailable")}
        </div>
```

Use whatever "—"/not-available key already exists in `translations.json`; if none does, add
`admin.supplierInvoices.editor.unknownProduct`. This is what makes I10 hold for a product outside
the editor's first 100 loaded products (F2).

**d. Helper texts beneath quantity (I6)** — directly under the quantity `<Input>`:

```tsx
        {productStock && (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>{t("admin.supplierInvoices.editor.qtyInStock", { qty: productStock.quantityOnHand })}</p>
            <p>{t("admin.supplierInvoices.editor.avgPriceHint", { price: productStock.avgPrice.toLocaleString() })}</p>
          </div>
        )}
```

**`avgPrice`, not `avgStockPrice`** — D10 is explicit that the *unweighted* mean is the
supplier-invoice-context figure, precisely so the buyer can recall what the product previously cost
them. Getting this backwards is the one substantive error possible in this action.

Check the interpolation shape `t()` actually supports in `hooks/useTranslation.ts` before writing
`{ qty: … }` — `admin.clients.table.itemsFound` is called as `t(key, { count })`, so named
interpolation exists; match its exact call signature.

**e.** Rewrite the component's header comment: it describes "a live landed-unit-cost readout", and
now also describes a quick-add button and two stock hints.

### Action 8 — Quick-add product dialog, rebuilt on ids (I5 second half)

**Delete** `components/inline-create-product-dialog.tsx` and
`components/inline-create-product.schema.ts`.

**Create** `components/quick-add-product-dialog.tsx` and
`components/quick-add-product.schema.ts`.

**Schema** (`quick-add-product.schema.ts`):

```ts
export function quickAddProductSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    familyId: z.uuid(t("common.validation.required")),
    brandId: z.uuid(t("common.validation.required")),
    modelId: z.uuid().optional(),
    name: z.string().min(1, t("common.validation.required")),
    initialQuantity: z.literal(0),
  });
}
```

Keep the existing `AssertAssignable<… extends CreateProductCommand>` compile-time guard at the
bottom, retargeted at the new type name. `initialQuantity: 0` stays: the invoice's own confirm is
what moves stock in, and `CreateProductCommand`'s `PRICING_REQUIRES_STOCK` rule means a 0-quantity
create must carry no pricing — which is why this dialog asks for none. Carry that reasoning over
into the new file's header comment (the old file's comment explains it well; keep the substance,
update the field list).

**Dialog** (`quick-add-product-dialog.tsx`) — field order **family → brand → model → name**:

- Three `AutocompleteInput`s, each with its own `onCreateNew`, ported from
  `AdminProductsAdd.tsx:200–291`. Data from `useCatalogFamilies({}, true)`, `useCatalogBrands(true)`,
  `useCatalogModels({ brandId: selectedBrandId }, true, { enabled: !!selectedBrandId })`; mutations
  from `useCreateCatalogFamily`, `useCreateCatalogBrand`, `useCreateCatalogModel`
  (`@/hooks/useCatalogTaxonomy`).
- The model input is `disabled={!brandId}` and its `onCreateNew` early-returns without `brandId`.
- Pass an explicit `inputId` on each (`quick-add-family`, `quick-add-brand`, `quick-add-model`) —
  S2's G2 fix requires it wherever more than one instance renders on a page.
- A `recomputeName(nextFamily, nextBrand, nextModel)` helper identical to
  `AdminProductsAdd.tsx:114–118`, gated on a local `nameManuallyEdited` flag set by the name input's
  `onChange`.
- Labels reuse the existing Add-Product keys: `admin.productsAdd.familyLabel`,
  `admin.productsAdd.brandLabel`, `admin.productsAdd.modelLabel`, `admin.productsAdd.nameLabel`.
  Title: `admin.supplierInvoices.editor.createProduct` (existing).
- Buttons: `common.cancel` / `common.save` (existing keys, as the old dialog used).
- Reset the form and the `nameManuallyEdited` flag on close, so a second quick-add in the same
  session does not open pre-filled (the S3 F4 lesson).

### Action 9 — The reprice section, rewritten (I7)

**File:** `components/reprice-prompt.tsx`

This is the largest single piece of work in the set. `RepriceCandidateRow` becomes:

**a. Per-row form shape** — extend beyond the current two fields:

```ts
const repriceFieldsSchema = z.object({
  guestPrice: z.number().min(0).optional(),
  defaultSalePrice: z.number().min(0).optional(),
  categoryPrices: z.array(z.object({ categoryId: z.uuid(), price: z.number().min(0) })).optional(),
});
```

**b. New prop** — the row needs the full category list, not just the priced ones (F8):

```ts
  categories: { id: string; name: string }[];
```

Threaded from `RepricePrompt`, which the page supplies from `useCatalogClientCategories()`.

**c. Defaults** — prefill every field from `candidate.current`:

```ts
    defaultValues: {
      guestPrice: candidate.current.guestPrice,
      defaultSalePrice: candidate.current.defaultSalePrice,
      categoryPrices: categories.map((c) => ({
        categoryId: c.id,
        price: candidate.current.categoryPrices.find((p) => p.categoryId === c.id)?.price ?? undefined,
      })),
    },
```

A category with no existing price row renders an **empty** input (S3 R2's precedent), not a 0.

**d. Header line** — replace line 61's single mislabelled figure (F9) with the pair I7 asks for:

```tsx
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>{t("admin.supplierInvoices.editor.reprice.qtyInStock")}: {candidate.quantityOnHand}</span>
            <span>{t("admin.supplierInvoices.editor.reprice.avgStockPrice")}: {candidate.avgStockPrice.toLocaleString()}</span>
          </div>
```

**e. Previous-value labels** — the exact format I7 specifies. Add one small local helper inside this
file and use it for every price field:

```tsx
// I7's label format: `guest price -previous 1000-`, or `-previous empty-` when the product had
// no value for that field before this invoice.
function previousLabel(base: string, previous: number | undefined, t: TFunction): string {
  return `${base} ${previous == null ? t("admin.supplierInvoices.editor.reprice.previousEmpty") : t("admin.supplierInvoices.editor.reprice.previous", { value: previous.toLocaleString() })}`;
}
```

with `admin.supplierInvoices.editor.reprice.previous` = `"-previous {value}-"` and
`…previousEmpty` = `"-previous empty-"`.

**f. Fields** — guest price, default sale price, then one input per category, each with:
- `<Label>{previousLabel(t(<its own label key>), <its current value>, t)}</Label>`
- an `<Input type="number" step="0.01">` registered with **`setValueAs: (raw) => raw === "" ? undefined : Number(raw)`**, *not* `valueAsNumber` — S3's F1 documented this exact trap: `valueAsNumber` on an empty optional numeric input yields `NaN`, `z.number().optional()` rejects `NaN`, and `handleSubmit`'s valid callback never fires, so the apply silently does nothing. The file currently uses `valueAsNumber` on both fields (lines 69, 78) and **must be changed**, because with an empty-by-default category field the bug is now reachable on every apply.
- `<MarginDisplay price={watch(<field>)} cost={candidate.avgStockPrice} />` beneath it. Margins are
  computed against **`avgStockPrice`** (D10/RC-2) — the opposite figure from I6's helper text, and
  deliberately so.

Field label keys: guest → **new** `admin.supplierInvoices.editor.reprice.guestPrice`; default →
**new** `admin.supplierInvoices.editor.reprice.defaultSalePrice`; category → the category's own
`name` plus the existing `admin.productsAdd.categoryPriceLabel`. Delete the two wrong usages at
lines 65 and 74 (F9).

**g. Apply** — strip empty category rows before submitting, so an untouched empty field does not
post a 0 price:

```tsx
          onSubmit={handleSubmit((values) => {
            onApply(candidate.productId, {
              guestPrice: values.guestPrice ?? null,
              ...(values.defaultSalePrice != null ? { defaultSalePrice: values.defaultSalePrice } : {}),
              categoryPrices: (values.categoryPrices ?? []).filter((c) => c.price != null),
            });
            setExpanded(false);
          })}
```

`guestPrice` is `.nullable()` in `UpdatePricingSchema`, so an emptied field clears the stored guest
price — which is the behaviour "-previous empty-" implies. Do not send `undefined` there.

**h.** Rewrite the component header comment: it says "shown only after a successful confirm" (still
true) but the section is now rendered **above** the invoice, not below it, and covers every price
field rather than two.

### Action 10 — The action bar: Save + Cancel (I1, I8)

**File:** `components/confirm-bar.tsx`

Reduce the component to two buttons and drop the status branching entirely:

```tsx
interface ConfirmBarProps {
  onSave?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  /** Set when a write comes back 409 — surfaced inline, not as a toast. */
  alreadyConfirmedError?: boolean;
}
```

- **Cancel** — `variant="outline"`, always rendered, label `admin.supplierInvoices.editor.cancelEdit`
  (**new** key, "Cancel"; do **not** reuse `admin.supplierInvoices.editor.cancel`, which means
  "cancel the invoice" and is now dead — see Action 15). Cancel writes nothing.
- **Save** — primary, rendered only when `onSave` is passed (i.e. the invoice is still editable),
  label `admin.supplierInvoices.editor.save` / `common.saving` while pending.
- Delete the `status` prop, the `SupplierInvoiceStatus` import, the `CheckCircle` and `Ban` imports,
  the Confirm button and the destructive Cancel-invoice button.
- Rewrite the header comment, which currently documents the three-status branching this action
  removes.

### Action 11 — The editor page (I1, I4, I6, I7, I8, I9)

**File:** `AdminSupplierInvoiceEditor.tsx`

**a. Shipping default (I4)** — add `shippingCost: 0` to `defaultValues` (line 89). The `values`
branch for a fetched invoice already carries the stored figure, so this only affects the create flow.

**b. Save = create + confirm (I1/R1)** — replace `handleSaveDraft` and `handleConfirm` with one
handler:

```tsx
  // R1 — DRAFT is no longer a UI state: Save creates the invoice and immediately confirms it, so
  // stock, supplier credit and the real reference all land in one click. The create/update/confirm
  // endpoints and their hooks are untouched (I1: "UI only").
  const handleSave = handleSubmit((values) => {
    setAlreadyConfirmedError(false);
    if (isCreate) {
      createInvoice.mutate(values, {
        onSuccess: (dto) =>
          confirmInvoice.mutate(dto.id, {
            onSuccess: (result) => {
              setRepriceCandidates(result.repriceCandidates);
              toast.success(t("admin.supplierInvoices.editor.saveSuccess"));
              navigate(`/admin/supplier-invoices/${dto.id}`, { replace: true });
            },
          }),
      });
    } else if (id) {
      updateInvoice.mutate(
        { id, command: values },
        {
          onSuccess: () =>
            confirmInvoice.mutate(id, {
              onSuccess: (result) => {
                setRepriceCandidates(result.repriceCandidates);
                toast.success(t("admin.supplierInvoices.editor.saveSuccess"));
              },
            }),
          onError: (err) => {
            if (axios.isAxiosError(err) && err.response?.status === 409) setAlreadyConfirmedError(true);
          },
        },
      );
    }
  });
```

The `navigate` after confirm (not after create) is deliberate: navigating first would remount the
page against a still-DRAFT invoice and the reprice candidates would be lost. `replace: true` keeps
Back from returning to `/new`.

**c. Cancel (I1)** — `const handleCancelEdit = () => navigate("/admin/supplier-invoices");`. It
writes nothing, per the brief.

**d. Remove the cancel-invoice affordance (I8)** — delete `handleCancel`, the
`useCancelPurchasingInvoice` import and its `const cancelInvoice = …`. Leave the hook file and the
backend method in place (F12).

**e. Reprice at the top (I7)** — move the `<RepricePrompt … />` block from below the `<form>` to
**above** it, as the first child of the page's root `<div className="space-y-6">` after the
`PageHeader` row. Pass the category list through:

```tsx
  const clientCategories = useCatalogClientCategories();
  …
  <RepricePrompt
    candidates={repriceCandidates}
    categories={(clientCategories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
    onApply={handleApplyReprice}
    onSkip={handleSkipReprice}
    onSkipAll={handleSkipAllReprice}
    isApplying={updatePricing.isPending}
  />
```

`useCatalogClientCategories` comes from `@/hooks/useClientCategories`.

**f. Supplier credit into the payment dialog (I9)** — change line 338 to
`previousCredit={invoice.supplierCredit}` (Action 1's new field; no `?? 0` needed, it is required).
Delete the surrounding staleness — the dialog's `key={invoice.id}` line and its comment stay.

**g. Line-editor wiring (I5, I6, I10)** — the map at line 273 becomes:

```tsx
              <InvoiceLineEditor
                key={field.id}
                index={index}
                control={control}
                productOptions={productOptions}
                quantity={watchedLines?.[index]?.quantity ?? 0}
                unitCost={watchedLines?.[index]?.unitCost ?? 0}
                onRemove={() => remove(index)}
                onQuickAddProduct={isEditable ? () => handleQuickAddProduct(index) : undefined}
                productStock={productStockById.get(watchedLines?.[index]?.productId ?? "")}
                productNameSnapshot={invoice?.lines[index]?.productNameSnapshot}
                disabled={!isEditable}
              />
```

with, near `productOptions`:

```tsx
  // I6's two helper texts read the *unweighted* avgPrice (D10 — the supplier-invoice-context
  // figure), never avgStockPrice, which drives margins instead.
  const productStockById = useMemo(
    () =>
      new Map(
        (products.data?.items ?? []).map((p) => [
          p.id,
          { quantityOnHand: p.quantityOnHand, avgPrice: p.avgPrice },
        ]),
      ),
    [products.data],
  );
```

`handleQuickAddProduct` is the renamed `handleCreateNewProduct`; `handleSaveNewProduct` keeps its
shape but now takes `QuickAddProductFormValues`, and its `createProduct.mutate({ command: values,
images: [] })` call is unchanged.

**h. Comments** — the file's 4-line header comment describes the DRAFT/CONFIRMED editor flow that
this action replaces. Rewrite it to state R1's create+confirm behaviour and that DRAFT survives only
as a backend state.

---

## 4. Frontend — the list and the suppliers pages

### Action 12 — Supplier-invoices list columns (I11)

**File:** `components/supplier-invoices-table.tsx`

Insert after the existing `reference` column:

```tsx
      {
        accessorKey: "supplierReference",
        header: t("admin.supplierInvoices.table.supplierReference"),
        cell: ({ row }) => row.original.supplierReference ?? "-",
      },
```

and after `totalAmount`:

```tsx
      {
        accessorKey: "paidAmount",
        header: t("admin.supplierInvoices.table.paidAmount"),
        cell: ({ row }) => formatCurrency(row.original.paidAmount),
      },
      {
        accessorKey: "paidDate",
        header: t("admin.supplierInvoices.table.paidDate"),
        cell: ({ row }) =>
          row.original.paidDate ? formatDateTime(row.original.paidDate, language) : "-",
      },
```

`paidDate` is `z.iso.datetime()`; use `formatDateTime` from `@/lib/utils` and take `language` from
`useTranslation()` (the hook is already called in this component; `language` is not yet destructured
— add it). Bump `TableSkeleton columns={5}` → `columns={8}`.

### Action 13 — Enable/disable a supplier (I12, I13)

**a. `components/admin-suppliers-table.tsx`** — replace the one-way disable button in
`renderActions`:

```tsx
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleEnabled(supplier.id, !supplier.isEnabled)}
          className={supplier.isEnabled ? "h-8 w-8 p-0 text-destructive hover:text-destructive" : "h-8 w-8 p-0"}
          aria-label={
            supplier.isEnabled
              ? t("admin.suppliers.table.disable")
              : t("admin.suppliers.table.enable")
          }
        >
          {supplier.isEnabled ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
```

Rename the prop `onDisable: (supplierId: string) => void` →
`onToggleEnabled: (supplierId: string, nextEnabled: boolean) => void`. Import `RotateCcw` from
`lucide-react`.

**b. Same file** — hide the "Add invoice" link for a disabled supplier (I13):

```tsx
        {supplier.isEnabled && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
            <Link to={`/admin/supplier-invoices/new?supplierId=${supplier.id}`}>
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        )}
```

**c. Same file** — the header comment's closing sentence ("delete becomes disable … suppliers are
never hard-deleted") is still true but incomplete; extend it to say the action is now a two-way
toggle.

**d. `AdminSuppliers.tsx`** — replace `handleDisable`:

```tsx
  const handleToggleEnabled = useCallback(
    (supplierId: string, nextEnabled: boolean) => {
      updateSupplier.mutate(
        { id: supplierId, command: { isEnabled: nextEnabled } },
        {
          onSuccess: () =>
            toast.success(
              nextEnabled
                ? t("admin.suppliers.enableSuccess")
                : t("admin.suppliers.disableSuccess"),
            ),
        },
      );
    },
    [updateSupplier, t],
  );
```

and pass it as `onToggleEnabled`.

### Action 14 — A disabled supplier's page is read-only + re-enable (I14, I12)

**a. `components/supplier-details-section.tsx`** — accept a `readOnly?: boolean` prop; when true,
hide the Edit button entirely (`{!isEditMode && !readOnly && (<Button …>Edit</Button>)}`) and force
`disabled={!isEditMode || readOnly}` on every field. Also render a one-line notice at the top of the
card body when `readOnly`:

```tsx
        {readOnly && (
          <Alert className="mb-4">
            <AlertDescription>{t("admin.suppliers.disabledReadOnly")}</AlertDescription>
          </Alert>
        )}
```

(`Alert`/`AlertDescription` from `@/components/ui/alert`.)

**b. `components/supplier-information-header.tsx`** — add an `onEnable?: () => void` prop and, when
the supplier is disabled, render a re-enable button beside Refresh plus a disabled badge:

```tsx
          {!supplier.isEnabled && (
            <Badge variant="destructive">{t("admin.suppliers.disabledBadge")}</Badge>
          )}
          …
          {!supplier.isEnabled && onEnable && (
            <Button onClick={onEnable} variant="outline" size="sm" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("admin.suppliers.table.enable")}
            </Button>
          )}
```

`Badge` is already imported here; add `RotateCcw`.

**c. `AdminSupplierInformation.tsx`** — wire both:

```tsx
  const isDisabled = !data.supplier.isEnabled;

  const handleEnable = () => {
    if (!id) return;
    updateSupplier.mutate(
      { id, command: { isEnabled: true } },
      { onSuccess: () => toast.success(t("admin.suppliers.enableSuccess")) },
    );
  };
```

Pass `onEnable={isDisabled ? handleEnable : undefined}` to the header and `readOnly={isDisabled}` to
the details section. `useUpdatePurchasingSupplier` is already imported and instantiated in this file.

**d.** The page currently uses `updateSupplier.mutateAsync` inside `handleSave` with a try/catch;
keep that exactly as-is — only the new enable path is added.

---

## 5. Translations, gate, report

### Action 15 — Translation keys

**File:** `Apps/web/src/config/translations.json` (flat keys, `{ en, fr, ar: "" }`).

**Add:**

| Key | en | fr |
|---|---|---|
| `admin.supplierInvoices.editor.emptyInvoice` | An invoice must have at least one product, or an amount above 0 | Une facture doit comporter au moins un produit, ou un montant supérieur à 0 |
| `admin.supplierInvoices.editor.saveSuccess` | Invoice saved and confirmed | Facture enregistrée et confirmée |
| `admin.supplierInvoices.editor.cancelEdit` | Cancel | Annuler |
| `admin.supplierInvoices.editor.quickAddProduct` | Add a new product | Ajouter un nouveau produit |
| `admin.supplierInvoices.editor.qtyInStock` | Qty in stock is {qty} | La quantité en stock est {qty} |
| `admin.supplierInvoices.editor.avgPriceHint` | Avg price is {price} | Le prix moyen est {price} |
| `admin.supplierInvoices.editor.unknownProduct` | Unknown product | Produit inconnu |
| `admin.supplierInvoices.editor.reprice.qtyInStock` | Qty in stock | Quantité en stock |
| `admin.supplierInvoices.editor.reprice.avgStockPrice` | Avg. stock price | Prix moyen du stock |
| `admin.supplierInvoices.editor.reprice.guestPrice` | Guest price | Prix visiteur |
| `admin.supplierInvoices.editor.reprice.defaultSalePrice` | Default sale price | Prix de vente par défaut |
| `admin.supplierInvoices.editor.reprice.previous` | -previous {value}- | -précédent {value}- |
| `admin.supplierInvoices.editor.reprice.previousEmpty` | -previous empty- | -précédent vide- |
| `admin.supplierInvoices.table.supplierReference` | Supplier ref. | Réf. fournisseur |
| `admin.supplierInvoices.table.paidAmount` | Paid | Payé |
| `admin.supplierInvoices.table.paidDate` | Paid on | Payé le |
| `admin.suppliers.table.enable` | Re-enable | Réactiver |
| `admin.suppliers.table.disable` | Disable | Désactiver |
| `admin.suppliers.enableSuccess` | Supplier re-enabled | Fournisseur réactivé |
| `admin.suppliers.disabledBadge` | Disabled | Désactivé |
| `admin.suppliers.disabledReadOnly` | This supplier is disabled — its information is read-only. Re-enable it to make changes. | Ce fournisseur est désactivé — ses informations sont en lecture seule. Réactivez-le pour les modifier. |

**Delete** (verify with `grep -rn "<key>" Apps/web/src` that nothing else consumes them first):

- `admin.suppliers.averageQuantity` — S1's flagged mislabel; Action 9 replaces its only consumer.
- `admin.supplierInvoices.editor.confirm` — its only consumer was `ConfirmBar`'s Confirm button.
- `admin.supplierInvoices.editor.cancel` and `admin.supplierInvoices.editor.cancelReason` — their
  only consumers were the removed cancel-invoice affordance. **Check `cancelReason` carefully**: if
  any other page still reads it, leave it.

Verify the file still parses (`node -e "require('./Apps/web/src/config/translations.json')"`).

### Action 16 — Validation gate

```
Apps/contract: npx tsc --noEmit      npm run lint
Apps/api:      npx prisma validate   npx tsc --noEmit   npm run lint
Apps/web:      npx tsc --noEmit      npm run lint
```

No schema change and no migration in this set — `prisma validate` is a sanity check only.

`Apps/api`'s `tsc` includes `test/**`; **every error there is pre-existing staleness from S1/S5**
(itemised in `report-S01.md` and `report-S05.md`). Confirm `src/**` is clean by filtering the error
headers to paths outside `test/`. Lint has a **6-error pre-existing baseline** on `prisma/seed.ts`
and `validate-request.middleware.ts` — neither is touched by this set.

Then run the stale-test sweep (do **not** edit or run anything found):

```
grep -rln "inline-create-product\|onCreateNewProduct\|onDisable\|averageQuantity" Apps/web/tests
grep -rln "supplierCredit\|SupplierInvoiceRow" Apps/api/test
```

### Action 17 — Report

Write `Docs/Stage-04-Fixes/results/report-S07.md` following `report-S06.md`'s structure: what
changed per action, findings during execution, the validation gate output, the stale-test list, the
handoffs below, and the checklist in §7 reproduced for the owner to tick.

**Handoffs to record explicitly:**

1. **To S8** — `SupplierInvoiceDto.supplierCredit` now exists and is populated on every read.
   S8's incoming-invoice payment dialog (`StaffInvoices.tsx:240`) must consume it; S8 must **not**
   re-add the contract field.
2. **To S18** — the supplier-invoice list gained three columns. There is no staff twin of this page
   today; confirm that when S18 audits staff parity.
3. Anything you discover about `updateInvoice` reaching a state the new `totalAmount <= 0` guard
   rejects on a previously-valid flow.

---

## 6. Dependency order

Actions are already in execution order. The hard edges:

- **1 → 3 → 11f** (contract field → mapper → the call site that reads it).
- **2 → 5 → 6** (contract refine → service guard → translated form message).
- **7 → 8 → 11g** (line-editor props → the dialog they open → the page that wires both).
- **9 → 11e** (the rewritten section's new `categories` prop → the page that supplies it).
- **10 → 11b/c/d** (the reduced action bar → the handlers it now calls).
- **13a → 13d** (the renamed prop → its caller). Do not split these across a compile check.
- Actions 12, 14 are independent of everything above and can be done at any point after Action 1.

---

## 7. Manual verification checklist

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
