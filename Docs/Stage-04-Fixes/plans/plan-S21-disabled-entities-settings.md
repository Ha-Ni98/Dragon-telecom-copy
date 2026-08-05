# Plan S21 — Settings: disabled products, families & brands

**Scope:** contract → backend → frontend. One new admin-only query filter, one DTO widening, a
re-enable action for taxonomy, a new Settings tab for disabled products, and one load-bearing
cache-key bug fix. **No schema change, no migration** — `isEnabled` already exists on `Product`,
`Family`, `Brand` and `DeviceModel`.

**Sets that must land first:** S19 (it introduced `catalog.constants.ts` and `CATALOG_ERROR`, which
this set extends). S20 is unrelated and already landed.

---

## Premise corrections — read before planning any action

Three statements in the brief do not match the code. Two of them change what this set builds.

### 1. Taxonomy is already exposed. Only the button is missing.

The brief says "every list endpoint returns enabled rows only." That is **false for families,
brands and models**. `ICatalogTaxonomyService` already takes an `includeDisabled` flag, and the
admin controller already passes `true`:

```ts
// catalog.controller.ts
listAdminBrands   → this.taxonomy.listBrands(true)
listAdminFamilies → this.taxonomy.listFamilies(query, true)
listAdminModels   → this.taxonomy.listModels(query, true)
```

And `Settings → Hierarchy` (`hierarchy-panel.tsx`) **already renders disabled rows**, each with an
`<EnabledBadge>` reading "Disabled". The only gap is that its single action button is hard-wired to
disable and is greyed out once the row is already disabled:

```tsx
<EnabledBadge isEnabled={family.isEnabled} />
<Button … onClick={() => onDisableFamily(family.id)} disabled={!family.isEnabled}>
  {t("common.actions.disable")}
</Button>
```

⇒ **Taxonomy needs no contract, route, service or DTO change whatsoever.** It needs an Enable
button and a handler. The backend PATCH already accepts `{ isEnabled: true }`
(`UpdateFamilySchema`/`UpdateBrandSchema`/`UpdateModelSchema` all carry `isEnabled?: boolean`).

### 2. Products genuinely are unreachable — and here is exactly why.

`catalog.service.ts#staffAdminWhere` hardcodes the flag **after** spreading `extra`, so a caller can
never override it:

```ts
private staffAdminWhere(query: ProductListQuery, extra: Prisma.ProductWhereInput = {}) {
  return {
    ...extra,
    isEnabled: true,   // ← always wins; `extra.isEnabled` is dead
    …
  };
}
```
`listAdminProducts` calls `staffAdminWhere(query)` ⇒ disabled products can never be listed.
(`listStaffProducts` calls `staffAdminWhere(query, { isEnabled: true })` — that `extra` has always
been a no-op for exactly this reason. Note it when you touch the line.)

Meanwhile `/admin/products` already renders a per-row **Enabled** switch, so an admin can disable a
product and watch it vanish permanently. That is the real bug this set fixes.

### 3. A disabled family or brand does **not** hide its products. (Resolves Q5.)

The brief's Q5 assumes a product under a disabled family "stays hidden with no explanation."
The public storefront query filters on the **product only** — there is no join filter on taxonomy
anywhere in `catalog.service.ts` (verified by grep):

```ts
// listProducts — the entire visibility rule
const where: Prisma.ProductWhereInput = {
  isEnabled: true,
  isPublished: true,
  …                      // ← no `family: { isEnabled: true }`, no `brand: { isEnabled: true }`
};
```

So a re-enabled product whose brand is disabled **is fully visible, searchable and orderable** on
the storefront. Disabling a brand only removes it from the filter dropdowns (`listBrands` with
`includeDisabled = false`) and from the home page's family strip.

⇒ There is nothing to cascade-block. **Owner decision: warn only, and do not change storefront
visibility.**

### 4. Load-bearing bug this set must fix first: the admin/public taxonomy caches collide.

`lib/query-keys.ts` carries this comment:

```ts
// `.all()` on each of these three exists so a create/update mutation can invalidate every
// variant (public + admin) in one call — the two are separate cache entries (`admin` is
// part of the key), not a filtered view of the same query.
brands:   { list: (admin = false) => ["catalog", "brands", admin] },   // ✅ true
families: { list: (query?: unknown) => ["catalog", "families", query] },  // ❌ no `admin`
models:   { list: (query?: unknown) => ["catalog", "models", query] },    // ❌ no `admin`
```

The comment is **wrong for families and models**. Concretely:

| Caller | Key produced |
|---|---|
| Storefront `useCatalogFamilies()` (enabled-only) | `["catalog","families",{}]` |
| Settings Hierarchy `useCatalogFamilies({}, true)` (includes disabled) | `["catalog","families",{}]` |

Same key, two different response sets — whichever query mounts first populates the cache. If a
visitor browses `/products` first, the admin opening Settings sees **no disabled families at all**
until a refetch, which silently breaks the whole feature this set delivers. Same collision for
models between `/products` and `/admin/products` when `brandId` matches.

⇒ Fix this **before** the UI work (Part C), or the re-enable feature is intermittently invisible.

---

## Owner decisions taken before planning — do not re-open

| # | Question | Resolution |
|---|---|---|
| **UI placement** | Where does re-enable live? | **Enable button on the existing `Settings → Hierarchy` tab** for families/brands/models (the rows are already there), **plus a new `Settings → Disabled products` tab** for products, which have no home today. No duplicated taxonomy list. |
| **Q3** | Filter param or new endpoints? | **Admin-only status filter on the existing `GET /admin/products`**, driven by a contract enum. One code path, one DTO, one permission check. |
| **Q5** | Cascade on re-enable? | **No block — warn only.** Re-enable always succeeds; if the product's family or brand is still disabled, surface an inline warning. **Do not add taxonomy join filters to the storefront query** — customer-visible behavior is unchanged by this set. |

---

# Actions

Ordered by dependency. Part C must precede Parts D and E.

## Part A — Contract (`Apps/contract`)

### A1 — `src/modules/catalog/catalog.enums.ts`

Append (lowercase values, matching `StockStatus`/`ProductSort` convention in the same file):

```ts
// S21 — admin-only visibility filter for the product list. Disabled products are otherwise
// unreachable: `/admin/products` can disable a row but never list it again. `ENABLED` is the
// default so every existing caller keeps today's behavior.
export enum ProductEnabledFilter {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ALL = 'all',
}
```

### A2 — `src/modules/catalog/catalog.query.ts`

Add `ProductEnabledFilter` to the existing `./catalog.enums` import, and add one field to
`ProductListQuerySchema` (place it directly after `inStock`):

```ts
  // S21 — honoured by `listAdminProducts` ONLY. The public `listProducts` and the staff
  // `listStaffProducts` both pin their own enabled predicate and ignore this field, so a guest
  // sending `?enabledStatus=disabled` still gets enabled+published rows only. Defaulted rather
  // than optional so the service never has to re-state the fallback.
  enabledStatus: z.enum(ProductEnabledFilter).default(ProductEnabledFilter.ENABLED),
```

⚠️ **This widens the shared `ProductListQuery` type used by all three product routes.** That is
already the file's convention — `featured` is public-only and `ids` was added for the storefront;
both are ignored by `staffAdminWhere`. The executor must **not** wire `enabledStatus` into
`listProducts`.

### A3 — `src/modules/catalog/catalog.dtos.ts`

`AdminProductResponseSchema`'s `family` and `brand` objects gain `isEnabled`, so the new tab can
warn about a disabled parent without cross-referencing a second query:

```ts
  family: z.object({ id: z.uuid(), name: z.string(), isEnabled: z.boolean() }),
  brand: z.object({ id: z.uuid(), name: z.string(), isEnabled: z.boolean() }),
```

Extend the schema's existing block comment with:

```
// S21 — `family.isEnabled`/`brand.isEnabled`: re-enabling a product whose family or brand is still
// disabled is allowed (owner decision Q5 — a disabled family does NOT hide its products, since the
// storefront query filters on the product only), but the admin is warned that the parent will not
// appear in the storefront's filter dropdowns. Carrying the flags here keeps that warning correct
// wherever an AdminProductDto is rendered.
```

**Do not touch** `ProductWithPricingResponseSchema` or `StaffProductResponseSchema` — the public and
staff DTOs must not start advertising taxonomy state.

## Part B — Backend (`Apps/api/src/modules/catalog`)

### B1 — `catalog.mapper.ts`

`toAdminProductDto` (line ~129) — supply the two new fields. `PRODUCT_INCLUDE` already loads
`brand: true, family: true`, and the mapper's `ProductWithRelations` types them as full `Brand`/
`Family` rows, so `isEnabled` is already in hand:

```ts
      family: { id: product.family.id, name: product.family.name, isEnabled: product.family.isEnabled },
      brand: { id: product.brand.id, name: product.brand.name, isEnabled: product.brand.isEnabled },
```

`AdminProductResponseSchema.parse(dto)` at the end of the method makes this mandatory — omitting it
throws at runtime, not compile time. Leave `toProductWithPricingDto` and `toStaffProductDto` alone.

### B2 — `catalog.service.ts` — new private helper

Add `ProductEnabledFilter` to the value imports from `@dragon-telecom/contract`. Add this private
method on `CatalogProductService`, directly above `staffAdminWhere`:

```ts
  // S21 — translates the admin visibility filter into a Prisma predicate. `ALL` contributes no
  // clause at all, which is what lets the Settings tab and the main products list share one query
  // path (owner decision Q3).
  private enabledWhere(filter: ProductEnabledFilter): Prisma.ProductWhereInput {
    switch (filter) {
      case ProductEnabledFilter.ALL:
        return {};
      case ProductEnabledFilter.DISABLED:
        return { isEnabled: false };
      case ProductEnabledFilter.ENABLED:
      default:
        return { isEnabled: true };
    }
  }
```

### B3 — `catalog.service.ts` — `staffAdminWhere` signature

Replace the `extra` parameter with an explicit filter, and delete the hardcoded flag. The `extra`
parameter had exactly one caller passing exactly one key (`{ isEnabled: true }`), and the
`...extra`-then-`isEnabled: true` ordering meant it never did anything — drop it rather than
carry a dead escape hatch.

```ts
  private staffAdminWhere(
    query: ProductListQuery,
    enabledFilter: ProductEnabledFilter,
  ): Prisma.ProductWhereInput {
    …tokens / nameSearch unchanged…
    return {
      // S21 — the enabled predicate is now the caller's decision, not a constant. It used to be a
      // hardcoded `isEnabled: true` placed *after* the spread of an `extra` argument, which made
      // that argument dead and made disabled products permanently unlistable.
      ...this.enabledWhere(enabledFilter),
      ...(query.search ? { OR: [ … ] } : {}),
      …ids / familyId / brandId / modelId unchanged…
    };
  }
```

Keep the existing `S1 finding F1` barcode-index comment and the `S17 ids` comment verbatim.

### B4 — `catalog.service.ts` — `listStaffProducts` (line ~527)

```ts
    // Staff never see disabled products, whatever the client sends — the enabledStatus filter is
    // an admin affordance (S21). This used to pass `{ isEnabled: true }` as `extra`, which the old
    // hardcoded flag overrode anyway.
    const where = this.staffAdminWhere(query, ProductEnabledFilter.ENABLED);
```

### B5 — `catalog.service.ts` — `listAdminProducts` (line ~560)

```ts
    const where = this.staffAdminWhere(query, query.enabledStatus);
```
`enabledStatus` is `.default(ENABLED)` in the schema, so it is always defined — no `??` fallback.

### B6 — Explicitly **not** changed

- `listProducts` (public storefront) keeps `isEnabled: true, isPublished: true` hardcoded and must
  **not** read `query.enabledStatus`. Confirm by reading it; change nothing.
- No taxonomy join filter is added anywhere (owner decision Q5).
- No route, controller, permission or `catalog.routes.ts` change — `GET /admin/products` is already
  `adminOnly` and already validates against `ProductListQuerySchema`, so the new param is covered.
- **Known pre-existing inconsistency, do not fix here:** `productStats()` counts *all* products
  with no `where` clause, so the stat cards on `/admin/products` have always included disabled
  rows while the table below them excluded them. Out of scope; flag it in the report.

## Part C — Frontend cache keys (`Apps/web`) — do this before D and E

### C1 — `src/lib/query-keys.ts`

Bring `families` and `models` in line with `brands`, so the admin (includes-disabled) and public
(enabled-only) variants stop sharing a cache entry:

```ts
    families: {
      all: () => ["catalog", "families"] as const,
      list: (query?: unknown, admin = false) => ["catalog", "families", query, admin] as const,
    },
    models: {
      all: () => ["catalog", "models"] as const,
      list: (query?: unknown, admin = false) => ["catalog", "models", query, admin] as const,
    },
```

Fix the block comment above them, which currently asserts something untrue of two of the three:

```ts
    // `.all()` on each of these three exists so a create/update mutation can invalidate every
    // variant (public + admin) in one call — the two really are separate cache entries, because
    // `admin` is part of every `list(...)` key. S21 added it to `families` and `models`, which had
    // been omitting it: the storefront's enabled-only list and Settings' includes-disabled list
    // were colliding on one key, so whichever mounted first decided what the other saw.
```

### C2 — `src/hooks/useCatalogTaxonomy.ts`

Pass `admin` through to the key in both hooks (call sites are unchanged — the hooks already take
`admin`):

```ts
export function useCatalogFamilies(query: FamiliesQuery = {}, admin = false) {
  return useQuery({
    queryKey: qk.catalog.families.list(query, admin),
    queryFn: () => catalogService.listFamilies(query, admin),
  });
}
```
```ts
export function useCatalogModels(query: ModelsQuery = {}, admin = false, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.models.list(query, admin),
    queryFn: () => catalogService.listModels(query, admin),
    enabled: options?.enabled,
  });
}
```

No invalidation call changes: every mutation invalidates `qk.catalog.families.all()` /
`qk.catalog.models.all()`, which is the bare `["catalog","families"]` prefix and still matches both
variants.

## Part D — Re-enable in the existing Hierarchy tab

### D1 — `src/pages/admin/settings/components/hierarchy-panel.tsx`

**D1.1 — Props.** Add three, beside the existing disable trio:

```ts
  /** S21 — the row is already rendered with a "Disabled" badge; this is the way back. */
  onEnableFamily: (id: string) => void;
  onEnableBrand: (id: string) => void;
  onEnableModel: (id: string) => void;
```

**D1.2 — Each of the three row renderers** (families ~line 96, brands ~142, models ~223) swaps the
permanently-greyed Disable button for a single button that flips with the row's state. Families:

```tsx
                  <div className="flex items-center gap-2">
                    <EnabledBadge isEnabled={family.isEnabled} />
                    {family.isEnabled ? (
                      <Button variant="ghost" size="sm" onClick={() => onDisableFamily(family.id)}>
                        {t("common.actions.disable")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onEnableFamily(family.id)}>
                        {t("common.actions.enable")}
                      </Button>
                    )}
                  </div>
```
Brands and models are identical with their own ids and handlers. `common.actions.enable`
("Enable" / "Activer") **already exists** — do not add it.

**D1.3 — Update the helper line** at the top of the panel. `admin.settings.hierarchy.disableOnly`
currently reads "Models/brands/families are disabled, not deleted, to keep product references
intact" — still true, but now half the story. Change the key's copy (Part F) to mention that
disabled rows can be re-enabled here.

**D1.4 — Update the component's header comment** (lines 32-36), which describes the panel as
implementing "the disable-only convention". Append: `S21 — rows can now be re-enabled from here
too; the list has always included disabled rows (the admin taxonomy routes pass includeDisabled).`

### D2 — `src/pages/admin/settings/AdminSettings.tsx`

Add three handlers mirroring `handleDisableFamily`/`Brand`/`Model` (lines ~248-264) exactly, with
`isEnabled: true` and the new success key:

```ts
  const handleEnableFamily = (id: string) => {
    updateFamily.mutate(
      { id, command: { isEnabled: true } },
      {
        onSuccess: (family) => {
          toast.success(t("admin.settings.hierarchy.enableSuccess"));
          // Q5 — warn only, never block. A disabled parent does not hide anything (the storefront
          // filters on the product row alone), but the child family will not surface under it in
          // the family pickers until the parent is back.
          const parent = family.parentId
            ? (families.data ?? []).find((f) => f.id === family.parentId)
            : undefined;
          if (parent && !parent.isEnabled) {
            toast.warning(t("admin.settings.hierarchy.parentStillDisabled", { name: parent.name }));
          }
        },
      },
    );
  };
```
`handleEnableBrand` and `handleEnableModel` are the plain two-line versions (no parent concept —
`BrandDto` and `DeviceModelDto` have no parent), just the mutation plus the success toast.

Wire all three into `<HierarchyPanel …>` alongside the existing `onDisable*` props.

`useUpdateCatalogFamily`/`Brand`/`Model` already invalidate `qk.catalog.<entity>.all()`, so after
C1 the re-enabled row reappears in every picker and on the storefront without extra work.

## Part E — New "Disabled products" Settings tab

### E1 — New `src/pages/admin/settings/components/disabled-products-panel.tsx`

Dumb, props-only — same shape as `hierarchy-panel.tsx` (the page owns the queries and mutations).

```tsx
interface DisabledProductsPanelProps {
  products: AdminProductDto[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEnable: (product: AdminProductDto) => void;
  /** True while any re-enable mutation is in flight — disables every row's button. */
  isEnabling?: boolean;
}
```

Render:
- `isLoading` → `<TableSkeleton rows={5} columns={3} />` (same import Hierarchy uses).
- empty → `<EmptyState icon={<PackageX className="h-6 w-6" />} title={t("admin.settings.disabledProducts.empty")} body="" />`.
- otherwise a `<Card>` whose `CardContent` lists one bordered row per product, mirroring
  `hierarchy-panel.tsx`'s row markup (`flex items-center justify-between rounded-md border p-2
  text-sm`):
  - left: product **name**, and under it a muted line with `barcode ?? "—"` and
    `family.name / brand.name` (+ ` / model.name` when present);
  - right: a warning chip when `!product.family.isEnabled || !product.brand.isEnabled`, then the
    Enable button.
- The warning chip (Q5) — inline, before the button:
  ```tsx
  {(!product.family.isEnabled || !product.brand.isEnabled) && (
    <span className="text-xs text-muted-foreground">
      {t("admin.settings.disabledProducts.parentDisabled", {
        names: [
          !product.family.isEnabled ? product.family.name : null,
          !product.brand.isEnabled ? product.brand.name : null,
        ].filter(Boolean).join(", "),
      })}
    </span>
  )}
  ```
- a helper line at the top of the panel: `t("admin.settings.disabledProducts.helper")`.
- `<SimplePagination page={page} totalPages={totalPages} onPageChange={onPageChange} />` below the
  list, guarded by `totalPages > 1` (same guard every other list page uses).

Header comment to include:
```
// S21 — products disabled from /admin/products' per-row Enabled switch used to be unreachable:
// listAdminProducts pinned `isEnabled: true`, so a disabled row vanished for good. This panel is
// the way back, driven by the admin-only `enabledStatus=disabled` filter. Families/brands/models
// are NOT listed here — they already live in the Hierarchy tab, which now offers Enable too.
```

### E2 — `src/pages/admin/settings/AdminSettings.tsx`

**E2.1 — Imports:** `DisabledProductsPanel`; `useAdminCatalogProducts` and `useUpdateProduct` from
`@/hooks/useCatalogProducts`; `ProductEnabledFilter` and `type AdminProductDto` from
`@dragon-telecom/contract`; a `PackageX` icon from `lucide-react` for the tab trigger.

**E2.2 — Query + page state**, next to the existing `families`/`brands`/`models` queries (~line 90):

```ts
  // S21 — the disabled-products list is its own paginated query; `enabledStatus` is part of the
  // ProductListQuery, so `qk.catalog.adminProducts.list(query)` already gives it a cache entry
  // distinct from /admin/products' own enabled-only list. No new query key is needed.
  const [disabledPage, setDisabledPage] = useState(1);
  const disabledProducts = useAdminCatalogProducts({
    enabledStatus: ProductEnabledFilter.DISABLED,
    page: disabledPage,
    limit: 15,
  });
  const updateProduct = useUpdateProduct();
```

**E2.3 — Handler** with the Q5 warning:

```ts
  const handleEnableProduct = (product: AdminProductDto) => {
    updateProduct.mutate(
      { id: product.id, command: { isEnabled: true } },
      {
        onSuccess: () => {
          toast.success(t("admin.settings.disabledProducts.enableSuccess"));
          // Q5 — warn only. The product is live on the storefront immediately regardless; the
          // parent merely stays out of the filter dropdowns until it is re-enabled too.
          const stillDisabled = [
            !product.family.isEnabled ? product.family.name : null,
            !product.brand.isEnabled ? product.brand.name : null,
          ].filter(Boolean);
          if (stillDisabled.length > 0) {
            toast.warning(
              t("admin.settings.disabledProducts.parentDisabledToast", {
                names: stillDisabled.join(", "),
              }),
            );
          }
        },
      },
    );
  };
```
`useUpdateProduct` already invalidates `qk.catalog.adminProducts.all()` and
`qk.catalog.products.all()`, so the row leaves this list and the product reappears on the storefront
without further wiring.

**E2.4 — Tab trigger.** Add after the `hierarchy` trigger, and **bump both column counts** on the
`TabsList` (`lg:grid-cols-7` → `lg:grid-cols-8`, `lg:grid-cols-6` → `lg:grid-cols-7`):

```tsx
          <TabsTrigger value="disabled-products" className="flex items-center gap-2">
            <PackageX className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.disabledProducts")}</span>
          </TabsTrigger>
```

**E2.5 — Tab content**, after the `hierarchy` `TabsContent`:

```tsx
        <TabsContent value="disabled-products">
          <DisabledProductsPanel
            products={disabledProducts.data?.items ?? []}
            isLoading={disabledProducts.isLoading}
            page={disabledProducts.data?.meta.page ?? 1}
            totalPages={disabledProducts.data?.meta.totalPages ?? 1}
            onPageChange={setDisabledPage}
            onEnable={handleEnableProduct}
            isEnabling={updateProduct.isPending}
          />
        </TabsContent>
```

**E2.6 — Update the page header comment** (~line 67), which enumerates the tabs and their hooks, to
include the new tab and `useAdminCatalogProducts`.

## Part F — Translations (`src/config/translations.json`)

Flat keys, `{ en, fr, ar }`, `ar` stays `""`.

| Key | en | fr |
|---|---|---|
| `admin.settings.tabs.disabledProducts` | `Disabled products` | `Produits désactivés` |
| `admin.settings.disabledProducts.helper` | `Products disabled from the products page. Re-enable one to put it back in the catalog.` | `Produits désactivés depuis la page produits. Réactivez-en un pour le remettre au catalogue.` |
| `admin.settings.disabledProducts.empty` | `No disabled products` | `Aucun produit désactivé` |
| `admin.settings.disabledProducts.enableSuccess` | `Product enabled` | `Produit activé` |
| `admin.settings.disabledProducts.parentDisabled` | `{names} still disabled` | `{names} toujours désactivé` |
| `admin.settings.disabledProducts.parentDisabledToast` | `The product is back in the catalog, but {names} is still disabled and won't appear in the storefront filters.` | `Le produit est de retour au catalogue, mais {names} est toujours désactivé et n'apparaîtra pas dans les filtres de la vitrine.` |
| `admin.settings.disabledProducts.table.taxonomy` | `Family / brand` | `Famille / marque` |
| `admin.settings.hierarchy.enableSuccess` | `Enabled successfully` | `Activé avec succès` |
| `admin.settings.hierarchy.parentStillDisabled` | `Its parent family {name} is still disabled.` | `Sa famille parente {name} est toujours désactivée.` |

**Reuse, do not duplicate:** `common.actions.enable`, `common.actions.disable`,
`common.status.enabled`, `common.status.disabled`, `admin.productsList.table.barcode`,
`admin.productsList.table.product`.

**Change one existing value** (D1.3) — `admin.settings.hierarchy.disableOnly`:
- en: `Models/brands/families are disabled, not deleted, to keep product references intact — re-enable them here at any time.`
- fr: `Les modèles/marques/familles sont désactivés, pas supprimés, afin de conserver les références produit — réactivez-les ici à tout moment.`

`{names}` / `{name}` are interpolated by `lib/i18n.ts#interpolate`; pass them as
`t(key, { names })`.

---

## Validation

Compile and lint only. **Do not modify any test file, and do not run any test suite.**

```
cd Apps/contract && npm run check && npm run lint
cd Apps/api     && npx tsc --noEmit && npx eslint src/modules/catalog --no-color
cd Apps/web     && npm run check && npm run lint
```

Documented baselines — confirm these do not grow, and that no new error names a file from this set:
- `Apps/api` `tsc`: `src/**` must be **clean**; `test/**` carries ~228 lines of pre-existing
  fixture drift on clean `HEAD` (billing/orders/repairs/statistics). `catalog.mapper.spec.ts` is
  already among the broken files (it asserts a long-renamed `dto.averageCost`), and its
  `toAdminProductDto` cases use **field-level** assertions on `quantityOnHand`/`stockStatus`/etc.
  with `buildFamily()`/`buildBrand()` fixtures that are full Prisma rows — so **A3/B1's added
  `family.isEnabled`/`brand.isEnabled` break nothing there**. Verified before planning.
- `Apps/api` `eslint src/modules/catalog`: one pre-existing error (`PRODUCT_UPLOAD_DIR` unused in
  `catalog.routes.ts`). Do not fix it here.
- `Apps/web` `tsc -p tsconfig.test.json`: 47 pre-existing errors on clean `HEAD`, none in catalog.
- `Apps/web` `eslint .`: large pre-existing `prettier/prettier` backlog in legacy files. Lint the
  touched files specifically and require them clean:

```
npx eslint \
  src/lib/query-keys.ts \
  src/hooks/useCatalogTaxonomy.ts \
  src/pages/admin/settings/AdminSettings.tsx \
  src/pages/admin/settings/components/hierarchy-panel.tsx \
  src/pages/admin/settings/components/disabled-products-panel.tsx
```

Grep checks after Part B:
```
grep -n "isEnabled: true" Apps/api/src/modules/catalog/catalog.service.ts
```
Expect exactly **one** remaining hit — inside `listProducts` (the public storefront rule). If
`staffAdminWhere` still shows one, B3 was not applied.

---

## Manual verification checklist (browser)

Prepare, as ADMIN: at least 3 products, 2 families (one nested under another), 2 brands, 1 model.

**Setup — make things disappear**

1. `/admin/products` → toggle **Enabled** off on one product. It vanishes from the table
   immediately. Confirm it is also gone from the storefront `/products` and from staff
   `/staff/products`. (This is the bug: before S21 it was gone for good.)
2. `/admin/settings` → **Hierarchy** → **Disable** one family, one brand and one model. Each row
   stays visible with a grey **Disabled** badge, and its button flips to **Enable**.
3. Confirm each disabled family/brand has left the storefront filter dropdowns on `/products`, and
   the disabled family is gone from the home page family strip.

**Cache-collision regression (Part C — the subtle one)**

4. In a fresh tab, load the **storefront** `/products` first (populating the public taxonomy cache),
   then — without reloading — navigate to `/admin/settings` → **Hierarchy**. The disabled family and
   brand **must still be listed** with their Disabled badges. Before S21 this could show only
   enabled rows, because both lists shared one cache key.
5. Do the reverse: open Settings → Hierarchy first, then navigate to `/products`. The storefront's
   Family and Brand dropdowns must **not** offer the disabled entries.

**Re-enable — taxonomy**

6. Settings → Hierarchy → click **Enable** on the disabled brand → "Enabled successfully", the badge
   flips to Enabled and the button flips back to Disable.
7. Without reloading, go to `/products` → the brand is back in the Brand filter dropdown.
8. Re-enable the **child** family while its **parent** family is still disabled → it enables, and a
   second warning toast names the parent. Nothing is blocked.
9. Re-enable the model → badge flips; it reappears in the model dropdown on `/admin/products` once a
   brand is selected.

**Re-enable — products (the new tab)**

10. `/admin/settings` → the tab bar now shows **Disabled products**. Open it → the product from
    step 1 is listed with its name, barcode and family/brand line.
11. If its family or brand is still disabled, the row shows a small "… still disabled" note beside
    the Enable button.
12. Click **Enable** → "Product enabled" toast, and (only if a parent is still disabled) a second
    warning toast explaining the product is live but the parent won't appear in storefront filters.
13. The row **leaves the list immediately** (no manual refresh).
14. Go to `/admin/products` → the product is back in the table with its Enabled switch on. Go to
    `/products` → it is visible in the catalog again, and openable.
15. Re-enable the last disabled product → the tab shows the **empty state** ("No disabled products").
16. Disable 16+ products, reopen the tab → pagination appears and page 2 works.

**Nothing else changed**

17. `/admin/products` still lists **enabled products only** by default — the new `enabledStatus`
    filter must not leak into that page's behavior.
18. `/staff/products` still lists enabled products only. Try appending `?enabledStatus=disabled` to
    the staff URL by hand → the list is unchanged (staff pin their own filter server-side).
19. Append `?enabledStatus=disabled` to the public `/products` URL by hand → the storefront is
    unchanged and no disabled product ever appears. **This is the security-relevant check.**
20. Settings' other tabs (Categories, Delivery, Store, Invoicing, Hierarchy, Storefront) still load
    and save exactly as before, and the tab bar lays out correctly at desktop and mobile widths with
    the extra tab.
