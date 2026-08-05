# Plan S19 — Barcode: generation API & label printing

**Scope:** one feature end to end — a backend barcode generator in the catalog module, its use from
the two product forms (Add Product / Product Info), and printing Code 128 labels from the admin
products list.

**Sets that must land first:** none. S19 is the first of S19→S21 and depends only on work already
merged (S3 rewrote both product forms and the products list; S18 added the staff taxonomy routes).
S21 will extend the same contract files this set touches, so run S19 first.

**Schema/migration:** **none.** `Product.barcode` is already `String? @unique`
(`Apps/api/prisma/schema.prisma:455`) — exactly what the generator needs. No `prisma migrate`,
no `prisma generate`, no mapper change (the new DTO carries no Prisma entity).

---

## Decisions already taken by the owner — do not re-open

| # | Question | Resolution |
|---|---|---|
| **Q1** | Letter extraction from family/brand names | **Strip diacritics (NFD + drop combining marks), uppercase, keep `[A-Z0-9]` only, take the first 2; right-pad with `X` if fewer than 2 remain.** `"Écrans"`→`EC`, `"K"`→`KX`, `"3M"`→`3M`, `"شاشة"`→`XX`. Digits are kept. Generation never fails on the name alone. |
| **Q2** | Collision retry bound | **10 attempts**, regenerating only the 5 digits, then **409** telling the admin to enter a barcode manually. |
| **Q4** | Label content | **Barcode symbol + its human-readable digits only.** No product name, no price. Label box **40 mm × 25 mm**, ~40 per A4 page. Rationale recorded by the owner: nothing on the label can go stale, and there is no single correct price (it varies by client category). |

**Superseded instruction:** the brief says S3 left barcode editing disabled on Add Product. It did
not — S3's decision **R1** recorded that the "leave barcode editing disabled" instruction was a
mistake and **retracted** it, and `AdminProductsAdd.tsx:310` has shipped a freely editable barcode
input ever since. There is nothing to undo. S19 only replaces the *client-side fake generator* with
the real API and adds the same button to Product Info.

---

## Format recap (the executor should keep this in view)

```
DIIP00001
└┬┘└┬┘└─┬─┘
 │  │   └── 5 random digits, zero-padded to exactly 5
 │  └────── first 2 letters of the BRAND  ("iphone" → IP)
 └───────── first 2 letters of the FAMILY ("display" → DI)
```
Total length **9**, alphanumeric ⇒ **Code 128** is the only applicable symbology (EAN-13/UPC are
fixed-length numeric).

---

# Part A — Contract (`Apps/contract`)

### A1 — New file `Apps/contract/src/modules/catalog/catalog.constants.ts`

The module has no constants file yet (`catalog.enums.ts` holds only `enum`s). Create one; S21 will
extend it.

```ts
// S19 — generated barcode format: <2 chars of the family name><2 chars of the brand name><5 digits>,
// e.g. family "display" + brand "iphone" -> "DIIP00001". Every magnitude in that sentence is named
// here because the generator (api), the response schema (contract) and the label sheet (web) must
// all agree on it.
export const BARCODE_PREFIX_CHARS = 2;
export const BARCODE_DIGITS = 5;
export const BARCODE_LENGTH = BARCODE_PREFIX_CHARS * 2 + BARCODE_DIGITS; // 9

// Owner decision Q1 — a name that yields fewer than BARCODE_PREFIX_CHARS usable characters (a
// one-letter family, or a purely non-Latin one like "شاشة") is right-padded with this character,
// so the prefix is always exactly 2 chars and generation never fails on the name alone.
export const BARCODE_PREFIX_PAD_CHAR = 'X';

// Owner decision Q2 — the loop must terminate. Five digits give 100 000 combinations per
// family-brand pair, so exhaustion is effectively impossible; the bound exists only as a guarantee.
export const BARCODE_GENERATION_MAX_ATTEMPTS = 10;

// Upper bound on one print run (S19 label sheet). Guards against a mistyped quantity rendering
// tens of thousands of SVG symbols and freezing the tab.
export const BARCODE_LABEL_MAX_QUANTITY = 200;

// Business-rule sentinels. They travel as the *error message*, not `error.code` — the API's
// ConflictError/BadRequestError hardcode the generic ErrorCode (RESOURCE_CONFLICT /
// VALIDATION_ERROR), which is why lib/query-client.ts's `apiErrorMessage()` exists. Declared here
// so neither side compares a bare string literal.
export const CATALOG_ERROR = {
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  BARCODE_GENERATION_EXHAUSTED: 'BARCODE_GENERATION_EXHAUSTED',
} as const;
export type CatalogErrorSentinel = (typeof CATALOG_ERROR)[keyof typeof CATALOG_ERROR];
```

### A2 — `Apps/contract/src/modules/catalog/index.ts`

Add `export * from './catalog.constants';` as the **first** export line (constants before enums —
`catalog.dtos.ts` will import from it, and this file's order is otherwise alphabetical-by-layer).

### A3 — `Apps/contract/src/modules/catalog/catalog.routes.ts`

Add to `CATALOG_ROUTES`, immediately after `PRODUCT_STATS`:

```ts
  // S19 — barcode generation. A POST (not a GET) because each call must yield a *fresh* value:
  // nothing is written, but the response is deliberately non-idempotent and must never be cached
  // by a browser or a proxy. Registered before ADMIN_PRODUCT_BY_ID for the same reason
  // PRODUCT_STATS is (see catalog.routes.ts in the api).
  GENERATE_BARCODE: '/admin/products/barcode',
```

### A4 — `Apps/contract/src/modules/catalog/catalog.command.ts`

Append (after `UpdatePricingSchema`, before `CreateBrandSchema`):

```ts
// S19 — the generator needs the two names its prefix is built from; ids, not names, so the caller
// cannot influence the prefix and the service reads the authoritative rows itself.
export const GenerateBarcodeSchema = z.object({
  familyId: z.uuid(),
  brandId: z.uuid(),
});
export type GenerateBarcodeCommand = z.infer<typeof GenerateBarcodeSchema>;
```

### A5 — `Apps/contract/src/modules/catalog/catalog.dtos.ts`

Add the import at the top, next to the existing `StockStatus` import:

```ts
import { BARCODE_LENGTH } from './catalog.constants';
```

and append, after `ProductStatsResponseSchema`:

```ts
// S19 — a suggestion, not a reservation: nothing is written when this is returned, and the admin
// may overwrite or clear it before saving. `Product.barcode @unique` stays the real guard.
export const GeneratedBarcodeResponseSchema = z.object({
  barcode: z.string().length(BARCODE_LENGTH),
});
export type GeneratedBarcodeDto = z.infer<typeof GeneratedBarcodeResponseSchema>;
```

---

# Part B — Backend (`Apps/api/src/modules/catalog`)

### B1 — `catalog.interface.ts`

Add to the type-import list from `@dragon-telecom/contract`: `GenerateBarcodeCommand`,
`GeneratedBarcodeDto`. Add one method to `ICatalogProductService`, after `productStats()`:

```ts
  generateBarcode(cmd: GenerateBarcodeCommand): Promise<GeneratedBarcodeDto>;
```

### B2 — `catalog.service.ts` — module-level helpers

Add to the value imports from `@dragon-telecom/contract`:
`BARCODE_DIGITS`, `BARCODE_GENERATION_MAX_ATTEMPTS`, `BARCODE_PREFIX_CHARS`,
`BARCODE_PREFIX_PAD_CHAR`, `CATALOG_ERROR`; and to the type imports:
`GenerateBarcodeCommand`, `GeneratedBarcodeDto`.

Insert immediately **after** `generateSku()` (line 65-67) and before `slugify()`:

```ts
// S19 — the two-character half of a generated barcode prefix (owner decision Q1). NFD splits an
// accented letter into base + combining mark, the mark class is dropped, and everything that is
// not A-Z or 0-9 goes with it: "Écrans" -> EC, "3M" -> 3M, "K" -> KX, "شاشة" -> XX. Right-padding
// guarantees a fixed width, so the total barcode length is constant and BARCODE_LENGTH holds.
function barcodePrefix(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip the combining marks NFD just split off
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized.slice(0, BARCODE_PREFIX_CHARS).padEnd(BARCODE_PREFIX_CHARS, BARCODE_PREFIX_PAD_CHAR);
}

// Zero-padded to exactly BARCODE_DIGITS characters — "42" must render as "00042", or two barcodes
// of different lengths could share a prefix and read ambiguously off a scanner.
function randomBarcodeDigits(): string {
  return Math.floor(Math.random() * 10 ** BARCODE_DIGITS)
    .toString()
    .padStart(BARCODE_DIGITS, '0');
}
```

### B3 — `catalog.service.ts` — `CatalogProductService.generateBarcode`

Add as a public method on `CatalogProductService`, placed after `productStats()` and before the
`private resolveBrandId(...)` block:

```ts
  // S19 — a read-only probe: no row is written, so no transaction and no lock. Two admins
  // generating at the same instant can still be handed the same candidate; that is deliberate and
  // harmless, because `Product.barcode @unique` is the real guard and createProduct/updateProduct
  // already translate its P2002 into a CATALOG_ERROR.BARCODE_TAKEN conflict the forms put on the
  // barcode field. The returned value is a suggestion the admin may overwrite or clear.
  async generateBarcode(cmd: GenerateBarcodeCommand): Promise<GeneratedBarcodeDto> {
    const [family, brand] = await Promise.all([
      this.prisma.family.findUnique({ where: { id: cmd.familyId }, select: { name: true } }),
      this.prisma.brand.findUnique({ where: { id: cmd.brandId }, select: { name: true } }),
    ]);
    if (!family) throw new NotFoundError('Family');
    if (!brand) throw new NotFoundError('Brand');

    const prefix = `${barcodePrefix(family.name)}${barcodePrefix(brand.name)}`;

    // Only the digits are regenerated on collision (the prefix is derived, not random), bounded by
    // BARCODE_GENERATION_MAX_ATTEMPTS so the loop always terminates (owner decision Q2).
    for (let attempt = 0; attempt < BARCODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const candidate = `${prefix}${randomBarcodeDigits()}`;
      const taken = await this.prisma.product.findUnique({
        where: { barcode: candidate },
        select: { id: true },
      });
      if (!taken) return { barcode: candidate };
    }

    throw new ConflictError(CATALOG_ERROR.BARCODE_GENERATION_EXHAUSTED);
  }
```

### B4 — `catalog.service.ts` — barcode conflicts become a contract sentinel

Three edits, all in `CatalogProductService`:

1. **line 646**, in `createProduct`'s catch:
   `throw new ConflictError('Barcode already in use')`
   → `throw new ConflictError(CATALOG_ERROR.BARCODE_TAKEN)`
2. **line 668**, in `updateProduct`'s catch: the same replacement.

   Reason: the requirement is that a barcode collision lands **on the barcode field**. The frontend
   can only do that by recognising the failure, and `apiErrorMessage()` (the documented way — see
   the comment block at `Apps/web/src/lib/query-client.ts:15-21`) compares the *message*. An English
   sentence is not a comparable token; the contract constant is.
3. **line 658**, in `updateProduct`'s `data`: an emptied barcode must clear the column, not store
   `''`. `''` is subject to the same unique index, so the *second* product whose barcode is cleared
   would 409 on an empty string. Replace:

```ts
          // S19 — the field is freely editable and may be *cleared*; an empty string would be
          // stored and then collide with the next cleared product under `barcode @unique`, so
          // blank maps to NULL. Trimmed for the same reason a scanned value must match exactly.
          ...(cmd.barcode != null
            ? { barcode: cmd.barcode.trim() === '' ? null : cmd.barcode.trim() }
            : {}),
```

4. **line 582**, in `createProduct`'s `data`: keep the existing empty-skip but trim, so
   `" DIIP00001 "` and `"DIIP00001"` cannot both exist:

```ts
            ...(cmd.barcode != null && cmd.barcode.trim() !== ''
              ? { barcode: cmd.barcode.trim() }
              : {}),
```

### B5 — `catalog.controller.ts`

Add `GenerateBarcodeCommand` to the type imports. Add the handler at the end of the
`// --- Admin: products ---` block, after `productStats`:

```ts
  generateBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.products.generateBarcode(req.validated.body as GenerateBarcodeCommand));
    } catch (error) {
      next(error);
    }
  };
```

### B6 — `catalog.routes.ts`

Add `GenerateBarcodeSchema` to the contract import list. Register the route in the
`// --- Admin: products ---` block, **immediately after** the `PRODUCT_STATS` line (137) and
**before** `ADMIN_PRODUCTS`/`ADMIN_PRODUCT_BY_ID` — same literal-before-`:id` ordering rule the
existing comment on line 135-136 states:

```ts
// GENERATE_BARCODE ("/admin/products/barcode") shares PRODUCT_STATS's constraint: a literal
// segment under "/admin/products" must be registered before ADMIN_PRODUCT_BY_ID
// ("/admin/products/:id"), or Express would match `:id === "barcode"`.
router.post(
  CATALOG_ROUTES.GENERATE_BARCODE,
  adminOnly,
  validateRequest({ body: GenerateBarcodeSchema }),
  controller.generateBarcode,
);
```

Nothing else changes: the router is already mounted, DI is unchanged, and `CatalogProductService`
already receives `prisma`.

---

# Part C — Frontend plumbing (`Apps/web`)

### C1 — Add the rendering library

```
cd Apps/web && npm install jsbarcode
```

- **Version:** `jsbarcode@^3.12.3`, MIT. **Not currently a dependency** — nothing barcode-related is
  in `Apps/web/package.json` or `node_modules` today.
- **Do NOT install `@types/jsbarcode`.** Verified against this repo's exact `tsconfig.json`
  (`module: ESNext`, `moduleResolution: Bundler`, `strict`, no `esModuleInterop`): the package's own
  bundled `jsbarcode.d.ts` resolves and `import JsBarcode from "jsbarcode";` type-checks cleanly.
  Adding `@types/jsbarcode` (3.11.4, older than the runtime package) is redundant.
- **Why JsBarcode:** it emits **Code 128** into an `<svg>` and — confirmed in
  `bin/renderers/svg.js:155` — writes a `viewBox`, which is what lets the label CSS scale the symbol
  to a fixed mm box without distorting the bar-width ratios. A distorted symbol does not scan.

### C2 — `Apps/web/src/services/catalog.service.ts`

Add `GenerateBarcodeCommand` and `GeneratedBarcodeDto` to the contract type imports, and append this
function directly after `productStats()` (keeping the file's product-block ordering):

```ts
export async function generateBarcode(
  command: GenerateBarcodeCommand,
): Promise<GeneratedBarcodeDto> {
  const res = await api.post<ApiResponse<GeneratedBarcodeDto>>(
    apiPath(CATALOG_ROUTES.GENERATE_BARCODE),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
```

### C3 — `Apps/web/src/hooks/useCatalogProducts.ts`

Add `GenerateBarcodeCommand` to the contract type imports. Append to the `// --- Mutations ---`
section (last hook in the file):

```ts
// A mutation, not a query (S19): every click must produce a *fresh* candidate, and a `useQuery`
// keyed on {familyId, brandId} would hand the same barcode to two consecutive products from cache.
// Nothing is written server-side, so there is no cache to invalidate and no query key to define —
// which is also why this hook takes no queryClient.
export function useGenerateBarcode() {
  return useMutation({
    mutationFn: (command: GenerateBarcodeCommand) => catalogService.generateBarcode(command),
  });
}
```

**No `qk.catalog.*` entry is added.** Deliberate — mutations have no query key, and inventing one
here would suggest a cache that must not exist.

### C4 — `Apps/web/src/lib/query-client.ts` — translate the two new sentinels

Today a backend sentinel reaches the generic mutation toast **raw**, so a barcode collision would
pop a toast reading literally `BARCODE_TAKEN`. Fix it for the two sentinels this set introduces
(scope-limited on purpose — do not sweep the pre-existing `INSUFFICIENT_STOCK` /
`CREDIT_REQUIRES_CLIENT` call sites, that is not this set's job).

Add to the imports: `import { CATALOG_ERROR } from "@dragon-telecom/contract";` (merge into the
existing `type ApiResponse` import line — it becomes a mixed value/type import).

Insert above `message()`:

```ts
// Business-rule sentinels travel as the error *message* (see apiErrorMessage below). When one
// reaches this generic toast it must not surface as a raw SCREAMING_SNAKE token — map the ones
// this app raises to a translated sentence. Anything unmapped falls through unchanged.
const SENTINEL_TRANSLATION_KEYS: Record<string, string> = {
  [CATALOG_ERROR.BARCODE_TAKEN]: "common.errors.sentinel.barcodeTaken",
  [CATALOG_ERROR.BARCODE_GENERATION_EXHAUSTED]: "common.errors.sentinel.barcodeGenerationExhausted",
};
```

and change `message()`'s body to consult it:

```ts
export const message = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) {
      const key = SENTINEL_TRANSLATION_KEYS[data.error.message];
      return key ? translate(key, getLanguage()) : data.error.message;
    }
  }
  return translate("common.errors.crashTitle", getLanguage());
};
```

`translate` and `getLanguage` are already imported in this file. **`apiErrorMessage()` is left
untouched** — it must keep returning the raw sentinel, because that is what the field-error checks
in Part D compare against.

---

# Part D — Product forms

## D1 — `Apps/web/src/pages/admin/products/AdminProductsAdd.tsx`

**D1.1 — Delete the fake generator.** Remove lines 120-126 entirely:

```ts
  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-8);
    ...
  };
```

It produced `BC` + a timestamp — not the specified format, never checked for uniqueness, and never
touched the server.

**D1.2 — Imports.** Add `useGenerateBarcode` to the existing `@/hooks/useCatalogProducts` import;
add `import { CATALOG_ERROR } from "@dragon-telecom/contract";`; add
`import { apiErrorMessage } from "@/lib/query-client";`.

**D1.3 — Destructure `setError` and `clearErrors`** from the existing `useForm({...})` call
(line 87-99), alongside `setValue`/`getValues`/`reset`.

**D1.4 — The real handler.** Add where the deleted one was:

```ts
  const generateBarcode = useGenerateBarcode();

  // The barcode prefix is derived from the family and brand names, so both must be chosen before a
  // request is worth making — a guard, not a validation error: the field itself stays optional and
  // freely editable, and the generated value is only ever a suggestion.
  const handleGenerateBarcode = () => {
    const currentFamilyId = getValues("familyId");
    const currentBrandId = getValues("brandId");
    if (!currentFamilyId || !currentBrandId) {
      toast.error(t("admin.productsAdd.barcodeNeedsFamilyBrand"));
      return;
    }
    clearErrors("barcode");
    generateBarcode.mutate(
      { familyId: currentFamilyId, brandId: currentBrandId },
      {
        // Overwrites whatever is in the field — the admin asked for a new one by clicking. Failures
        // (including the bounded-retry 409) surface through query-client.ts's generic toast, which
        // now renders the translated sentinel rather than the raw token.
        onSuccess: ({ barcode }) => setValue("barcode", barcode, { shouldDirty: true }),
      },
    );
  };
```

**D1.5 — The field.** Replace the barcode block (lines 307-316) with:

```tsx
            <div className="space-y-1">
              <Label htmlFor="add-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
              <div className="flex gap-2">
                <Input id="add-barcode" {...register("barcode")} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateBarcode}
                  disabled={generateBarcode.isPending}
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {t("admin.productsAdd.autoGenerateBarcode")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.productsAdd.barcodeHelper")}
              </p>
              {errors.barcode && (
                <p className="text-sm text-destructive">{errors.barcode.message}</p>
              )}
            </div>
```

The `errors.barcode` line is new — the field had no error slot at all, which is why a server-side
collision had nowhere to land.

**D1.6 — Collision lands on the field.** In `confirmSubmit` (line 161-181), replace
`onError: () => setShowConfirm(false)` with:

```ts
        onError: (err) => {
          setShowConfirm(false);
          // A duplicate barcode is a field problem, not a page-level one — the confirm dialog
          // closes so the admin is looking at the form when the message appears under the input.
          // Every other failure keeps the generic mutationCache toast as its only surface.
          if (apiErrorMessage(err) === CATALOG_ERROR.BARCODE_TAKEN) {
            setError("barcode", { type: "server", message: t("admin.productsAdd.barcodeTaken") });
          }
        },
```

and add `clearErrors("barcode");` as the first statement of `confirmSubmit`, so a retry after a fix
does not show a stale message.

**D1.7 — Update the stale header comment.** The block comment at lines 53-64 still describes the
page as-built in set-03. Append one sentence:

```
// S19: the barcode field's "Auto-generate" now calls the real catalog generator
// (useGenerateBarcode) instead of the old BC+timestamp string it produced locally; the field
// itself stays freely editable and optional, and a duplicate is reported on the field.
```

## D2 — `Apps/web/src/pages/admin/products/use-edit-mode.ts`

**D2.1 — Imports.** Add `useGenerateBarcode` to the `@/hooks/useCatalogProducts` import; add
`CATALOG_ERROR` as a value import from `@dragon-telecom/contract` (the file currently imports only
`type AdminProductDto` from it); add `import { apiErrorMessage } from "@/lib/query-client";`.

**D2.2 — Generation.** Add after the `pricingForm` declaration:

```ts
  const generateBarcodeMutation = useGenerateBarcode();

  // ADM-04's barcode is editable in edit mode (S19) and a generated value is only a suggestion: it
  // lands in the form, not the database, until Save runs. Unlike ADM-03 there is no "choose a
  // family and brand first" guard — UpdateProductCommand cannot change taxonomy (catalog spec
  // Business Logic #6), so an existing product always has both.
  const generateBarcode = () => {
    if (!product) return;
    detailsForm.clearErrors("barcode");
    generateBarcodeMutation.mutate(
      { familyId: product.family.id, brandId: product.brand.id },
      { onSuccess: ({ barcode }) => detailsForm.setValue("barcode", barcode, { shouldDirty: true }) },
    );
  };
```

**D2.3 — `save()` must await the mutations.** Required by the "error on the field, not a banner"
rule, and a genuine fix: today `save()` sets `detailsOk = true` *synchronously* inside the
`handleSubmit` callback and fires the success toast before the server has answered, so a server-side
rejection arrives after edit mode has already closed and any field error would be invisible.

Replace the body of `save` (lines 78-100) with:

```ts
  const save = async () => {
    if (!product) return;
    let detailsOk = false;
    let pricingOk = false;
    detailsForm.clearErrors("barcode");

    await Promise.all([
      detailsForm.handleSubmit(async (values) => {
        try {
          await updateProduct.mutateAsync({ id: product.id, command: values });
          detailsOk = true;
        } catch (err) {
          // S19 — a duplicate barcode is a field problem: keep edit mode open and put the message
          // under the barcode input. Every other failure is already reported by query-client.ts's
          // generic mutationCache toast; `detailsOk` staying false is what holds edit mode open.
          if (apiErrorMessage(err) === CATALOG_ERROR.BARCODE_TAKEN) {
            detailsForm.setError("barcode", {
              type: "server",
              message: t("admin.productsAdd.barcodeTaken"),
            });
          }
        }
      })(),
      pricingForm.handleSubmit(async (values) => {
        try {
          await updatePricing.mutateAsync({ id: product.id, command: values });
          pricingOk = true;
        } catch {
          // Surfaced by the generic mutationCache toast; the flag staying false holds edit mode.
        }
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

**D2.4 — Update the stale comment** at lines 74-77: it says success is tracked "by a flag set inside
each valid-callback" because "both handleSubmit calls resolve after validation regardless of
outcome". That is still true of validation, but the flags now also mean *the request succeeded*.
Rewrite it as:

```ts
  // Both handleSubmit calls resolve after validation regardless of outcome, so success is tracked
  // by a flag — but the flag is now set only after the request itself resolves (S19), not merely
  // after validation passes. Previously the success toast fired and edit mode closed before the
  // server answered, which left a server-side rejection (a duplicate barcode) with nowhere visible
  // to land. Falling out of edit mode having saved nothing and shown nothing was S3 finding F2.
```

**D2.5 — Return the new members** from the hook:

```ts
  return {
    isEditMode,
    isSaving: updateProduct.isPending || updatePricing.isPending,
    toggle,
    save,
    cancel,
    generateBarcode,
    isGeneratingBarcode: generateBarcodeMutation.isPending,
    detailsForm,
    pricingForm,
  };
```

## D3 — `Apps/web/src/pages/admin/products/components/product-details-section.tsx`

Keep the component dumb (it takes `register`/`errors` today; it must not grow a hook). Add two props
and the button.

**D3.1 — Props interface:**

```ts
interface ProductDetailsSectionProps {
  product: AdminProductDto;
  isEditMode: boolean;
  register: UseFormRegister<ProductDetailsFormValues>;
  errors: FieldErrors<ProductDetailsFormValues>;
  /** S19 — owned by use-edit-mode.ts (which holds the form the generated value is written into);
   *  this component only renders the trigger, exactly like it only renders the inputs. */
  onGenerateBarcode: () => void;
  isGeneratingBarcode: boolean;
}
```

**D3.2 — Imports:** `Button` from `@/components/ui/button`, `Wand2` from `lucide-react`.

**D3.3 — Replace the barcode block** (lines 53-60):

```tsx
        <div className="space-y-1">
          <Label htmlFor="details-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
          {isEditMode ? (
            <>
              <div className="flex gap-2">
                <Input id="details-barcode" {...register("barcode")} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateBarcode}
                  disabled={isGeneratingBarcode}
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {t("admin.productsAdd.autoGenerateBarcode")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.productsAdd.barcodeHelper")}
              </p>
              {errors.barcode && (
                <p className="text-sm text-destructive">{errors.barcode.message}</p>
              )}
            </>
          ) : (
            <p className="text-sm">{product.barcode ?? "—"}</p>
          )}
        </div>
```

## D4 — `Apps/web/src/pages/admin/products/AdminProductInformation.tsx`

Pass the two new props through (line 81-86):

```tsx
        <ProductDetailsSection
          product={product}
          isEditMode={editMode.isEditMode}
          register={editMode.detailsForm.register}
          errors={editMode.detailsForm.formState.errors}
          onGenerateBarcode={editMode.generateBarcode}
          isGeneratingBarcode={editMode.isGeneratingBarcode}
        />
```

---

# Part E — Products list: print labels

## E1 — New `Apps/web/src/pages/admin/products/components/barcode-label.tsx`

```tsx
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
}

// S19 — one 40 x 25 mm label (owner decision Q4: the symbol and its digits, nothing else — no
// product name, no price; a price would be stale the moment pricing changed and is not the price
// an approved client sees anyway).
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the label box without distorting the bar
// ratios — a distorted symbol does not scan. The box is forced white-on-black regardless of theme:
// JsBarcode draws black bars, and a dark-mode card behind them would print (and preview) unreadably.
export function BarcodeLabel({ value }: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 48,
      width: 2,
      margin: 0,
      textMargin: 2,
    });
  }, [value]);

  return (
    <div className="flex h-[25mm] w-[40mm] items-center justify-center overflow-hidden border border-dashed border-black/40 bg-white p-[1mm] text-black">
      <svg ref={svgRef} className="h-auto w-full" />
    </div>
  );
}
```

## E2 — New `Apps/web/src/pages/admin/products/components/barcode-label-dialog.tsx`

```tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { BARCODE_LABEL_MAX_QUANTITY, type AdminProductDto } from "@dragon-telecom/contract";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { BarcodeLabel } from "@/pages/admin/products/components/barcode-label";

interface BarcodeLabelDialogProps {
  /** null when no row has been picked — the dialog owns no product of its own. */
  product: AdminProductDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Clamped on every keystroke rather than on submit: an accidental extra digit would otherwise
// render tens of thousands of SVG symbols and freeze the tab before Print was ever pressed. A
// cleared field reads as NaN and falls back to 1.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S19 — the print sheet is portalled to <body> as #barcode-print-root and is display:none on
// screen; the `@media print` rule in index.css hides every *other* direct child of <body> (the app
// root, and Radix's dialog portals, which are body children too) and shows only the sheet. That is
// why the sheet lives outside <DialogContent>: nested inside it, the dialog's own fixed positioning
// and max-height would clip the page at one screenful of labels.
export function BarcodeLabelDialog({ product, open, onOpenChange }: BarcodeLabelDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);

  // Re-seed from the product's on-hand stock each time the dialog opens — one label per unit in
  // stock is the common case. A product with zero stock still gets a printable single label rather
  // than an empty sheet.
  useEffect(() => {
    if (open && product) setQuantity(clampQuantity(product.quantityOnHand));
  }, [open, product]);

  // A product with no barcode has nothing to encode; the list already renders its action disabled,
  // this is the matching guard.
  if (!product?.barcode) return null;
  const barcode = product.barcode;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.productsList.printLabels.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("admin.productsList.printLabels.preview")}</Label>
              <div className="flex justify-center">
                <BarcodeLabel value={barcode} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="label-quantity">
                {t("admin.productsList.printLabels.quantityLabel")}
              </Label>
              <Input
                id="label-quantity"
                type="number"
                min={1}
                max={BARCODE_LABEL_MAX_QUANTITY}
                value={quantity}
                onChange={(event) => setQuantity(clampQuantity(Number(event.target.value)))}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.quantityHelper", {
                  max: BARCODE_LABEL_MAX_QUANTITY,
                })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("admin.productsList.printLabels.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open &&
        createPortal(
          <div id="barcode-print-root" className="hidden">
            <div className="flex flex-wrap gap-[2mm]">
              {Array.from({ length: quantity }, (_, index) => (
                <BarcodeLabel key={index} value={barcode} />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
```

## E3 — `Apps/web/src/index.css` — the print rule

Append at the end of the file:

```css
/* S19 — barcode label printing. #barcode-print-root is portalled to <body> by
   barcode-label-dialog.tsx and is display:none on screen; at print time every other direct child of
   <body> is hidden (that covers the app root *and* Radix's dialog portals, which are also body
   children) and only the label sheet is laid out, so the browser's print preview shows the labels
   alone. Written as plain CSS rather than Tailwind `print:` utilities because the `body > *` sibling
   selector has no utility equivalent. */
@media print {
  @page {
    size: A4;
    margin: 8mm;
  }

  body > *:not(#barcode-print-root) {
    display: none !important;
  }

  #barcode-print-root {
    display: block !important;
  }
}
```

## E4 — `Apps/web/src/pages/admin/products/components/admin-products-table.tsx`

**E4.1 — Imports:** add `Printer` to the `lucide-react` import.

**E4.2 — Props:** add

```ts
  /** S19 — the page owns the dialog (the table stays dumb); this only reports which row was
   *  picked. Rows whose product has no barcode render the action disabled rather than hidden, so
   *  the column width never jumps between rows. */
  onPrintBarcode: (product: AdminProductDto) => void;
```

**E4.3 — Actions column** (lines 128-141) becomes two buttons, and its header changes from the
edit-only label:

```tsx
      {
        id: "actions",
        header: t("admin.productsList.table.actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link
                to={`/admin/products/${row.original.id}`}
                aria-label={t("admin.productsList.table.edit")}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!row.original.barcode}
              onClick={() => onPrintBarcode(row.original)}
              aria-label={t("admin.productsList.table.printLabels")}
              title={
                row.original.barcode
                  ? t("admin.productsList.table.printLabels")
                  : t("admin.productsList.table.printLabelsNoBarcode")
              }
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
```

**E4.4 — `useMemo` deps** (line 143): add `onPrintBarcode` →
`[t, language, onTogglePublished, onToggleEnabled, onPrintBarcode]`.

**E4.5 — Mobile row** (lines 146-162): add the print action next to the existing Edit link, so the
feature is not desktop-only:

```tsx
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{formatDZD(product.avgStockPrice, language)}</span>
        <div className="flex items-center gap-3">
          {product.barcode && (
            <button type="button" className="text-primary" onClick={() => onPrintBarcode(product)}>
              {t("admin.productsList.table.printLabels")}
            </button>
          )}
          <Link to={`/admin/products/${product.id}`} className="text-primary">
            {t("admin.productsList.table.edit")}
          </Link>
        </div>
      </div>
```

**E4.6 — Update the header comment** (lines 42-47), which currently ends "row action is Edit only
(→ ADM-04)". Append:

```
// S19: a second row action — print barcode labels — sits beside Edit; it is disabled (not hidden)
// on a product with no barcode, with the reason in its tooltip.
```

## E5 — `Apps/web/src/pages/admin/products/AdminProducts.tsx`

**E5.1 — Import** `BarcodeLabelDialog` from
`@/pages/admin/products/components/barcode-label-dialog`.

**E5.2 — State**, next to `optimisticOverrides`:

```ts
  // S19 — which row's labels are being printed; null closes the dialog. Lives on the page, not the
  // table, so both the stock tab's table and the dialog read one source of truth.
  const [labelProduct, setLabelProduct] = useState<AdminProductDto | null>(null);
```

**E5.3 — Pass the handler** to `<AdminProductsTable …>`: `onPrintBarcode={setLabelProduct}`.

**E5.4 — Render the dialog** as the last element inside the page's root `<div>`, after the
`SimplePagination` block:

```tsx
      <BarcodeLabelDialog
        product={labelProduct}
        open={!!labelProduct}
        onOpenChange={(open) => !open && setLabelProduct(null)}
      />
```

**Not in scope:** the *Prices* tab (`admin-product-prices-table.tsx`) keeps no row actions, and
`admin-product-actions.tsx` is an orphaned Sub-01 draft (numeric `productId`, zero importers) —
**do not reuse or edit it**.

---

# Part F — Translations (`Apps/web/src/config/translations.json`)

Flat keys, `{ en, fr, ar }`, `ar` stays `""` (matches every existing entry).

| Key | en | fr |
|---|---|---|
| `admin.productsAdd.barcodeHelper` | `Optional — generate one or type your own` | `Facultatif — générez-en un ou saisissez le vôtre` |
| `admin.productsAdd.barcodeNeedsFamilyBrand` | `Select a family and a brand first` | `Sélectionnez d'abord une famille et une marque` |
| `admin.productsAdd.barcodeTaken` | `This barcode is already used by another product` | `Ce code-barres est déjà utilisé par un autre produit` |
| `common.errors.sentinel.barcodeTaken` | `This barcode is already used by another product` | `Ce code-barres est déjà utilisé par un autre produit` |
| `common.errors.sentinel.barcodeGenerationExhausted` | `Couldn't generate a unique barcode — enter one manually` | `Impossible de générer un code-barres unique — saisissez-en un manuellement` |
| `admin.productsList.table.actions` | `Actions` | `Actions` |
| `admin.productsList.table.printLabels` | `Print labels` | `Imprimer les étiquettes` |
| `admin.productsList.table.printLabelsNoBarcode` | `This product has no barcode yet` | `Ce produit n'a pas encore de code-barres` |
| `admin.productsList.printLabels.title` | `Print barcode labels` | `Imprimer les étiquettes de code-barres` |
| `admin.productsList.printLabels.preview` | `Preview` | `Aperçu` |
| `admin.productsList.printLabels.quantityLabel` | `Number of labels` | `Nombre d'étiquettes` |
| `admin.productsList.printLabels.quantityHelper` | `Defaults to the quantity on hand. Maximum {max}.` | `Par défaut, la quantité en stock. Maximum {max}.` |
| `admin.productsList.printLabels.print` | `Print` | `Imprimer` |

`admin.productsAdd.autoGenerateBarcode` ("Auto-generate" / "Générer automatiquement") and
`common.actions.cancel` already exist — **reuse, do not duplicate**.
`{max}` is interpolated by `lib/i18n.ts`'s `interpolate()`; pass it as
`t(key, { max: BARCODE_LABEL_MAX_QUANTITY })`.

---

# Part G — Execution order & validation

Strict dependency order:

1. **A1–A5** contract (constants → index export → route → command → DTO)
2. **B1–B6** backend (interface → service helpers → `generateBarcode` → sentinel/trim edits →
   controller → route)
3. **C1** `npm install jsbarcode` in `Apps/web`
4. **C2–C4** web service → hook → sentinel toast map
5. **F** translation keys (**before** D and E, so no component references a missing key)
6. **D1–D4** product forms
7. **E1–E5** label printing

**Validation — compile and lint only. Do not run any test suite, and do not modify any test file.**

```
cd Apps/contract && npm run check && npm run lint
cd Apps/api     && npx tsc --noEmit && npm run lint
cd Apps/web     && npm run check && npm run lint
```

`Apps/web`'s `check` runs `tsc --noEmit` twice (app + `tsconfig.test.json`, which includes `tests/`),
so a props change that broke an existing test's typing would show up there. It does not — verified:
`AdminProductsTable`, `ProductDetailsSection` and `useEditMode` have no direct test callers, and the
only test that touches this area (`Apps/web/tests/unit/pages/admin-products/products-add.test.tsx`)
renders `<AdminProductsAdd />` with no props and never clicks Auto-generate.

**Known, deliberate follow-up (do not act on it in this set):**
`Apps/web/tests/fixtures/msw/catalog.handlers.ts` has no handler for `GENERATE_BARCODE`. Any future
test that clicks Auto-generate will need one — out of scope here, because test files must not be
modified.

---

# Manual verification checklist (browser)

**Generation — Add Product** (`/admin/products/add`, as ADMIN)

1. With **no family and no brand** selected, click **Auto-generate** → a toast reads "Select a
   family and a brand first", the barcode field stays empty, and the Network tab shows **no**
   request.
2. Select family **Display** (or any) and brand **iPhone** (or any), click **Auto-generate** → the
   field fills with a 9-character value whose first four characters are the uppercased first two
   letters of each name (e.g. `DIIP…`) and whose last five are digits.
3. Click **Auto-generate** again → a **different** value each time (never the same one twice — this
   is what makes it a mutation rather than a cached query).
4. Type over the generated value by hand, then clear it completely → both are allowed; the field is
   never read-only and never re-fills itself.
5. Pick a family or brand whose name is one character, or accented, or non-Latin (create one inline
   if needed, e.g. a family called `K` and a brand called `Écrans`) → the prefix is `KXEC`, not a
   crash and not a shorter barcode.
6. Save the product with a generated barcode → it appears in the products list with that barcode in
   the Barcode column.
7. Add another product, type **the barcode you just used**, and save → the create fails, the message
   **"This barcode is already used by another product"** appears **under the barcode input**, the
   confirm dialog closes, and the toast says the same thing (not `BARCODE_TAKEN`).

**Generation — Product Info** (`/admin/products/<id>`)

8. Click **Edit** → the barcode field is editable and shows an **Auto-generate** button; outside edit
   mode it is still plain text.
9. Click **Auto-generate** → the field fills with a fresh value derived from *this product's* family
   and brand. Click **Cancel** → the field reverts to the saved barcode; nothing was written.
10. Generate again, then **Save** → success toast, edit mode closes, and the header/details show the
    new barcode after the refetch.
11. Edit, type a barcode that belongs to **another** product, Save → **edit mode stays open**, the
    message lands under the barcode input, and no success toast appears.
12. Edit, **clear** the barcode entirely, Save → the barcode shows "—". Clear a **second** product's
    barcode the same way → it also succeeds (this is the empty-string-vs-NULL fix; before it, the
    second clear would 409).

**Label printing** (`/admin/products`)

13. The row actions column now shows **two** icons: the pencil and a printer.
14. Hover the printer on a product **with no barcode** → it is disabled and its tooltip reads "This
    product has no barcode yet"; clicking does nothing.
15. Click the printer on a product **with** a barcode → a dialog opens showing one label preview
    (bars + the 9 characters underneath, black on white in both light and dark theme) and a
    **Number of labels** input **pre-filled with that product's on-hand quantity**.
16. Set the quantity to `3`, click **Print** → the browser print preview shows **exactly 3** labels
    on an A4 page, tiled left-to-right, and **nothing else** — no app chrome, no sidebar, no dialog
    box. Cancel the print dialog → the app is intact and the dialog is still open.
17. Set the quantity to `40` → the print preview fills roughly one A4 page. Set it to `9999` → it
    clamps to `200`. Clear the field → it falls back to `1`.
18. A product with **0 on hand** → the quantity pre-fills to `1`, not `0`, and printing yields one
    label.
19. Scan one printed (or on-screen) label with the POS barcode scanner (`/staff/pos`, F2) or type the
    value into the products search → the correct product is found. **This is the only check that
    proves the Code 128 symbol is well-formed and undistorted — do not skip it.**
20. Close the dialog and print any other page normally (Ctrl+P on the products list with no dialog
    open) → the page prints as before; the label rule only takes effect while the dialog is open.
