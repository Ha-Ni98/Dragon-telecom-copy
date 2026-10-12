# Plan S31 — Shared product-picker dialog (repairs & supplier invoices)

Execution plan for **set 31** of `Docs/Stage-04-Fixes/sets-30-33.md`.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

**S30 must be in the working tree.** The owner approved it. It is not committed yet, so do not
reset or stash it.

S31 depends on two S30 pieces:
- `repairs.service.ts`'s `lockRepair` helper and its "decide inside the transaction" rule.
  S31's batch add reuses them.
- The `qk.catalog.all()` invalidation in `useRepairs.ts`. S31's new hook copies it.

S31 is independent of S32 and S33.

### 0.2 What the set asks for, mapped onto the code as it is today

| Set requirement | Current state (verified) | Consequence for this plan |
|---|---|---|
| "Add products" button replaces the inline search field | **Repairs:** the ticket drawer has one inline add-part form: one `AutocompleteInput`, qty, price, serials and an **Add part** submit that reserves immediately (`RepairTicketDetail.tsx:215-267`). **Supplier invoices:** every line row has its own `AutocompleteInput` and a per-row quick-add "+" (`invoice-line-editor.tsx:53-84`). | Both inline pickers are removed, and one **Add products** button opens the dialog. |
| "Same server-side search … whole catalog — not a recent-20 slice" | **Repairs** already search server-side (`useStaffProducts({ search, page: 1, limit: 10 })`, `StaffRepairs.tsx:91-96`). **Supplier invoices do NOT:** the editor loads `useAdminCatalogProducts({ page: 1, limit: 100 })` once and filters it in the browser (`AdminSupplierInvoiceEditor.tsx:93-97`). Any product past the newest 100 cannot be picked today. | The supplier consumer moves to server-side search (`useAdminCatalogProducts({ search, page, limit: 10 })`). This fixes a real latent bug. |
| "Hands the selected products to the existing list below … quantity and price stay editable until the user presses the existing save/add-parts action" | **Supplier invoices:** the list exists (`useFieldArray` `lines`, saved by **Save**). **Repairs: no staged list exists.** Each part is reserved the moment its single-row form is submitted. | Repairs gain a **staged parts list**, client-side and not reserved, with editable qty/price/serials. The existing **Add part(s)** button submits it. A new **batch endpoint** reserves all staged parts in one transaction (decision P1). |
| Repairs: four prices, as on the POS card | The POS card shows `defaultSalePrice` plus each `categoryPrices[]` entry (`pos-pricing.ts:21-23`, `PosProductSearch.tsx:93-130`). `StaffProductDto` carries all four. | Four price columns are read from `StaffProductDto`. Category column headers come from `useCatalogClientCategories()`, whose `GET /admin/client-categories` route is `staffOrAdmin` (`catalog.routes.ts:129`). |
| Repairs: qty 0 disabled | `StaffProductDto.availableQuantity` = on-hand − reserved, never below 0. `reserve` checks against exactly this figure (`inventory.service.ts:54-59`). | The quantity column shows `availableQuantity`. Rows with `availableQuantity <= 0` are disabled. |
| Supplier: `avgPrice` + `avgStockPrice`, qty 0 selectable | `AdminProductDto` carries `quantityOnHand`, `avgPrice` and `avgStockPrice`. | The quantity column shows `quantityOnHand`. No row is ever disabled. |
| Supplier: keep quick-add | `QuickAddProductDialog` and `useCreateProduct` are owned by the editor page. The product is created with `images: []`, and `createProduct` returns an `AdminProductDto` (`catalog.service.ts:129-139`). | Quick-add moves **into the supplier picker**. The created `AdminProductDto` is added to the picker's selection straight away. |

### 0.3 Decisions this plan takes on its own — list them in the report

| # | Decision | Why |
|---|---|---|
| P1 | **New batch endpoint `POST …/repairs/:id/parts/batch`** (`AddRepairPartsSchema { parts: AddRepairPartCommand[] (1..50) }`). All staged parts are reserved in **one** transaction, **all or nothing**. The single-part endpoint stays as it is: same behaviour, now implemented as a batch of one. | If one staged part out of five fails `INSUFFICIENT_STOCK`, sequential single POSTs would leave four reserved, and the tech could not easily tell which. One transaction leaves nothing reserved, and the staged list stays on screen to fix. The cap of 50 bounds one request's work on the single shared CPU. |
| P2 | **The staged row's unit price defaults to `defaultSalePrice`.** | This is today's single-row behaviour (`RepairTicketDetail.tsx:225`). The picker now shows all four prices, so the tech can type a category price if needed. Defaulting to the attached client's category price would be a new pricing rule, so it is not done here. |
| P3 | **The supplier line's unit cost defaults to 0**, as it does today. The picker shows `avgPrice`/`avgStockPrice` for recall only. | Pre-filling a cost the buyer did not type risks invoices posted at a stale cost. |
| P4 | **Duplicate products are not added twice by one "Add".** A product already in the staged repair list, or already on a supplier-invoice line, is skipped. | Adding the same product again in one session is almost always a mis-click. To add more, raise the quantity on the existing row. (On repairs, a product already **saved** as a part can still be staged again: that is a deliberate second fitting, and the backend has always allowed it.) |
| P5 | **Default ordering with an empty search** is each endpoint's own fallback. Repairs (`/staff/products`) show name A→Z. Supplier invoices (`/admin/products`) show newest first. | Newest-first puts a just-created product at the top for the buyer. Neither endpoint changes. |
| P6 | **The shared dialog is controlled and presentational.** Search text, page and the selection `Map` live in a thin consumer wrapper, which also calls the data hook. The shared component renders and reports events. | It keeps the layering rule (component → hook) in the wrapper, and lets the supplier wrapper put a quick-added product into the selection. |
| P7 | **A supplier invoice now needs at least one product line** (client-side refine, translated message). The line-mode switch resets `lines` to `[]`, not to one blank line. | The form used to start with a blank line that failed `z.uuid()`, which hid this rule. With picker-only lines, an empty list would otherwise save and confirm a zero invoice: the backend has no empty-lines guard (`purchasing.service.ts:655` only skips projection). |

---

## §1 — Contract (`Apps/contract`)

### Action 1.1 — `src/modules/repairs/repairs.command.ts`

Below `AddRepairPartSchema`, add:

```ts
// S31 (P1) — the ticket drawer stages parts client-side (picked from the shared product-picker
// dialog, qty/price/serials still editable) and reserves them all at once with this command:
// one transaction, all or nothing, so a shortfall on one part leaves nothing reserved. Capped
// at 50 lines to bound one request's work.
export const AddRepairPartsSchema = z.object({
  parts: z.array(AddRepairPartSchema).min(1).max(50),
});
export type AddRepairPartsCommand = z.infer<typeof AddRepairPartsSchema>;
```

### Action 1.2 — `src/modules/repairs/repairs.routes.ts`

After `ADMIN_PARTS`, add:

```ts
  // S31 — stage-then-reserve: every staged part in one transaction (all or nothing).
  STAFF_PARTS_BATCH: '/staff/repairs/:id/parts/batch',
  ADMIN_PARTS_BATCH: '/admin/repairs/:id/parts/batch',
```

---

## §2 — Backend (`Apps/api`)

### Action 2.1 — `src/modules/repairs/repairs.interface.ts`

Add to `IRepairsService`, below `addPart`:

```ts
  // S31 — reserve(PENDING_REPAIR) for every staged part in ONE transaction (all or nothing).
  addParts(id: string, cmd: AddRepairPartsCommand, actor: JWTPayload): Promise<RepairDto>;
```

Import `AddRepairPartsCommand`.

### Action 2.2 — `src/modules/repairs/repairs.service.ts`

1. **New `addParts`.** Rewrite the existing `addPart` body into this method, and make `addPart`
   delegate with `return this.addParts(id, { parts: [cmd] }, actor);`. Its single-part
   behaviour, errors and response stay identical.
   - **Before the transaction:**
     - `findUnique` the repair (404) and `assertEditable` (fast fail).
     - Resolve names in one query:
       `const products = await this.prisma.product.findMany({ where: { id: { in: [...new Set(cmd.parts.map((p) => p.productId))] } }, select: { id: true, name: true } })`.
     - Any id that comes back missing →
       `throw new BadRequestError(\`Unknown productId: ${missingId}\`)`, the same message as
       today.
   - **Inside the transaction:**
     - `const locked = await this.lockRepair(tx, id); this.assertEditable(locked.status);`.
     - For each part, **in command order**: `inventory.reserve(…, { referenceType: 'REPAIR', referenceId: id, staffId })`, then `tx.repairPart.create(…)` using `RepairsMapper.toPartCreateInput(part, { productName })`.
     - The first shortfall throws the engine's `ConflictError('INSUFFICIENT_STOCK', { productId, … })` and rolls back the whole transaction.
     - Then recompute `partsTotal` **once** and write `totalAmount = locked.labourPrice + partsTotal`.
   - **After commit:** `flushEvents(capturedTx!)`, then return the DTO.
2. **Comments.**
   - Move the "reserve(PENDING_REPAIR) — shortfall throws …" and S30 (F6) comment block onto
     `addParts`, adding one S31 sentence: the drawer's staged list arrives here, and all-or-
     nothing means a failed batch leaves no partial reservation.
   - `addPart` gets a one-line comment: "single-part form of addParts; kept for API
     compatibility — the web client uses the batch since S31".

### Action 2.3 — `src/modules/repairs/repairs.controller.ts`

Add an `addParts` handler, the same shape as `addPart`. Validated body cast to
`AddRepairPartsCommand`, response `sendSuccess(res, result, 201)`.

### Action 2.4 — `src/modules/repairs/repairs.routes.ts`

Import `AddRepairPartsSchema`. Mount `STAFF_PARTS_BATCH` (`staffRepairsOrAdmin`) and
`ADMIN_PARTS_BATCH` (`adminOnly`) with
`validateRequest({ params: RepairIdParamsSchema, body: AddRepairPartsSchema })` →
`controller.addParts`, directly after the `*_PARTS` POST routes, under an `// S31` comment.

These do not collide with the `*_PART_BY_ID` routes: the paths differ, and those routes are
mounted on `DELETE` only.

---

## §3 — Frontend (`Apps/web`)

### Action 3.1 — New `src/types/product-picker.types.ts`

```ts
import type { ReactNode } from "react";

// S31 — the shared product-picker dialog (components/shared/product-picker-dialog.tsx) is generic
// over its row type; each consumer supplies the columns its context needs (repairs: available
// quantity + the four sale prices; supplier invoices: on-hand + avgPrice/avgStockPrice).
export interface ProductPickerRow {
  id: string;
  name: string;
  barcode?: string;
}

export interface ProductPickerColumn<T extends ProductPickerRow> {
  id: string;
  header: string; // already translated by the consumer
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}
```

### Action 3.2 — New `src/components/shared/product-picker-dialog.tsx` (the shared dialog)

`export function ProductPickerDialog<T extends ProductPickerRow>(props)`. It is **controlled and
presentational** (P6): it never calls a hook other than `useTranslation`.

**Props:**
- `open`, `onOpenChange`
- `title: string`
- `search: string`, `onSearchChange: (v: string) => void`
- `rows: T[] | undefined`, `isLoading?`, `isError?`, `onRetry?`
- `page: number`, `totalPages: number`, `onPageChange: (p: number) => void`
- `columns: ProductPickerColumn<T>[]`
- `selected: ReadonlyMap<string, T>`, `onToggle: (row: T, checked: boolean) => void`, `onClearSelection: () => void`
- `isRowDisabled?: (row: T) => boolean`, `disabledRowHint?: string`
- `onAdd: () => void`
- `footerStart?: ReactNode` (the supplier's "new product" button)

**Layout:**
- `DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-3"`.
- These parts stay pinned (`shrink-0`):
  - the header (title);
  - the search `Input` (lucide `Search` icon, placeholder `common.productPicker.searchPlaceholder`, `autoFocus`);
  - the **selection bar**: `t("common.productPicker.selectedCount", { count: selected.size })` on the left, and on the right a ghost `Button` labelled `common.actions.clearSelection`, disabled when `selected.size === 0`, calling `onClearSelection`.
- **Body:** `div className="min-h-0 flex-1 overflow-auto rounded-md border"` wrapping a
  `@/components/ui/table` table. This scrolls on its own, which satisfies "scrollable body,
  search and action bar stay in view".
  - First column: a `Checkbox` (`checked={selected.has(row.id)}`, `disabled={isRowDisabled?.(row)}`, `aria-label={t("common.productPicker.select", { name: row.name })}`).
  - Second column: the name, with the barcode in `text-xs text-muted-foreground` under it when present.
  - Then `columns`, right-aligned where `align === "right"`.
  - The whole row is clickable to toggle (`cursor-pointer`). A disabled row gets `opacity-50`, `cursor-not-allowed` and `title={disabledRowHint}`, and ignores clicks.
  - **Loading:** 5 `Skeleton` rows.
  - **Error:** `common.productPicker.error` plus a retry button (`common.actions.tryAgain`) when `onRetry` is given.
  - **Empty:** `common.productPicker.empty`. This shows only when the search returns nothing. An empty search still lists products, because the consumers always query.
- **Pagination row (`shrink-0`):**
  - Outline `Button` `common.productPicker.previous`, disabled at `page <= 1`.
  - Centred `t("common.pagination.pageOf", { page, total: Math.max(totalPages, 1) })`.
  - Outline `Button` `common.productPicker.next`, disabled at `page >= totalPages`.
  - The row is **always rendered**, even on a single page (the set asks for explicit prev/next).
  - Do not reuse `SimplePagination`: it hides itself on one page and its links are `href="#"`.
- **Footer (`DialogFooter`, `shrink-0`):**
  - `footerStart` on the left (`sm:mr-auto`).
  - Then an outline Cancel (`common.actions.cancel`, calls `onOpenChange(false)`).
  - Then the primary **Add** `t("common.productPicker.add", { count: selected.size })`, disabled when `selected.size === 0`, calling `onAdd`.

Header comment: S31 — one dialog, two consumers (`RepairPartPickerDialog`,
`InvoiceProductPickerDialog`). It replaces only the *finding* of products, never the confirming:
**Add** hands rows back to the consumer's own editable list. The selection is a `Map` held by the
consumer, so it survives paging and re-searching within one session. Each consumer resets it when
the dialog closes, which is why Cancel discards it.

### Action 3.3 — Repairs: data layer

1. `src/services/repairs.service.ts`: add `addRepairParts(scope, id, command: AddRepairPartsCommand)`,
   which POSTs to `ADMIN_PARTS_BATCH`/`STAFF_PARTS_BATCH`. Same body shape as `addRepairPart`.
2. `src/hooks/useRepairs.ts`: add `useAddRepairParts()`. Its `onSuccess` invalidates
   `qk.repairs.all()`, `qk.inventory.all()` and `qk.catalog.all()`, the same set S30 gave
   `useAddRepairPart`. **Keep `useAddRepairPart`** (tests import it). Add a one-line comment that
   the drawer uses the batch since S31. **No new query key.**

### Action 3.4 — Rewrite `src/pages/staff/repairs/add-repair-part.schema.ts`

Replace the single-row schema with the staged-list schema:

```ts
// S31 — the drawer's staged parts list (picked via RepairPartPickerDialog, then edited, then
// reserved all at once by AddRepairPartsCommand). productName/availableQuantity are display and
// bound-checking aids captured at pick time; they are stripped before the command is sent. The
// definitive bound is still the server's 409 INSUFFICIENT_STOCK — availability can change between
// pick and submit.
const stagedPartSchema = (t) =>
  z.object({
    productId: z.uuid(),
    productName: z.string(),
    availableQuantity: z.number().int(),
    quantity: z.coerce.number().int().min(1, t("staff.repairs.addPart.quantityMin")),
    unitPrice: z.coerce.number().min(0, t("staff.repairs.addPart.unitPriceInvalid")),
    serialNumbers: z.string().optional(),
  }).refine((row) => row.quantity <= row.availableQuantity, {
    message: t("staff.repairs.addPart.quantityExceedsAvailable"),
    path: ["quantity"],
  });

export function addRepairPartsSchema(t) {
  return z.object({ parts: z.array(stagedPartSchema(t)).min(1) });
}
export type AddRepairPartsFormValues = z.output<ReturnType<typeof addRepairPartsSchema>>;
export type AddRepairPartsFormInput = z.input<ReturnType<typeof addRepairPartsSchema>>;
```

- `z.coerce` is used so the form follows the 3-generic `useForm<Input, unknown, Output>`
  precedent (`repair-status.schema.ts`). This avoids the `valueAsNumber` → `NaN` trap.
- The compile guard becomes:
  `Omit<AddRepairPartsFormValues["parts"][number], "productName" | "availableQuantity"> extends AddRepairPartCommand`.

### Action 3.5 — New `src/pages/staff/repairs/components/RepairPartPickerDialog.tsx` (wrapper)

Props: `{ open; onOpenChange; onAdd: (products: StaffProductDto[]) => void }`.

**State:**
- `search`
- `debouncedSearch = useDebouncedValue(search, 300)` (the same 300 ms `StaffRepairs.tsx:89` uses today)
- `page` (reset to 1 whenever `debouncedSearch` changes, via the setter, not an effect: set the
  page to 1 inside `onSearchChange`)
- `selected: Map<string, StaffProductDto>`

**Data:**
- `useStaffProducts({ search: debouncedSearch.trim() || undefined, page, limit: 10 }, { enabled: open })`.
- `useCatalogClientCategories()` for headers, sorted by `name`.

**Columns:**
- `available`: header `common.productPicker.columns.available`, right-aligned, value `row.availableQuantity`.
- `default`: header `common.productPicker.columns.defaultPrice`, value `formatDZD(row.defaultSalePrice ?? 0, language)`.
- One per category: header = category name (data, not UI text), value = matching
  `row.categoryPrices.find((cp) => cp.categoryId === category.id)?.price`, formatted, or `"—"`
  when absent.

**Behaviour:**
- `isRowDisabled = (row) => row.availableQuantity <= 0`, with
  `disabledRowHint = t("staff.repairs.addPart.outOfStock")`.
- `handleClose(next)`: when closing, reset search, page and selection, then call
  `onOpenChange(next)`.
- `onAdd`: `onAdd([...selected.values()])`, then `handleClose(false)`.
- Title `staff.repairs.partPicker.title`.

### Action 3.6 — New `src/pages/staff/repairs/components/RepairPartsStaging.tsx`

This replaces the old inline form. Dumb: it owns only local form state plus the picker's open
flag.

**Props:**
`{ onSubmit: (command: AddRepairPartsCommand, onSuccess: () => void) => void; isSubmitting?: boolean }`.

**Form:**
- `useForm<AddRepairPartsFormInput, unknown, AddRepairPartsFormValues>({ resolver: zodResolver(addRepairPartsSchema(t)), defaultValues: { parts: [] } })`
- `useFieldArray({ control, name: "parts" })`

**Render** (inside the existing dashed box, `rounded-lg border border-dashed border-border p-2`):
1. An outline **Add products** button (`Plus` icon, `staff.repairs.addPart.addProducts`) that
   opens `RepairPartPickerDialog`.
2. When `fields.length > 0`: a heading `staff.repairs.addPart.pendingTitle`, then one row per
   field:
   - the name;
   - a `text-xs` hint `t("staff.repairs.addPart.availableHint", { qty: availableQuantity })`;
   - a quantity `Input` (`type="number" min={1} max={availableQuantity}`);
   - a unit price `Input` (`step="0.01"`);
   - a serials `Input` (placeholder `staff.repairs.addPart.serialsLabel`);
   - a remove ghost button (`Trash2`).
   Render `errors.parts?.[i]?.quantity|unitPrice` messages under each row.
3. The submit `Button` (`staff.repairs.addPart.submit`, text changed to plural in §3.12),
   `disabled={fields.length === 0 || isSubmitting}`.

**Picker `onAdd(products)`:** append, for each product **not already staged** (P4),
`{ productId, productName: name, availableQuantity, quantity: 1, unitPrice: defaultSalePrice ?? 0 }`.
The `defaultSalePrice` default is P2.

**Submit:**

```ts
const submit = handleSubmit((values) =>
  onSubmit(
    {
      parts: values.parts.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        ...(row.serialNumbers?.trim() ? { serialNumbers: row.serialNumbers.trim() } : {}),
      })),
    },
    () => reset({ parts: [] }),
  ),
);
```

The two display fields are never sent, and an empty serials box is omitted. On failure the staged
list **stays** for correction. The global mutation toast already shows the translated
`INSUFFICIENT_STOCK` message.

Header comment: S31. Picking happens in the shared dialog and confirming happens here. Nothing is
reserved until **Add parts**, and then everything is reserved at once (P1).

### Action 3.7 — `src/pages/staff/repairs/components/RepairTicketDetail.tsx`

- **Remove:**
  - the `useForm`/`addRepairPartSchema` block and `submitAddPart`;
  - the whole inline `<form>` (`AutocompleteInput` … submit);
  - the `AutocompleteInput`, `Input` (only if now unused; it is still used for labour) and `Plus` imports, as each becomes unused.
- **Props:**
  - drop `productSearchResults`, `onProductSearch` and `onAddPart`;
  - add `onAddParts: (command: AddRepairPartsCommand, onSuccess: () => void) => void` and `isAddingParts?: boolean`.
- In place of the removed form, under the same `!readOnly` guard:
  `<RepairPartsStaging onSubmit={onAddParts} isSubmitting={isAddingParts} />`.
- **Header comment:** replace the "F1 — the spare-part picker was a raw text input …" sentence
  with "S31 — parts are picked through the shared product-picker dialog and staged
  (RepairPartsStaging) before being reserved together; the old inline autocomplete is gone."

### Action 3.8 — `src/pages/staff/repairs/StaffRepairs.tsx`

- **Delete:**
  - `partSearchQuery`, `debouncedPartSearch` and the `useStaffProducts` call;
  - their imports (`useStaffProducts`, `useDebouncedValue`), if now unused;
  - `useAddRepairPart`/`addPart` and `handleAddPart`, plus the `AddRepairPartFormValues` import.
- **Add:**
  - `const addParts = useAddRepairParts();`
  - `handleAddParts = (command, onSuccess) => { if (!selectedRepairId) return; addParts.mutate({ scope, id: selectedRepairId, command }, { onSuccess }); }`
- **Pass to `RepairTicketDetail`:** `onAddParts={handleAddParts}` and
  `isAddingParts={addParts.isPending}`. Remove the three dropped props.
- **Add `key={selectedRepair?.id ?? "none"}` to `<RepairTicketDetail>`**, so a staged list never
  carries over from one ticket to another. This is the same per-ticket remount
  `RepairStatusDialog` already uses here; add a one-line comment.

### Action 3.9 — Supplier invoices: new `src/pages/admin/supplier-invoices/components/invoice-product-picker-dialog.tsx` (wrapper)

Props: `{ open; onOpenChange; onAdd: (products: AdminProductDto[]) => void }`.

**State:** `search`, `debouncedSearch = useDebouncedValue(search, 300)`, `page` (reset to 1 in
`onSearchChange`), `selected: Map<string, AdminProductDto>`, `isQuickAddOpen`.

**Data:**
- `useAdminCatalogProducts({ search: debouncedSearch.trim() || undefined, page, limit: 10 }, { enabled: open })`.
  No `sort` param, so the list is newest first (P5).
- `useCreateProduct()`.

**Columns:**
- `onHand`: header `common.productPicker.columns.onHand`, right-aligned, value `row.quantityOnHand`.
- `avgPrice`: header `common.productPicker.columns.avgPrice`, value `formatDZD(row.avgPrice, language)`.
- `avgStockPrice`: header `common.productPicker.columns.avgStockPrice`, value `formatDZD(row.avgStockPrice, language)`.
- **No `isRowDisabled`**: zero stock is selectable.

**`footerStart`:** an outline `Button` with `Plus`, labelled
`admin.supplierInvoices.editor.quickAddProduct` (an existing key: "Add a new product"), that sets
`isQuickAddOpen`.

**Quick-add:**
- Render `<QuickAddProductDialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen} onSave={handleSaveNewProduct} isSaving={createProduct.isPending} />` **inside** the wrapper, as a sibling of `ProductPickerDialog`. Radix stacks nested modal dialogs.
- `handleSaveNewProduct(values)` →
  `createProduct.mutate({ command: values, images: [] }, { onSuccess: (product) => { setSelected((prev) => new Map(prev).set(product.id, product)); setIsQuickAddOpen(false); } })`.
  The new product comes back **selected**, as the set requires. `useCreateProduct` already
  invalidates the admin product lists, so the new product also appears in the table.

**Close and add:** `handleClose` and `onAdd` are as in §3.5. Title
`admin.supplierInvoices.productPicker.title`.

### Action 3.10 — `src/pages/admin/supplier-invoices/components/invoice-line-editor.tsx`

- **Props:**
  - remove `productOptions` and `onQuickAddProduct`;
  - rename `productNameSnapshot` to `productName`;
  - `productStock` stays.
- **Product cell:** always renders
  `<div className="text-sm font-medium">{productName ?? t("admin.supplierInvoices.editor.unknownProduct")}</div>`,
  editable or not. The product is chosen only through the picker. To change it, remove the line
  and add the right product.
- **Remove** the `Controller` for `lines.${index}.productId`. The value is set at append time and
  never edited. Also remove the `AutocompleteInput` and `Plus` imports if unused.
- **Delete `AddLineButton`.** Grep first: it should be used only by the editor page.
- **Header comment:** S31. The product is picked via `InvoiceProductPickerDialog`, so the per-row
  autocomplete (I5's per-row quick-add) is gone. `productName` comes from the picked product, or
  from the invoice's own snapshot on a saved invoice (I10's reason still applies).

### Action 3.11 — `src/pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx`

1. **Delete:**
   - the `useAdminCatalogProducts({ page: 1, limit: 100 })` call, `productOptions` and `productStockById`;
   - `isQuickAddOpen`, `quickAddLineIndex`, `handleQuickAddProduct`, `handleSaveNewProduct`;
   - `useCreateProduct` and the `QuickAddProductDialog` render, with their imports.
   Quick-add now lives in the picker wrapper.
2. **Add state:**
   - `isPickerOpen`;
   - `pickedById: Map<string, { name: string; quantityOnHand: number; avgPrice: number }>`
     (`useState(() => new Map())`), which keeps names and the I6 helper figures for lines added
     in this session.
3. **`defaultValues.lines`:** change `[{ productId: "", quantity: 1, unitCost: 0 }]` to `[]`.
4. **`handlePickProducts(products: AdminProductDto[])`:**
   - add each product to `pickedById`;
   - for each product whose id is **not already** in `watchedLines` (P4),
     `append({ productId: p.id, quantity: 1, unitCost: 0 })` (P3).
5. **Line rendering:**
   - `productName={pickedById.get(line.productId)?.name ?? invoice?.lines.find((l) => l.productId === line.productId)?.productNameSnapshot}`.
     The old code matched by **index**, which breaks once lines can be removed and re-added.
   - `productStock={pickedById.get(line.productId)}`. This keeps I6's on-hand and unweighted
     `avgPrice` hints.
   - Drop the `productOptions` and `onQuickAddProduct` props.
6. **Replace `AddLineButton`:** when `isEditable`, render an outline **Add products** button
   (`Plus` icon, `admin.supplierInvoices.editor.addProducts`) that opens
   `<InvoiceProductPickerDialog open={isPickerOpen} onOpenChange={setIsPickerOpen} onAdd={handlePickProducts} />`.
   Mount the dialog next to the other dialogs at the bottom of the page.
7. **Errors:** under the lines list, render `form.formState.errors.lines?.message` (or
   `.root?.message`, whichever the refine populates; see §3.12) in `text-sm text-destructive`.
8. **Comments:** update the file header to add S31 (server-side picker, quick-add moved into it).
   Replace the stale "I6's two helper texts read …" comment so it points at `pickedById`.

### Action 3.12 — Supplier schema and the line-mode switch (P7)

- **`components/supplier-invoice.schema.ts`:** add a second `.refine` after the XOR one:
  `(d) => d.amountOnly !== undefined || (d.lines?.length ?? 0) > 0` with message
  `t("admin.supplierInvoices.editor.linesRequired")` and `path: ["lines"]`. Add a comment: S31,
  lines are picker-only now, and the backend has no empty-lines guard. The
  `AssertAssignable` check is unaffected.
- **`components/amount-only-switch.tsx:31`:** change
  `setValue("lines", [{ productId: "", quantity: 1, unitCost: 0 }])` to `setValue("lines", [])`.
  Update the comment above it if it mentions the blank line.

### Action 3.13 — `src/config/translations.json` (shape `{ en, fr, ar: "" }`, load/modify/dump round-trip is byte-safe)

**Add:**

| Key | en | fr |
|---|---|---|
| `common.productPicker.searchPlaceholder` | Search by name or barcode | Rechercher par nom ou code-barres |
| `common.productPicker.selectedCount` | {count} selected | {count} sélectionné(s) |
| `common.productPicker.select` | Select {name} | Sélectionner {name} |
| `common.productPicker.add` | Add ({count}) | Ajouter ({count}) |
| `common.productPicker.previous` | Previous | Précédent |
| `common.productPicker.next` | Next | Suivant |
| `common.productPicker.empty` | No products found | Aucun produit trouvé |
| `common.productPicker.error` | Couldn't load products | Impossible de charger les produits |
| `common.productPicker.columns.name` | Product | Produit |
| `common.productPicker.columns.available` | Available | Disponible |
| `common.productPicker.columns.onHand` | In stock | En stock |
| `common.productPicker.columns.defaultPrice` | Default price | Prix par défaut |
| `common.productPicker.columns.avgPrice` | Avg purchase price | Prix d'achat moyen |
| `common.productPicker.columns.avgStockPrice` | Avg stock price | Prix moyen du stock |
| `staff.repairs.partPicker.title` | Add parts | Ajouter des pièces |
| `staff.repairs.addPart.addProducts` | Add products | Ajouter des produits |
| `staff.repairs.addPart.pendingTitle` | Parts to add | Pièces à ajouter |
| `staff.repairs.addPart.availableHint` | {qty} available | {qty} disponible(s) |
| `staff.repairs.addPart.outOfStock` | Out of stock — cannot be fitted | Rupture de stock — impossible à poser |
| `admin.supplierInvoices.editor.addProducts` | Add products | Ajouter des produits |
| `admin.supplierInvoices.productPicker.title` | Add products to the invoice | Ajouter des produits à la facture |
| `admin.supplierInvoices.editor.linesRequired` | Add at least one product | Ajoutez au moins un produit |

**Change:** `staff.repairs.addPart.submit` → en "Add parts", fr "Ajouter les pièces".

**Remove**, but only after `grep -rn` across `src/` shows zero remaining uses (tests excluded
from the decision but **not edited**):
- `staff.repairs.addPart.productLabel`, `.productPlaceholder`, `.noResults`, `.productRequired`, `.title`
- `admin.supplierInvoices.editor.addLine`, `admin.supplierInvoices.editor.product`

Keep any of these that grep still finds.

---

## §4 — Stage-00 documentation

`Docs/Stage-00-Conception/Module-Contracts/repairs.md`, API table: add the row
`REPAIR_ROUTES.*_PARTS_BATCH | POST .../repairs/:id/parts/batch | staff|admin | S31 — reserve every staged part in one transaction (all or nothing); AddRepairPartsCommand { parts: AddRepairPartCommand[1..50] }`.

No schema change, so no other Stage-00 file changes.

---

## §5 — Validation gate

No test file may be read, edited or run. From the repo root:

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npm run lint
```

**Baselines from S30** (compare against these, and list the differences per file):
- `Apps/api`: 198 test-file tsc errors across 29 files, and 7 pre-existing lint errors in
  untouched files (`prisma/seed.ts`, `validate-request.middleware.ts`, `orders.service.ts`).
- `Apps/web`: lint run over the touched/new files must be clean. Repo-wide web lint carries about
  3 192 pre-existing prettier problems.

**Expected new test staleness (report it, do not fix):**
- web tests that render `RepairTicketDetail` with the removed `onAddPart`/`productSearchResults` props;
- tests of `InvoiceLineEditor` (`productOptions`, `AddLineButton`).

**Grep sweeps:**
- `grep -rn "limit: 100" Apps/web/src/pages/admin/supplier-invoices` → none.
- `grep -rn "AutocompleteInput" Apps/web/src/pages/staff/repairs/components/RepairTicketDetail.tsx Apps/web/src/pages/admin/supplier-invoices/components/invoice-line-editor.tsx` → none.
- `grep -rn "AddLineButton\|quickAddLineIndex\|productSearchResults\|onProductSearch" Apps/web/src` → none outside tests.

---

## §6 — Manual verification checklist (browser)

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

## §7 — Files touched

**New (5):**
- `Apps/web/src/types/product-picker.types.ts`
- `Apps/web/src/components/shared/product-picker-dialog.tsx`
- `Apps/web/src/pages/staff/repairs/components/RepairPartPickerDialog.tsx`
- `Apps/web/src/pages/staff/repairs/components/RepairPartsStaging.tsx`
- `Apps/web/src/pages/admin/supplier-invoices/components/invoice-product-picker-dialog.tsx`

**Modified:**
- **contract:** `repairs.command.ts`, `repairs.routes.ts`
- **api:** `repairs.{interface,service,controller,routes}.ts`
- **web:**
  - `services/repairs.service.ts`, `hooks/useRepairs.ts`
  - `pages/staff/repairs/{add-repair-part.schema.ts, StaffRepairs.tsx}`
  - `pages/staff/repairs/components/RepairTicketDetail.tsx`
  - `pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx`
  - `pages/admin/supplier-invoices/components/{invoice-line-editor.tsx, supplier-invoice.schema.ts, amount-only-switch.tsx}`
  - `config/translations.json`
- **docs:** `Docs/Stage-00-Conception/Module-Contracts/repairs.md`

**Deliberately not touched:**
- Prisma schema (no migration).
- Catalog endpoints and services (both list endpoints are reused as they are).
- `QuickAddProductDialog` itself (only its owner moves).
- Purchasing backend.
- POS.
- Every test file.

---

## §8 — Execution protocol

Execute this set alone. When it is finished, write `Docs/Stage-04-Fixes/results/report-S31.md`
covering:

1. the §0.2 finding that the supplier-invoice picker was a first-100 slice;
2. decisions P1–P7;
3. every change, by file;
4. the gate results, with test staleness listed per file.

End the report with the §6 checklist verbatim. The owner reviews and approves the report before
S32 begins.
