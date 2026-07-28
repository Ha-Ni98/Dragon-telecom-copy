# Plan — Set 17: Users, roles & settings

Source: `Docs/Stage-04-Fixes/app-issues-01.md` §S17.
Branch: `stage-04-fix`. Validation: `tsc --noEmit` + lint only (**D12** — no test file is read,
edited or run; act as if `Apps/api/test/**` and `Apps/web/tests/**` do not exist).

---

## 0. Preconditions and what is already done

### 0.1 Sets that must have landed first

| Set | Why S17 needs it | Status |
|---|---|---|
| **S2** | RC-1 rebuilt `components/shared/autocomplete-input.tsx` so the input displays the option's **label**, never its id. S17's featured-product picker is built on that primitive — it must not hand-roll a new one. | done (`report-S02.md`) |
| **S15** | Added `storefront.featuredFamilyIds` to `SettingsResponseSchema`, `StorefrontSettingsInputSchema` (with `.max(6)`), `PublicSettingsResponseSchema`, `prisma/settings-defaults.ts` and the field-wise merge in `platform.mapper.ts#toSettingsDto`. The home page already reads it. **S15 explicitly deferred the picker to S17.** | done (`report-S15.md`) |

### 0.2 Already true in the code — do **not** re-implement

Verified by reading the files, not assumed:

1. **`UpdateUserSchema` already carries `password: z.string().min(8).optional()`**
   (`Apps/contract/src/modules/identity/identity.command.ts`), and
   `identity.service.ts#updateUser` (~line 302-321) already hashes it with Argon2id and sets
   `shouldRevokeTokens = cmd.isEnabled === false || cmd.password !== undefined`.
   **S17 adds no contract field and no backend behavior for the password change** — it is a
   frontend-only surface on top of an endpoint that already works.
   `Apps/web/src/pages/admin/users/components/user.schema.ts#updateUserSchema` even declares the
   field already; nothing renders it.
2. **`StorefrontSettingsInputSchema.featuredFamilyIds` is already bounded server-side**
   (`.max(6)`, `platform.command.ts`) with a comment naming S17 as the owner of the UI bound.
   S17 enforces the same 6 in the picker; it does **not** change the contract.
3. **`platform.service.ts#updateSettings`** already merges a partial `storefront` section
   field-wise via `mergeDefined`, so a PATCH carrying both arrays is safe.

### 0.3 Owner decision taken while planning (settled — do not re-open)

**Password change lives in its own dialog**, opened from a per-row key icon in the users table —
not as an extra section inside the edit-user dialog. Rationale: it mirrors the existing
`pages/admin/clients/components/reset-password-dialog.tsx` precedent, and it keeps the
profile/roles PATCH free of a password field that a half-typed value could ride along with.

---

## 1. Findings that shape the plan

**F1 — the featured-products picker's real defect is name resolution, not the input.**
`AdminSettings.tsx` builds `productNameById` from `useAdminCatalogProducts({ page: 1, limit: 100 })`
— one page of 100. A featured product outside that page has no label, so its chip renders its raw
**uuid** (the file's own comment at ~line 96 admits this), and it can never be found in the picker
either, because the list is not searched server-side. Fixing the input alone would not fix the
symptom. The rebuild therefore needs **two** queries: a search-driven one for the options and an
`ids`-driven one to resolve the chips.

**F2 — `ids` exists in the contract but only the public product list honours it.**
`ProductListQuerySchema.ids` (comma-separated uuids, added by S15) is read by
`catalog.service.ts#listProducts` (~line 403) but **not** by `staffAdminWhere` (~line 904), which
is what `listAdminProducts` uses. Settings is an admin surface and needs admin rows, so
`staffAdminWhere` must learn `ids`. This is a three-line backend change, not a new endpoint.

**F3 — the Storefront tab's Save button is a lie.** `handleSaveStorefront` in `AdminSettings.tsx`
only fires `toast.success(...)`; the actual writes happen in `handleAddFeatured`/
`handleRemoveFeatured`, one PATCH per chip. With a second list (families) arriving, S17 converts
the tab to **draft state + one real Save**, which also makes the existing button honest.

**F4 — `useAdminCatalogProducts` has no `enabled` option** (`hooks/useCatalogProducts.ts:47`),
unlike its sibling `useCatalogProducts`. The chip-resolution query must not fire with an empty
`ids` string, so the option has to be added.

**F5 — `AutocompleteInput` filters `suggestions` locally by `inputText`.** With server-side search
this is harmless for name matches (the returned label contains the typed text), but a **barcode**
query would be filtered out client-side even though the server matched it. Accepted limitation:
the settings picker is a by-name picker. Do not disable the local filter — other consumers rely
on it.

**F6 — families are already fetched on this page.** `AdminSettings.tsx` line ~81 holds
`useCatalogFamilies({}, true)` for the Hierarchy tab. The families picker reuses that query; it
adds no new request.

---

## 2. Action list (execute in this order)

### Action 1 — `Apps/api/src/modules/catalog/catalog.service.ts`

In the private `staffAdminWhere(query, extra)` (~line 904), add the `ids` clause immediately after
the `search` clause, matching `listProducts`'s own line exactly:

```ts
      // S17 — same comma-separated `ids` filter the public list already honours (S15); the
      // Settings featured-products picker resolves its saved ids to admin rows through this.
      ...(query.ids ? { id: { in: query.ids.split(',') } } : {}),
```

No other backend change. `listStaffProducts` inherits it harmlessly; `ProductListQuerySchema`
already validates the shape at the boundary, so the split is safe.

### Action 2 — `Apps/web/src/hooks/useCatalogProducts.ts`

Give `useAdminCatalogProducts` the same optional third argument its public sibling has (F4):

```ts
export function useAdminCatalogProducts(query: ProductListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.catalog.adminProducts.list(query),
    queryFn: () => catalogService.listAdminProducts(query),
    enabled: options?.enabled,
  });
}
```

Query key unchanged (`qk.catalog.adminProducts.list(query)`) — the query object already varies by
`search`/`ids`, so each variant gets its own cache entry. Every existing caller
(`AdminProducts.tsx`, `AdminSettings.tsx`, `AdminInventory.tsx`, `StaffOrders.tsx` via
`useAdminCatalogProduct`) passes one argument and is unaffected (`enabled: undefined` = enabled).

### Action 3 — new file `Apps/web/src/pages/admin/users/components/change-user-password.schema.ts`

Model it on `pages/admin/clients/components/reset-client-password.schema.ts`, but with the **8**
character minimum the contract enforces (`UpdateUserSchema.password` is `.min(8)`; the client
schema's 6 is a different command — do not copy that number).

```ts
import { z } from "zod";
import type { UpdateUserCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// S17 — the password change is a plain UpdateUserCommand carrying only `password`; the backend
// already hashes it (Argon2id) and revokes the user's refresh tokens (identity.service.ts
// #updateUser). `confirmPassword` is client-side only, stripped before the command is sent —
// same pattern as reset-client-password.schema.ts.
export function changeUserPasswordSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      password: z.string().min(8, t("admin.users.changePassword.minLength")),
      confirmPassword: z.string().min(1, t("admin.users.changePassword.confirmRequired")),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("register.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type ChangeUserPasswordFormValues = z.infer<ReturnType<typeof changeUserPasswordSchema>>;

type AssertAssignable<T extends true> = T;
type _ChangeUserPasswordCommandCheck = AssertAssignable<
  Omit<ChangeUserPasswordFormValues, "confirmPassword"> extends UpdateUserCommand ? true : false
>;
```

`register.passwordMismatch` is reused deliberately — it already exists and says exactly this
(the same reuse `reset-client-password.schema.ts` makes).

### Action 4 — new file `Apps/web/src/pages/admin/users/components/change-password-dialog.tsx`

Copy the structure of `pages/admin/clients/components/reset-password-dialog.tsx` (`Dialog` +
warning `Alert` + `Form`/`FormField` + Cancel/Save footer). Props:

```ts
interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;                                  // shown in the title
  onSave: (values: ChangeUserPasswordFormValues) => void;
  isSaving?: boolean;
}
```

Requirements:
- Title: `t("admin.users.changePassword.title")` + the `username` when present, with the
  `KeyRound` icon (same as the client dialog).
- Warning `Alert` with `AlertTriangle` + `t("admin.users.changePassword.warning")` — the change
  signs the user out everywhere, which is true (`shouldRevokeTokens`).
- Two `<Input type="password">` fields bound to `password` and `confirmPassword` through
  `<FormField>`; labels `admin.users.changePassword.newPassword` /
  `admin.users.changePassword.confirmPassword`. **No current-password field** (§S17: "new and
  confirm only").
- Footer: `common.cancel` (variant `outline`, closes without saving) and a submit button showing
  `common.saving` / `common.save`.
- The component is dumb — no hook calls, no toast; the page wires it.

### Action 5 — `Apps/web/src/pages/admin/users/components/users-table.tsx`

Add an optional prop and a second action button in the existing trailing actions column
(`header: ""`, ~line 69), to the left of the current Edit button:

```ts
  onChangePassword?: (user: UserDto) => void;
```

```tsx
  {onChangePassword && (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("admin.users.changePassword.action")}
      title={t("admin.users.changePassword.action")}
      onClick={(e) => {
        e.stopPropagation();
        onChangePassword(row.original);
      }}
    >
      <KeyRound className="h-4 w-4" />
    </Button>
  )}
```

- Import `KeyRound` from `lucide-react`.
- Add `onChangePassword` to the `useMemo` dependency array alongside `t`, `language`, `onEdit`.
- `stopPropagation` matters: the **mobile** row renderer (~line 81) wraps the whole row in a
  `<button onClick={() => onEdit(user)}>`. In the mobile branch, render the key affordance as its
  own sibling button **outside** that wrapper, not nested (a nested `<button>` is invalid HTML and
  React will warn). Keep the desktop column as described above.
- The `TableSkeleton` call at ~line 92 keeps `columns={7}` — the actions column is unchanged in
  count, only its contents grow.

### Action 6 — `Apps/web/src/pages/admin/users/AdminUsers.tsx`

1. New state: `const [passwordUser, setPasswordUser] = useState<UserDto | null>(null);`
2. Pass `onChangePassword={setPasswordUser}` to `<UsersTable>`.
3. New handler, reusing the **existing** `updateUser` mutation (no new hook, no new service
   function):

```tsx
  const handleChangePassword = (values: ChangeUserPasswordFormValues) => {
    if (!passwordUser) return;
    updateUser.mutate(
      { id: passwordUser.id, command: { password: values.password } },
      {
        onSuccess: () => {
          toast.success(t("admin.users.changePassword.success"));
          setPasswordUser(null);
        },
      },
    );
  };
```

   Note `confirmPassword` is **not** forwarded — only `password` crosses the wire.
4. Render below the existing `<RoleDialog>`:

```tsx
      <ChangePasswordDialog
        key={`password-${passwordUser?.id ?? "none"}`}
        open={!!passwordUser}
        onOpenChange={(open) => !open && setPasswordUser(null)}
        username={passwordUser?.username}
        onSave={handleChangePassword}
        isSaving={updateUser.isPending}
      />
```

   The `key` forces a fresh form per user, matching the `key={\`user-${...}\`}` convention already
   used for `UserDialog`/`RoleDialog` on this page.
5. Update the file's header comment: it currently describes only the two tables and their
   pagination call. Add one sentence naming the password dialog and the fact that it reuses
   `useUpdateUser` because `UpdateUserCommand.password` already exists.

### Action 7 — `Apps/web/src/pages/admin/settings/components/storefront-settings.tsx` (rebuild)

Replace the file wholesale. New prop contract — the component stays dumb (draft state lives in
the page, so Save can send both arrays in one PATCH):

```ts
interface FeaturedEntity {
  id: string;
  name: string;
}

interface StorefrontSettingsProps {
  featuredProducts: FeaturedEntity[];
  productOptions: AutocompleteOption[];
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  isProductSearchLoading?: boolean;
  onAddProduct: (productId: string) => void;
  onRemoveProduct: (productId: string) => void;

  featuredFamilies: FeaturedEntity[];
  familyOptions: AutocompleteOption[];
  onAddFamily: (familyId: string) => void;
  onRemoveFamily: (familyId: string) => void;

  isDirty: boolean;
  onSave: () => void;
  isSaving?: boolean;
}
```

Layout, top to bottom:

1. The existing delivery-companies `Alert` — **keep it** (`admin.settings.storefront.deliveryCompaniesNote`).
2. **Featured products** section:
   - Heading `admin.settings.storefront.featuredProducts`, helper `<p className="text-sm
     text-muted-foreground">` with `admin.settings.storefront.featuredProductsHelp`.
   - `<AutocompleteInput>` with:
     `value=""` (the picker never holds a selection — each pick becomes a chip),
     `onChange={(v) => { if (v) onAddProduct(v); }}`,
     `suggestions={productOptions}`,
     `onSearch={onProductSearchChange}`,
     `isLoading={isProductSearchLoading}`,
     `placeholder={t("admin.settings.storefront.searchProductsPlaceholder")}`,
     `emptyMessage={t("common.noResults")}`,
     `inputId="storefront-featured-products"`,
     `disabled={isSaving}`.
     **No `onCreateNew`** — the create-new row is then hidden automatically (S6/I11 behavior).
   - Chips: the existing `Badge variant="secondary"` list, each with an `X` button whose
     `aria-label` is `t("admin.settings.storefront.removeProduct")`. When the list is empty render
     `t("admin.settings.storefront.noProductSelected")` in muted text instead of an empty row.
3. **Featured families** section, same shape:
   - Heading `admin.settings.storefront.featuredFamilies`, helper
     `admin.settings.storefront.featuredFamiliesHelp` ("Choose up to 6 families…").
   - `<AutocompleteInput>` with `inputId="storefront-featured-families"`, `suggestions={familyOptions}`,
     `placeholder={t("admin.settings.storefront.searchFamiliesPlaceholder")}`, no `onSearch`
     (the family list is small and already fully loaded — filtering is the primitive's own local
     filter), no `onCreateNew`.
   - **The 6 limit:** when `featuredFamilies.length >= 6`, disable the input
     (`disabled={isSaving || featuredFamilies.length >= 6}`) and render
     `t("admin.settings.storefront.familyLimitReached")` beneath it in `text-destructive`. The
     page-level `onAddFamily` guards it a second time (Action 8) so the server's `.max(6)` can
     never be hit.
   - Empty state key: `admin.settings.storefront.noFamilySelected`.
4. Save row: the existing `<Button onClick={onSave} disabled={isSaving || !isDirty}>` with the
   `Save` icon, plus — when `isDirty` — `t("admin.settings.storefront.unsavedChanges")` in muted
   text beside it.

Rewrite the file header comment: the current one says "featured-products picker only … Sprint 8
wires `usePlatformSettings`". It must now describe both lists, the draft-then-Save model, and the
6-family bound.

### Action 8 — `Apps/web/src/pages/admin/settings/AdminSettings.tsx` (Storefront wiring)

Delete `handleAddFeatured`, `handleRemoveFeatured` and the fake `handleSaveStorefront`, plus the
`featuredIds` / `productNameById` / `featuredProducts` / `productOptions` memos and the
`useAdminCatalogProducts({ page: 1, limit: 100 })` call and its stale comment. Replace with:

```tsx
  // --- Storefront tab (S17) ---
  // Draft state: the tab batches both lists into one PATCH instead of one PATCH per chip
  // (the old Save button did nothing at all). Seeded from the server whenever the settings
  // query resolves or refetches; local edits win until Save or a fresh server value arrives.
  const [draftProductIds, setDraftProductIds] = useState<string[] | null>(null);
  const [draftFamilyIds, setDraftFamilyIds] = useState<string[] | null>(null);
  const savedProductIds = settingsQuery.data?.storefront.featuredProductIds;
  const savedFamilyIds = settingsQuery.data?.storefront.featuredFamilyIds;
  useEffect(() => {
    if (savedProductIds) setDraftProductIds(savedProductIds);
  }, [savedProductIds]);
  useEffect(() => {
    if (savedFamilyIds) setDraftFamilyIds(savedFamilyIds);
  }, [savedFamilyIds]);
  const productIds = draftProductIds ?? savedProductIds ?? [];
  const familyIds = draftFamilyIds ?? savedFamilyIds ?? [];

  // Picker options: server-side search (F1 — a 100-row page could neither show nor find a
  // product outside it). 300 ms, the debounce every other admin search on this app uses.
  const [productSearchInput, setProductSearchInput] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearchInput, 300);
  const productSearchResult = useAdminCatalogProducts({
    search: debouncedProductSearch || undefined,
    page: 1,
    limit: 20,
  });

  // Chip labels: resolved by id, so a featured product outside the search page still shows its
  // name instead of a raw uuid (S17 taught `staffAdminWhere` the `ids` filter for this).
  const featuredProductsResult = useAdminCatalogProducts(
    { ids: productIds.join(","), page: 1, limit: 100 },
    { enabled: productIds.length > 0 },
  );
  const featuredProductNameById = useMemo(
    () => new Map((featuredProductsResult.data?.items ?? []).map((p) => [p.id, p.name])),
    [featuredProductsResult.data],
  );
  const featuredProducts = useMemo(
    () => productIds.map((id) => ({ id, name: featuredProductNameById.get(id) ?? id })),
    [productIds, featuredProductNameById],
  );
  const productOptions: AutocompleteOption[] = useMemo(
    () =>
      (productSearchResult.data?.items ?? [])
        .filter((p) => !productIds.includes(p.id))
        .map((p) => ({ value: p.id, label: p.name })),
    [productSearchResult.data, productIds],
  );

  // Families reuse the Hierarchy tab's existing query (F6) — no extra request.
  const familyNameById = useMemo(
    () => new Map((families.data ?? []).map((f) => [f.id, f.name])),
    [families.data],
  );
  const featuredFamilies = useMemo(
    () => familyIds.map((id) => ({ id, name: familyNameById.get(id) ?? id })),
    [familyIds, familyNameById],
  );
  const familyOptions: AutocompleteOption[] = useMemo(
    () =>
      (families.data ?? [])
        .filter((f) => !familyIds.includes(f.id))
        .map((f) => ({ value: f.id, label: f.name })),
    [families.data, familyIds],
  );

  const MAX_FEATURED_FAMILIES = 6; // mirrors StorefrontSettingsInputSchema's own .max(6)

  const storefrontDirty =
    JSON.stringify(productIds) !== JSON.stringify(savedProductIds ?? []) ||
    JSON.stringify(familyIds) !== JSON.stringify(savedFamilyIds ?? []);

  const handleSaveStorefront = () => {
    updateSettings.mutate(
      { storefront: { featuredProductIds: productIds, featuredFamilyIds: familyIds } },
      { onSuccess: () => toast.success(t("admin.settings.saveSuccess")) },
    );
  };
```

Add-/remove-handlers (all pure draft edits, no mutation):

```tsx
  const handleAddProduct = (id: string) =>
    setDraftProductIds((prev) => {
      const current = prev ?? savedProductIds ?? [];
      return current.includes(id) ? current : [...current, id];
    });
  const handleRemoveProduct = (id: string) =>
    setDraftProductIds((prev) => (prev ?? savedProductIds ?? []).filter((x) => x !== id));
  const handleAddFamily = (id: string) =>
    setDraftFamilyIds((prev) => {
      const current = prev ?? savedFamilyIds ?? [];
      if (current.includes(id) || current.length >= MAX_FEATURED_FAMILIES) return current;
      return [...current, id];
    });
  const handleRemoveFamily = (id: string) =>
    setDraftFamilyIds((prev) => (prev ?? savedFamilyIds ?? []).filter((x) => x !== id));
```

Then pass everything to `<StorefrontSettings>` inside the existing `storefront` `TabsContent`
(keep its `isLoading` / `isError` branches untouched):

```tsx
            <StorefrontSettings
              featuredProducts={featuredProducts}
              productOptions={productOptions}
              productSearch={productSearchInput}
              onProductSearchChange={setProductSearchInput}
              isProductSearchLoading={productSearchResult.isFetching}
              onAddProduct={handleAddProduct}
              onRemoveProduct={handleRemoveProduct}
              featuredFamilies={featuredFamilies}
              familyOptions={familyOptions}
              onAddFamily={handleAddFamily}
              onRemoveFamily={handleRemoveFamily}
              isDirty={storefrontDirty}
              onSave={handleSaveStorefront}
              isSaving={updateSettings.isPending}
            />
```

Imports to add: `useEffect` from react, `useDebouncedValue` from `@/hooks/useDebouncedValue`,
`type AutocompleteOption` from `@/components/shared/autocomplete-input`. `useAdminCatalogProducts`
is already imported.

Update the file's header comment: the Sprint-8 paragraph describes the old one-generous-page
picker; replace that sentence with the search-plus-ids model and the batched Save.

### Action 9 — `Apps/web/src/config/translations.json`

Flat `"a.b.c": { en, fr, ar }` entries. Insert each next to its existing neighbours
(`admin.users.*` block, `admin.settings.storefront.*` block); `ar` is `""` per convention.

| Key | en | fr |
|---|---|---|
| `admin.users.changePassword.action` | Change password | Modifier le mot de passe |
| `admin.users.changePassword.title` | Change password | Modifier le mot de passe |
| `admin.users.changePassword.warning` | This immediately signs the user out of every device | Cela déconnecte immédiatement l'utilisateur de tous les appareils |
| `admin.users.changePassword.newPassword` | New password | Nouveau mot de passe |
| `admin.users.changePassword.confirmPassword` | Confirm password | Confirmer le mot de passe |
| `admin.users.changePassword.minLength` | Password must be at least 8 characters | Le mot de passe doit contenir au moins 8 caractères |
| `admin.users.changePassword.confirmRequired` | Please confirm the new password | Veuillez confirmer le nouveau mot de passe |
| `admin.users.changePassword.success` | Password changed | Mot de passe modifié |
| `admin.settings.storefront.featuredProductsHelp` | These products appear in the storefront's featured strip | Ces produits apparaissent dans la sélection de la vitrine |
| `admin.settings.storefront.searchProductsPlaceholder` | Search a product by name | Rechercher un produit par nom |
| `admin.settings.storefront.noProductSelected` | No featured product yet | Aucun produit mis en avant |
| `admin.settings.storefront.removeProduct` | Remove this product | Retirer ce produit |
| `admin.settings.storefront.featuredFamilies` | Featured families | Familles mises en avant |
| `admin.settings.storefront.featuredFamiliesHelp` | Choose up to 6 families to show on the home page | Choisissez jusqu'à 6 familles à afficher sur la page d'accueil |
| `admin.settings.storefront.searchFamiliesPlaceholder` | Search a family | Rechercher une famille |
| `admin.settings.storefront.noFamilySelected` | No featured family yet | Aucune famille mise en avant |
| `admin.settings.storefront.removeFamily` | Remove this family | Retirer cette famille |
| `admin.settings.storefront.familyLimitReached` | Maximum of 6 families reached — remove one to add another | Maximum de 6 familles atteint — retirez-en une pour en ajouter une autre |
| `admin.settings.storefront.unsavedChanges` | Unsaved changes | Modifications non enregistrées |

Reused, already present — do **not** re-add: `register.passwordMismatch`, `common.cancel`,
`common.save`, `common.saving`, `common.noResults`, `admin.settings.saveSuccess`,
`admin.settings.storefront.featuredProducts`, `admin.settings.storefront.deliveryCompaniesNote`.

---

## 3. Ripple summary (contract → component)

| Layer | File | Change |
|---|---|---|
| prisma | — | none |
| contract | — | none (password + `.max(6)` already exist — §0.2) |
| api service | `catalog.service.ts` | `staffAdminWhere` honours `ids` |
| web service | — | none (`listAdminProducts`, `updateUser` already exist) |
| query key | `qk.catalog.adminProducts.list(query)` | reused; `ids`/`search` vary inside `query` |
| hook | `useCatalogProducts.ts` | `useAdminCatalogProducts(query, options?)` |
| hook | `useIdentity.ts#useUpdateUser` | reused unchanged |
| component | `users-table.tsx`, new `change-password-dialog.tsx`, new `change-user-password.schema.ts`, `AdminUsers.tsx` | password change |
| component | `storefront-settings.tsx` (rebuilt), `AdminSettings.tsx` | both pickers + real Save |

**Files touched: 8** (2 new). No migration. No new route. No new PageKey.

---

## 4. Manual verification checklist (browser)

Prepare: at least **1 staff user and 1 admin user**; more than 100 products in the catalog, with
at least one product whose name sorts late enough that it is *not* in the newest 100; at least 7
enabled families.

**Users — change password**

1. `/admin/users`, Users tab: every row now shows a **key icon** beside Edit.
2. Click the key on a staff user → a dialog opens titled "Change password <username>", with the
   sign-out warning and exactly **two** fields (no current-password field).
3. Type 5 characters in New password, tab out → "Password must be at least 8 characters".
4. Type 8+ characters, and a different value in Confirm → "Passwords do not match".
5. Make them match, Save → "Password changed" toast, the dialog closes, and the users table does
   **not** otherwise change (no role/status flicker).
6. Sign out, sign in as that user with the **old** password → rejected. Sign in with the **new**
   password → succeeds.
7. Re-open the key dialog on the same user → both fields are **empty** (fresh form, `key` prop).
8. Click Edit on the same user → the edit dialog is unchanged, and has **no** password field.

**Settings → Storefront — featured products**

9. `/admin/settings` → Storefront tab. Existing featured products render as chips **by name**.
   If any chip previously showed a uuid, it now shows the product's name.
10. Click the product field and type a few letters of a product that is **not** among the newest
    100 → it appears in the dropdown (server-side search) and picking it shows its **name** in a
    new chip, never its id (RC-1).
11. The picked product no longer appears in the dropdown list (already-featured items are filtered
    out).
12. Remove a chip with its × → the chip disappears; **nothing is saved yet** and
    "Unsaved changes" appears beside the Save button.
13. Reload the page **without** saving → the removed chip is back (draft was local only).
14. Redo the change, click Save → "Settings saved successfully"; "Unsaved changes" disappears and
    the Save button greys out until the next edit.
15. Reload → the saved list persists.
16. Home page (`/`) featured strip reflects the saved product list.

**Settings → Storefront — featured families**

17. The Families picker lists every enabled family by name.
18. Add families one at a time up to **6** → after the 6th, the input is **disabled** and
    "Maximum of 6 families reached — remove one to add another" is shown.
19. Remove one → the input is usable again.
20. Save → "Settings saved successfully"; reload → the 6 families persist in order.
21. Home page (`/`) shows exactly those families in the family strip (S15 wired this reader; if
    the list is emptied and saved, the home page falls back to `Family.isFeatured`).

**Both themes / regressions**

22. Repeat steps 9-14 in **light mode** — chips, helper text and the limit warning are legible.
23. The other Settings tabs (Categories, Delivery, Store, Invoicing, Hierarchy) still load and
    save exactly as before — in particular, Hierarchy's family list is unaffected by the new
    families picker sharing its query.
24. `/admin/products` still lists and searches normally (the `staffAdminWhere` change must be
    invisible when no `ids` is passed), and `/staff/products` likewise.

---

## 5. Handoffs

1. **To S18** — `/admin/settings` and `/admin/users` have **no staff twin** and must not gain one:
   both pages are admin-only surfaces (`PLATFORM_ROUTES.SETTINGS` and every
   `IDENTITY_ROUTES.USERS`/`ROLES`/`PAGES` route is `adminOnly`). S18 has nothing to mirror from
   this set.
2. **`staffAdminWhere`'s new `ids` filter** is now available to any admin/staff product list —
   S18's staff surfaces may use it, but nothing in S18 requires it.
