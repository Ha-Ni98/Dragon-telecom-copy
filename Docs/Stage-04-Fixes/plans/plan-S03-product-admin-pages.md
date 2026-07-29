# Plan S3 — Product Admin Pages

*Backend (search + a new image-delete endpoint) + contract + frontend. Consumes S1 and S2.*

---

## 0. Before you start

### 0.1 Sets that must land first

**S1** and **S2** — both are executed and reported (`Docs/Stage-04-Fixes/results/report-S01.md`,
`report-S02.md`). This plan depends on them concretely:

- **From S1:** `AdminProductDto.avgStockPrice` and `AdminProductDto.avgPrice` (the two figures
  Product Info must surface), and the recorded search instruction reproduced in **F6** below.
- **From S2:** the shared `<MarginDisplay>` component (`@/components/shared/MarginDisplay`) and the
  rebuilt `AutocompleteInput` contract. Add Product and Product Info are already wired to both —
  this set does **not** re-do that work, it closes the two gaps S2 left behind (**F3**, **F7**).

### 0.2 Owner decisions taken for this plan

Asked and answered this session. Plan to them; do not re-open.

| # | Question | Owner's answer |
|---|---|---|
| **R1** | Add Product's *"leave barcode editing disabled for now"* — disable the input, the whole row, or hide it? | **The brief's instruction is a mistake — retracted.** Leave barcode editing exactly as it is: the user can auto-generate the barcode **and** type/edit it freely. **No change to the barcode field's behavior.** Only the field *ordering* instruction still applies (barcode moves below name/description). |
| **R2** | Product Info shows category-price inputs only for categories that already have a `ProductPrice` row, so a product with none can never gain one. Fix here or defer? | **Fix here.** When a product has no category prices, show an input for **every** client category with an **empty** value. |
| **R3** | Should the new admin prices tab show `guestPrice`, which the staff view deliberately hides? | **Staff columns + guest price.** |

### 0.3 Findings from reading the code — read before acting

**F1 — the "guest price is null ⇒ nothing saves" bug, root cause identified.**
It is not about `null` at all: it is the `valueAsNumber` → `NaN` trap. `register(field, {
valueAsNumber: true })` on an **empty** numeric input yields `NaN`, not `undefined`/`null`, and
`z.number()` rejects `NaN` — so `handleSubmit`'s valid-callback never fires and the request is
never sent. Affected registrations:

| File | Line | Field |
|---|---|---|
| `components/enhanced-pricing-section.tsx` | 53 | `guestPrice` |
| `components/enhanced-pricing-section.tsx` | 78 | `defaultSalePrice` |
| `components/enhanced-pricing-section.tsx` | 107 | `categoryPrices.${index}.price` |
| `components/product-details-section.tsx` | 83 | `reorderThreshold` |

The last one is **not in the brief** but is the identical bug on the *other* form: clearing the
reorder threshold silently breaks the **details** save too. Action 10 fixes all four.

**This project already solved this exact trap once** — `AdminProductsAdd.tsx` lines 43–50 carry a
9-line comment explaining it and the `optionalNumber` helper (`raw === "" ? undefined :
Number(raw)`) that fixes it. Reuse that pattern; do not invent a new one.

**F2 — `save()` exits edit mode even when validation fails.** `use-edit-mode.ts` line 73 calls
`setIsEditMode(false)` synchronously, *outside* both `handleSubmit` callbacks. So an invalid form
leaves edit mode, saves nothing, and shows no error — which is what makes F1 look like "nothing
happens" rather than "validation failed". There is also no success toast on either form. Action 10
fixes the flow; F1 and F2 must be fixed **together** or the bug only half-disappears.

**F3 — Add Product's category-price margins are still stale (RC-2 residue).** S2 wired
`<MarginDisplay>` at all three Add-Product price sites, but the category one reads
`categoryPriceValue()` → `getValues("categoryPrices")`, which is **not** reactive, while guest and
default use `watch()`. Typing a category price does not move its margin. Action 6 fixes it.

**F4 — Add Product's post-save "reset" is a no-op.** `confirmSubmit`'s
`navigate("/admin/products/add")` fires while already on `/admin/products/add`; React Router does
not remount the element for a same-path navigation, so every field, every staged image and the
`nameManuallyEdited` flag survive. That is exactly the reported "returns still populated with the
saved product". Action 6 replaces it with a real reset. There is also **no success toast** today.

**F5 — there is no image-delete endpoint anywhere.** `product-images-section.tsx` lines 20–22
document this as a known gap ("no DELETE /admin/products/:id/images endpoint … Out of this
sprint's authorized scope"). S3 authorizes it. Images live on disk under `<cwd>/uploads`, served
by `app.ts` lines 30–33 at `${API_PREFIX}/uploads`, and `ProductImage.url` stores
`/uploads/<filename>` (`catalog.service.ts:669`). "Front and back … deleting the stored file
itself" therefore needs: contract route + params schema, backend route → controller → service,
`fs.unlink` of the real file, and the frontend service/hook/UI. Actions 1, 3, 4, 12.

**F6 — barcode search: use `startsWith`, not `contains` (S1's recorded instruction, verbatim).**
> `Product.barcode @unique` is already a unique btree index. **S3/S4 must write barcode search as**
> `{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { startsWith: q } }] }`.
> A `barcode: { contains: … }` predicate would **not** use this index.

The single helper `staffAdminWhere()` (`catalog.service.ts:855`) serves **both**
`listAdminProducts` and `listStaffProducts`, so one edit gives admin *and* staff barcode search —
S4's "Movement ledger / stock levels: search by barcode or product name" is a different module and
is **not** covered by this change.

**F7 — RC-3 on the products list is already fixed; the real remaining issue is wrapping.** The
"low in stock" indicator is `StatusPill tone="warning"`, and S2 fixed that tone's light-mode
contrast at the CSS-variable level (`--warning-foreground`). Nothing is left to do for contrast —
**verify only**. What *is* still broken is the brief's other half: the stock-status column is
narrow and its longest label wraps ("Out of stock" / French "Rupture de stock"). Action 7 fixes the
wrap and removes the image column, which returns width to every other column.

**F8 — reusable legacy translation keys already exist** for image removal, left over from the
Sub-01 stub era and currently unreferenced: `admin.productInfo.removeImage` ("Remove Image"),
`admin.productInfo.imageRemoveSuccess` ("Image removed successfully"),
`admin.productInfo.imageRemoveError` ("Failed to remove image"). Reuse them rather than minting
new ones — but **fix their casing** to match this codebase's sentence-case convention (Action 5).

**F9 — S1 handoff, now due:** `admin.productInfo.stock.avgCost` ("Avg. cost") is ambiguous between
the two figures and **S3 must split it**. Action 5 + Action 13.

### 0.4 Standing rules for this set

- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit` and
  lint only.
- **All user-facing text goes through `t()`.** The file is `Apps/web/src/config/translations.json`
  — **plural**, flat dotted keys → `{ en, fr, ar }`, with **`ar` always `""`**.
- **Read the comment above every line you change** and update any your change falsifies. Several
  are named explicitly below (`product-images-section.tsx`'s "known gap" note is the big one).
- Toasts use `sonner` (`import { toast } from "sonner"`), the established pattern across
  `AdminInventory.tsx`, `AdminSettings.tsx`, `AdminSupplierInvoiceEditor.tsx`.
- Layering: components never call `services/` directly — always through a hook in `src/hooks/`.

---

## 1. Actions, in dependency order

Execute **1 → 14**. Actions 1–3 are contract + backend; 4–5 are frontend plumbing every later
action depends on; 6–13 are the three pages; 14 is the sweep.

---

### Action 1 — Contract: the image-delete route and its params

**File:** `Apps/contract/src/modules/catalog/catalog.routes.ts`

Add one member to `CATALOG_ROUTES`, directly after the existing `IMAGES` line:

```ts
  IMAGE_BY_ID: '/admin/products/:id/images/:imageId',
```

**File:** `Apps/contract/src/modules/catalog/catalog.query.ts`

Add, beside the existing `ProductIdParamsSchema` (line 30):

```ts
// Two-param route (product + image) — mirrors repairs' RepairPartParamsSchema precedent.
export const ProductImageParamsSchema = z.object({ id: z.uuid(), imageId: z.uuid() });
export type ProductImageParams = z.infer<typeof ProductImageParamsSchema>;
```

`catalog/index.ts` already re-exports with `export *`, so no barrel edit is needed — confirm
rather than edit.

---

### Action 2 — Backend: barcode search (F6)

**File:** `Apps/api/src/modules/catalog/catalog.service.ts`, `staffAdminWhere()` (line ~855)

Replace the `query.search` clause so it matches product **name** or **barcode**:

```ts
  private staffAdminWhere(query: ProductListQuery, extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput {
    return {
      ...extra,
      // Name is a case-insensitive substring match; barcode is a prefix match so it can use the
      // `Product.barcode @unique` btree index (S1 finding F1 — a `contains` predicate could not).
      // A scanner emits a whole barcode, so `startsWith` also covers the exact-scan case.
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { barcode: { startsWith: query.search } },
            ],
          }
        : {}),
      ...(query.familyId != null ? { familyId: query.familyId } : {}),
      ...(query.brandId != null ? { brandId: query.brandId } : {}),
      ...(query.modelId != null ? { deviceModelId: query.modelId } : {}),
    };
  }
```

**Do not** touch `listProducts`'s own `where` (line ~390) — that is the **public storefront**, where
barcode search is not requested and would leak an internal identifier into a public query surface.
Note that deliberate asymmetry in the report.

---

### Action 3 — Backend: delete a product image, file included (F5)

**File:** `Apps/api/src/modules/catalog/catalog.interface.ts`

Add to `ICatalogProductService`, beside `addImages`/`updateImages` (lines 47–48):

```ts
  deleteImage(id: string, imageId: string): Promise<AdminProductDto>;
```

**File:** `Apps/api/src/modules/catalog/catalog.service.ts`

Add `import { unlink } from 'node:fs/promises';`, `import { basename, join } from 'node:path';`
(match the file's existing import style), then add this method immediately after `updateImages`
(which ends line ~697):

```ts
  // Deletes the row *and* the file on disk (S3). The DB row is the source of truth: if the file
  // is already gone (manual cleanup, a failed earlier delete) the unlink error is swallowed and
  // the row still goes — an orphaned row would keep rendering a broken <img>, which is worse than
  // an orphaned file. `basename()` is a path-traversal guard: `url` is written by this service as
  // `/uploads/<generated-uuid><ext>`, but it is still a stored string, so the filesystem path is
  // rebuilt from its last segment only and never from the stored value directly.
  async deleteImage(id: string, imageId: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product');

    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== id) throw new NotFoundError('ProductImage');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    // Deleting the primary leaves the product with no primary at all, so the storefront card and
    // every `images[0]`-style consumer would render nothing. Promote the lowest-position survivor.
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId: id },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
      if (next) {
        await this.prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    try {
      await unlink(join(process.cwd(), UPLOAD_DIR_NAME, basename(image.url)));
    } catch {
      // File already absent — the row is gone, which is what the caller asked for.
    }

    return this.getAdminProduct(id);
  }
```

`UPLOAD_DIR_NAME` does not exist yet: the upload directory is the string literal `'uploads'`
declared in **`catalog.routes.ts` line 61** (`const UPLOAD_DIR = 'uploads'`) and repeated as
`"uploads"` in **`app.ts` line 32**. That is three copies of one path across two modules — the
kind of magic string hard-rule 1 forbids. **Export it once and import it in all three places:**

- In `Apps/contract/src/modules/catalog/catalog.routes.ts`, beside `CATALOG_ROUTES`, add:
  ```ts
  // The on-disk directory product images are written to and served from. Shared because three
  // places must agree on it: multer's destination, express.static's mount, and the delete path.
  export const PRODUCT_UPLOAD_DIR = 'uploads';
  ```
- `catalog.routes.ts` (api): `const UPLOAD_DIR = PRODUCT_UPLOAD_DIR;` (keep the local name so the
  rest of that file is untouched) — import it from `@dragon-telecom/contract`.
- `app.ts` line 32: `express.static(path.join(process.cwd(), PRODUCT_UPLOAD_DIR))`.
- `catalog.service.ts`: import it and use it in `deleteImage` (replace `UPLOAD_DIR_NAME` above with
  `PRODUCT_UPLOAD_DIR`).

**File:** `Apps/api/src/modules/catalog/catalog.controller.ts`

Add after `updateImages` (line ~162), following that method's exact shape:

```ts
  deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, imageId } = req.validated.params as ProductImageParams;
      sendSuccess(res, await this.products.deleteImage(id, imageId));
    } catch (err) {
      next(err);
    }
  };
```

Import `ProductImageParams` from `@dragon-telecom/contract`. Match how the neighbouring handlers
read `id` (they destructure `req.validated.params`) — mirror it exactly rather than inventing a
different access pattern.

**File:** `Apps/api/src/modules/catalog/catalog.routes.ts`

Register directly after the `PATCH CATALOG_ROUTES.IMAGES` route (line ~156-161):

```ts
router.delete(
  CATALOG_ROUTES.IMAGE_BY_ID,
  adminOnly,
  validateRequest({ params: ProductImageParamsSchema }),
  controller.deleteImage,
);
```

Add `CATALOG_ROUTES.IMAGE_BY_ID` usage and the `ProductImageParamsSchema` import to that file's
existing contract import block.

---

### Action 4 — Frontend plumbing: image-delete service + hook

**File:** `Apps/web/src/services/catalog.service.ts`

Add after `updateImages` (which ends ~line 206), following the file's established shape
(`withParams(apiPath(...), {...})`, defensive `success` check):

```ts
export async function deleteImage(id: string, imageId: string): Promise<AdminProductDto> {
  const res = await api.delete<ApiResponse<AdminProductDto>>(
    withParams(apiPath(CATALOG_ROUTES.IMAGE_BY_ID), { id, imageId }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

**File:** `Apps/web/src/hooks/useCatalogProducts.ts`

Add after `useUpdateProductImages`:

```ts
export function useDeleteProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageId }: { id: string; imageId: string }) =>
      catalogService.deleteImage(id, imageId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.detail(id) });
      // The public/product lists render the primary image, and deleting one can promote a new
      // primary — so both list caches are stale, not just this product's detail.
      queryClient.invalidateQueries({ queryKey: qk.catalog.adminProducts.all() });
      queryClient.invalidateQueries({ queryKey: qk.catalog.products.all() });
    },
  });
}
```

Query keys are the existing ones in `Apps/web/src/lib/query-keys.ts` — invent none.

---

### Action 5 — Translation keys

**File:** `Apps/web/src/config/translations.json` (flat dotted keys → `{ en, fr, ar }`, `ar: ""`).

**Add:**

| Key | en | fr |
|---|---|---|
| `admin.productsAdd.createSuccess` | `Product created` | `Produit créé` |
| `admin.productsList.tabs.stock` | `Stock` | `Stock` |
| `admin.productsList.tabs.prices` | `Prices` | `Prix` |
| `admin.productsList.table.guestPrice` | `Guest price` | `Prix invité` |
| `admin.productsList.table.defaultPrice` | `Default price` | `Prix par défaut` |
| `admin.productInfo.stock.avgStockPrice` | `Avg. stock price` | `Prix de stock moyen` |
| `admin.productInfo.stock.avgPrice` | `Avg. purchase price` | `Prix d'achat moyen` |
| `admin.productInfo.saveSuccess` | `Product saved` | `Produit enregistré` |
| `admin.productInfo.saveError` | `Couldn't save the product — check the highlighted fields` | `Échec de l'enregistrement — vérifiez les champs signalés` |
| `admin.productInfo.images.confirmRemove` | `Remove this image?` | `Supprimer cette image ?` |

**Change the value of** (key stays, wording corrected — F8/F9):

| Key | New en | New fr | Why |
|---|---|---|---|
| `admin.productsList.filters.search` | `Search by name or barcode` | `Rechercher par nom ou code-barres` | Action 2 makes barcode searchable; the placeholder must say so. |
| `admin.productsList.table.avgCost` | `Avg. stock price` | `Prix de stock moyen` | Column renders `avgStockPrice`; "Avg. cost" is now ambiguous (S1 handoff). |
| `admin.productInfo.removeImage` | `Remove image` | `Supprimer l'image` | Sentence case, matching every other key in this file. |
| `admin.productInfo.imageRemoveSuccess` | `Image removed` | `Image supprimée` | Same. |
| `admin.productInfo.imageRemoveError` | `Couldn't remove the image` | `Échec de la suppression de l'image` | Same. |

**Delete** `admin.productInfo.stock.avgCost` — Action 13 replaces its only consumer with the two
new keys. Verify with `grep -rn "admin.productInfo.stock.avgCost" Apps/web/src` **after** Action 13
and before deleting; if anything still references it, keep it and say so in the report.

Do **not** delete the other unreferenced `admin.productInfo.*` legacy keys (`supplier*`,
`pricing.bulk*`, etc.) — they are outside this set's scope and a separate cleanup.

---

### Action 6 — Add Product: field order, reactive category margins, save toast, real reset

**File:** `Apps/web/src/pages/admin/products/AdminProductsAdd.tsx`

**6a — field order (the brief's ordering, R1's retraction applied).** Inside the "Basic info"
card, reorder the existing blocks to: **family → brand → model** (the `grid-cols-3` block, lines
206–297) → **name** (lines 197–204) → **description** (lines 299–302) → **barcode** (lines
186–195). Move the JSX blocks; change nothing inside them.

**The barcode field keeps its current behavior exactly (R1): the input stays editable and
"Auto-generate" keeps working.** The brief's "leave barcode editing disabled for now" was
retracted by the owner as a mistake — do not disable, hide, or make it read-only.

**6b — reactive category margins (F3).** Replace the non-reactive `getValues` read with a watched
one. Add beside the other `watch` destructure (line ~96):

```ts
  const categoryPrices = watch("categoryPrices");
```

and change `categoryPriceValue` (line ~144) to read from it:

```ts
  const categoryPriceValue = (categoryId: string) =>
    categoryPrices?.find((c) => c.categoryId === categoryId)?.price;
```

`setCategoryPrice` already writes through `setValue`, which notifies watchers — so the
`<MarginDisplay>` at line ~389 becomes reactive with no further change. Leave the `<Input>`'s
`defaultValue={categoryPriceValue(...)}` as-is (it stays uncontrolled; only the margin needed to
become live).

**6c — success toast and a genuinely clean reset (F4).** Add `import { toast } from "sonner";` and
pull `reset` out of `useForm`. Replace `confirmSubmit`'s `onSuccess` body:

```ts
        onSuccess: () => {
          setShowConfirm(false);
          toast.success(t("admin.productsAdd.createSuccess"));
          // A same-path navigate() does not remount this route element, so the old code left every
          // field, every staged image and the manual-name flag in place. Reset the form state
          // explicitly instead — and revoke the object URLs, or the staged previews leak.
          images.forEach((img) => URL.revokeObjectURL(img.preview));
          setImages([]);
          setNameManuallyEdited(false);
          setSelectedBrandId(undefined);
          reset({ name: "", initialQuantity: 0 });
        },
```

`reset(...)` is given the same object `useForm`'s `defaultValues` uses (line 93), so "cleanly
reset" means identical to a first visit. Remove the now-unused `navigate` call from
`confirmSubmit` — **keep** the `navigate` import, it is still used by the back button (line 174).

Delete or correct the doc comment's stale claim if the reorder makes it wrong; the block at lines
52–60 describes the submit flow and should mention the reset.

---

### Action 7 — Products list table: drop the image column, stop the status badge wrapping

**File:** `Apps/web/src/pages/admin/products/components/admin-products-table.tsx`

- **Delete the whole `id: "image"` column** (lines 64–72) — it renders a static `<Package/>`
  placeholder for every row and carries no data at all. Drop the now-unused `Package` import
  **only if** nothing else uses it — it is also used by the `EmptyState` icon at line ~196, so
  **keep the import** and verify.
- Update `TableSkeleton`'s `columns={11}` (line 170) to `columns={10}` to match the new count.
- Update the component's leading comment (lines 42–44) to record that the image column was removed
  in S3.

**File:** `Apps/web/src/components/shared/StatusBadge.tsx`

Add `whitespace-nowrap` to `StatusPill`'s class string (line ~26):

```tsx
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${pulse ? "animate-pulse-soft" : ""}`}
```

This is the "resize the stock-status column so its text fits" fix, done at the root: a status pill
should never wrap in *any* table, and the longest label ("Out of stock" / French "Rupture de
stock") is what breaks the column today. Combined with the image column's removal, the column gets
both the width it needed and a guarantee it will not wrap. Note in the report that this touches a
shared S2 component intentionally.

---

### Action 8 — New component: the admin prices table (R3)

**New file:** `Apps/web/src/pages/admin/products/components/admin-product-prices-table.tsx`

Model it directly on `Apps/web/src/pages/staff/products/components/StaffProductsTable.tsx` — same
`DataTable` usage, same data-driven category columns — but typed to **`AdminProductDto`** (not
`StaffProductDto`), and with a **guest-price column** (R3).

```tsx
interface AdminProductPricesTableProps {
  products?: AdminProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onClearFilters?: () => void;
}
```

Columns, in order:

| Column | Source | Header key |
|---|---|---|
| Product | `name` | `admin.productsList.table.product` |
| Barcode | `barcode ?? "—"` | `admin.productsList.table.barcode` |
| Taxonomy | `family.name / brand.name / model?.name` | `admin.productsList.table.taxonomy` |
| Available | `availableQuantity` | `admin.productsList.table.available` |
| Guest price | `guestPrice` | `admin.productsList.table.guestPrice` |
| Default price | `defaultSalePrice` | `admin.productsList.table.defaultPrice` |
| *one per category* | `categoryPrices.find(c => c.categoryId === …)?.price` | the category's own `categoryName` (data, not a key) |

- Derive the category column set exactly as `StaffProductsTable` does (`useMemo` over a
  `Map<categoryId, categoryName>` built from every row) — **not** a hardcoded three.
- Money renders through `formatDZD(value, language)`; a missing price renders `"—"`.
- Reuse `EmptyState` / `NotFoundState` / `TableSkeleton` and the same
  `admin.productsList.table.empty` / `.error` keys the stock table already uses, so both tabs fail
  and empty identically.
- Provide a `renderMobileRow` (required by `DataTable`) showing name, taxonomy and the default
  price — mirror `StaffProductsTable`'s.

---

### Action 9 — Products list page: two tabs, shared filters

**File:** `Apps/web/src/pages/admin/products/AdminProducts.tsx`

Wrap the two tables in `Tabs`, following `AdminInventory.tsx`'s established pattern
(`import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"`).

- **Filters, stats and pagination stay outside the tabs** — both tabs are two renderings of the
  *same* `products` array from the *same* query, so search/family/brand/model/stock-status
  filtering and paging apply to both. Do not duplicate the query or the filter state.
- `<Tabs defaultValue="stock">` with `TabsList` holding two triggers:
  `admin.productsList.tabs.stock` and `admin.productsList.tabs.prices`.
- `TabsContent value="stock"` → the existing `<AdminProductsTable …>` with its current props,
  unchanged.
- `TabsContent value="prices"` → `<AdminProductPricesTable products={products}
  isLoading={productsLoading} isError={productsError} onRetry={handleRetry}
  onClearFilters={handleClearFilters} />`.
- Keep pagination below the `Tabs` block, still driven by `productsResult.meta`.

The tab choice is deliberately **local component state (`Tabs`'s own)**, not a URL param — the
page's URL-as-state block is for server-affecting filters, and the tab affects neither the query
nor the query key.

---

### Action 10 — Product Info: fix the save bug at its root (F1 + F2)

Both halves are required; fixing either alone leaves the page broken.

**10a — kill the `NaN` trap.**

**File:** `Apps/web/src/pages/admin/products/components/enhanced-pricing-section.tsx`

Add the same helper `AdminProductsAdd.tsx` already uses, with a comment pointing at the shared
cause:

```ts
// `valueAsNumber: true` maps an *empty* input to NaN, not undefined — and `z.number()` rejects
// NaN, so the whole form failed validation and `handleSubmit` never fired: clearing the guest
// price silently saved nothing (S3 finding F1). Same trap, same fix as AdminProductsAdd.tsx.
// guestPrice maps blank to `null` (the contract's explicit "clear it" value — applyPricing
// distinguishes null from undefined); the others map blank to `undefined` = "leave untouched".
const clearableNumber = (raw: string) => (raw === "" ? null : Number(raw));
const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));
```

Then change the three registrations:

- line 53: `{...register("guestPrice", { setValueAs: clearableNumber })}`
- line 78: `{...register("defaultSalePrice", { setValueAs: optionalNumber })}`
- line 107: `` {...register(`categoryPrices.${index}.price`, { setValueAs: optionalNumber })} ``

**File:** `Apps/web/src/pages/admin/products/components/product-details-section.tsx`

Line 83 has the identical bug on the **details** form. Add the same `optionalNumber` helper to this
file and use it:

```tsx
              {...register("reorderThreshold", { setValueAs: optionalNumber })}
```

**File:** `Apps/web/src/pages/admin/products/product-pricing.schema.ts`

An emptied category price now arrives as `undefined`, which the required `price: z.number()` inside
the array still rejects. Drop such rows before validation:

```ts
    categoryPrices: z
      .preprocess(
        // A category price the admin cleared arrives as `undefined` (see the section's
        // optionalNumber) — drop the row rather than fail the form. Omitting it from the command
        // means "leave the stored price untouched", matching applyPricing's upsert-what-you-send
        // behavior. Clearing a category price back to "no price" is therefore not expressible
        // through this form; the backend has no delete path for a ProductPrice row either.
        (value) =>
          Array.isArray(value)
            ? value.filter((row) => Number.isFinite((row as { price?: unknown })?.price))
            : value,
        z.array(CategoryPriceInputSchema),
      )
      .optional(),
```

Keep the `_UpdatePricingCommandCheck` compile guard at the bottom of the file — it must still
pass; if it does not, the preprocess output drifted and the fix is wrong.

**10b — make `save()` honest (F2).**

**File:** `Apps/web/src/pages/admin/products/use-edit-mode.ts`

Replace `save` (lines 65–74) so edit mode is left **only** when both forms actually validated, and
the outcome is announced:

```ts
  // Both handleSubmit calls resolve after validation regardless of outcome, so success is tracked
  // by a flag set inside each valid-callback. Previously setIsEditMode(false) ran unconditionally
  // and synchronously: an invalid form silently dropped out of edit mode having saved nothing and
  // shown nothing (S3 finding F2) — which is what made the guest-price bug look like a no-op.
  const save = async () => {
    if (!product) return;
    let detailsOk = false;
    let pricingOk = false;

    await Promise.all([
      detailsForm.handleSubmit((values) => {
        detailsOk = true;
        updateProduct.mutate({ id: product.id, command: values });
      })(),
      pricingForm.handleSubmit((values) => {
        pricingOk = true;
        updatePricing.mutate({ id: product.id, command: values });
      })(),
    ]);

    if (detailsOk && pricingOk) {
      toast.success(t("admin.productInfo.saveSuccess"));
      setIsEditMode(false);
    } else {
      toast.error(t("admin.productInfo.saveError"));
    }
  };
```

Add `import { toast } from "sonner";`. `t` is already in scope (line 21).

The returned `save` is now `async`. Its only caller is `AdminProductInformation.tsx`'s
`onSave={editMode.save}` → `ProductInformationHeader`'s button `onClick`. That prop is typed
`onSave: () => void` (`product-information-header.tsx` line 12) — verified during planning. **This
compiles as-is**: TypeScript allows a `() => Promise<void>` to be assigned to a `() => void` prop,
so no change is strictly required. Still, widen it to `onSave: () => void | Promise<void>` so the
signature tells the truth about what the handler now returns, and note it in the report.

---

### Action 11 — Product Info: a price input for every category (R2)

**File:** `Apps/web/src/pages/admin/products/use-edit-mode.ts`

`resetFromProduct` seeds `categoryPrices` 1:1 from `product.categoryPrices`, which the backend
fills only from existing `ProductPrice` rows — so a product with none gets no inputs and can never
gain one. Seed from the **full** category list instead, pre-filling any price that exists.

- Add `import { useCatalogClientCategories } from "@/hooks/useClientCategories";` and call it at
  the top of the hook: `const { data: categories } = useCatalogClientCategories();`
- Rewrite the `pricingForm.reset` call:

```ts
    pricingForm.reset({
      guestPrice: product.guestPrice,
      defaultSalePrice: product.defaultSalePrice,
      // One row per client category, not per existing ProductPrice row (S3 R2) — a product with
      // no category prices yet must still offer an (empty) input for each, or the card offers no
      // way to ever set one. `price: undefined` renders blank and is dropped by the schema's
      // preprocess unless the admin types something.
      categoryPrices: (categories ?? []).map((category) => ({
        categoryId: category.id,
        price: product.categoryPrices.find((c) => c.categoryId === category.id)?.price,
      })),
    });
```

- The effect that calls `resetFromProduct` (line 53) is keyed on `[product]` only; add `categories`
  to its dependency list so the rows appear once the category list resolves:
  ```ts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetFromProduct, [product, categories]);
  ```

`ProductPricingFormValues["categoryPrices"]` must tolerate a blank `price`. Given Action 10's
`preprocess` already filters non-finite prices before `z.array(CategoryPriceInputSchema)` runs, the
*input* type is the loose one and the *output* stays `{categoryId, price: number}[]`. If `tsc`
objects to `price: undefined` in the `reset()` literal, type the reset payload as
`z.input<...>` rather than weakening `CategoryPriceInputSchema` — the command sent to the backend
must keep `price: number` required.

**File:** `Apps/web/src/pages/admin/products/components/enhanced-pricing-section.tsx`

The label currently resolves through `product.categoryPrices.find(...)` (line 98), which is now
`undefined` for a category that has no stored price — the input would render with an empty label.
Resolve the **name** from the category list instead, and keep the stored price only for view mode:

- Pass the categories in as a prop (`categories?: ClientCategoryDto[]`) from
  `AdminProductInformation.tsx`, which should call `useCatalogClientCategories()` once and hand it
  to this section — **or**, simpler and preferred, call `useCatalogClientCategories()` directly in
  this component, since it is already impure (it calls `useTranslation`/`useFieldArray`).
- Label: `categories?.find((c) => c.id === field.categoryId)?.name ?? ""`.
- View-mode value (line 110): keep reading `product.categoryPrices`, rendering `"—"` when absent.

Update the component's leading comment (lines 21–27), which states rows come 1:1 from
`AdminProductDto.categoryPrices` — that is now false.

---

### Action 12 — Product Info: image removal (F5, front end)

**File:** `Apps/web/src/pages/admin/products/components/product-images-section.tsx`

- Import `useDeleteProductImage` (Action 4), `toast` from `sonner`, and `Trash2` from
  `lucide-react`.
- Add a delete button to each image tile, positioned like `AdminProductsAdd.tsx`'s staged-image
  remove button (`absolute bottom-1 right-1 h-6 w-6`, `variant="destructive"`, `size="icon"`,
  `type="button"`), with `aria-label={t("admin.productInfo.removeImage")}`.
- Guard with a confirm before firing — reuse the app's `AlertDialog` if the file already imports
  one, otherwise a plain `window.confirm(t("admin.productInfo.images.confirmRemove"))` is
  acceptable here and matches the weight of the action; state which you chose in the report.
- On click:
  ```ts
  deleteImage.mutate(
    { id: product.id, imageId: image.id },
    {
      onSuccess: () => toast.success(t("admin.productInfo.imageRemoveSuccess")),
      onError: () => toast.error(t("admin.productInfo.imageRemoveError")),
    },
  );
  ```
- Disable the button while `deleteImage.isPending`.
- **Delete the "Known gap" paragraph** in the component's leading comment (lines 20–22) — it says
  this card "cannot remove one already uploaded" and that adding the endpoint is "out of this
  sprint's authorized scope". Both are now false; replace with a line recording that S3 added
  `DELETE CATALOG_ROUTES.IMAGE_BY_ID` and that the backend also unlinks the file and promotes a new
  primary.

---

### Action 13 — Product Info: surface both average costs (F9)

**File:** `Apps/web/src/pages/admin/products/AdminProductInformation.tsx`

In the stock-stats grid (lines 99–120):

- Replace the single `admin.productInfo.stock.avgCost` stat with **two**:
  ```tsx
        <StockStat
          label={t("admin.productInfo.stock.avgStockPrice")}
          value={product.avgStockPrice}
          money
        />
        <StockStat
          label={t("admin.productInfo.stock.avgPrice")}
          value={product.avgPrice}
          money
        />
  ```
- Keep the stock-value stat reading `quantityOnHand * avgStockPrice` (D10: stock valuation uses
  `avgStockPrice`, never `avgPrice`) — **verify, do not change**.
- The grid is `sm:grid-cols-3 lg:grid-cols-6` for 6 stats; it now holds 7. Change to
  `sm:grid-cols-3 lg:grid-cols-7` so the row stays even at desktop width.

Add a short comment beside the pair recording which figure is which (D10), so a later reader does
not "simplify" them back into one:

```tsx
      {/* Two distinct figures (D10): avgStockPrice is the quantity-weighted moving average that
          drives margins, adjustment defaults and stock valuation; avgPrice is the unweighted mean
          of purchase unit costs, shown here and in the supplier-invoice context only. */}
```

---

### Action 14 — Sweep

- `grep -rn "admin.productInfo.stock.avgCost" Apps/web/src` → must be empty before Action 5's
  deletion of that key stands.
- `grep -rn "valueAsNumber" Apps/web/src/pages/admin/products` → should return **nothing**; every
  numeric registration on these three pages now goes through `setValueAs`. If a hit remains
  outside the four sites named in F1, report it rather than silently changing it.
- `grep -rn "UPLOAD_DIR\|\"uploads\"\|'uploads'" Apps/api/src` → only the `PRODUCT_UPLOAD_DIR`
  import sites from Action 3 should remain.
- **Test files that will now be stale** (do not edit, do not run): list every file under
  `Apps/web/tests` matching
  `grep -rln "AdminProductsTable\|admin-products-table\|enhanced-pricing-section\|product-images-section\|use-edit-mode\|avgCost" Apps/web/tests`,
  with a one-line note per file on what changed underneath it.

---

## 2. Validation gate

From the repo root, in this order. **Do not run any test suite.**

```bash
cd Apps/contract && npx tsc --noEmit && npm run lint
cd ../api      && npx tsc --noEmit && npm run lint
cd ../web      && npx tsc --noEmit && npm run lint
```

Notes:
- The contract must build **before** api and web — both consume it, and Action 1 adds a route
  member plus a params schema they import.
- `Apps/api`'s lint has **6 pre-existing errors** (3 in `prisma/seed.ts`, 3 in
  `src/common/middlewares/validate-request.middleware.ts`), both files untouched by this set —
  compare against that baseline, not against zero.
- `Apps/web`'s lint carries a large pre-existing prettier-noise baseline. Lint the files you
  actually touched, file by file, and confirm each is clean; a whole-package count is not a useful
  signal. If a rename pushes a line past the width limit, reformat it (this happened twice in S1/S2).
- `Apps/api/test/**` will not compile against the new `ICatalogProductService.deleteImage` member
  if a test double implements that interface — **do not edit it**; list it in the report.

---

## 3. Manual verification checklist

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

## 4. Execution protocol

Start Set S3 plan execution. After finishing, write
**`Docs/Stage-04-Fixes/results/report-S03.md`** describing what changed, and ending with the
**verification checklist** above. The report must additionally record:

- **R1 verbatim** — that the brief's "leave barcode editing disabled for now" was retracted by the
  owner as a mistake, and that barcode editing and auto-generation are unchanged. A later set
  reading the original brief must not re-apply it.
- **F1** — the `valueAsNumber` → `NaN` root cause, all four sites, and the fact that this is the
  same trap `AdminProductsAdd.tsx` documented long ago. **Handoff to every future set**: never
  register an optional numeric field with `valueAsNumber: true` in this codebase.
- **F2** — the `save()` flow bug found while fixing F1 (not in the brief).
- **F7** — that RC-3 on the products list needed no work (S2's CSS fix already covered it) and what
  the stock-status column actually needed instead.
- The `Action 10a` limitation, stated plainly: a category price can be **set and changed** from
  Product Info but **not cleared back to "no price"** — neither the form nor
  `applyPricing`/`ProductPrice` has a delete path. Flag it for **S7**, which rebuilds the
  full price grid in the supplier-invoice reprice context.
- That `product-information-header.tsx`'s `onSave` prop was widened to `() => void | Promise<void>`
  for honesty rather than necessity (the old `() => void` already accepted the async handler).
- Which confirm mechanism Action 12 used (`AlertDialog` vs `window.confirm`).
- Action 14's grep results, and every stale test file named individually — none may be edited.

The owner reviews and approves before S4 begins.
