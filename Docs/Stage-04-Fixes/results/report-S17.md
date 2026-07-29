# Report — Set 17: Users, roles & settings

Executed against `Docs/Stage-04-Fixes/plans/plan-S17-users-roles-and-settings.md` on
`stage-04-fix`, 2026-07-28.

## What changed

### Backend (`Apps/api`)
- `catalog.service.ts#staffAdminWhere` — added the same comma-separated `ids` filter
  `listProducts` (public storefront) already honoured. This is the only backend change in the
  set: everything else needed by §S17 (password PATCH, `featuredFamilyIds` + its server-side
  `.max(6)`) already existed from S15/identity Sprint 1 and required no code.

### Frontend (`Apps/web`)
- **`hooks/useCatalogProducts.ts`** — `useAdminCatalogProducts` gained an optional
  `{ enabled }` second argument, mirroring its public sibling. Every existing single-argument
  caller is unaffected (`enabled: undefined` = enabled).
- **New `pages/admin/users/components/change-user-password.schema.ts`** — `password` (min 8,
  matching `UpdateUserSchema.password`) + client-only `confirmPassword`, reusing
  `register.passwordMismatch` for the mismatch message. Compile-time `AssertAssignable` guard
  against `UpdateUserCommand`.
- **New `pages/admin/users/components/change-password-dialog.tsx`** — dumb dialog, modeled on
  `reset-password-dialog.tsx` (sign-out warning banner, two password fields, Cancel/Save
  footer). No current-password field, per the brief.
- **`pages/admin/users/components/users-table.tsx`** — new optional `onChangePassword` prop; a
  `KeyRound` icon button beside Edit in the desktop actions column
  (`stopPropagation`'d) and as a sibling action beneath the mobile row's edit button (not nested
  inside it, to avoid an invalid nested `<button>`).
- **`pages/admin/users/AdminUsers.tsx`** — new `passwordUser` state, `handleChangePassword`
  reusing the existing `useUpdateUser()` mutation (`{ id, command: { password } }` —
  `confirmPassword` is never sent), and a keyed `<ChangePasswordDialog>` mirroring the existing
  `UserDialog`/`RoleDialog` per-entity `key` convention.
- **`pages/admin/settings/components/storefront-settings.tsx`** — rebuilt. Now takes both a
  featured-products list (server-searched via `onSearch`/`isLoading`) and a featured-families
  list (capped client-side at 6, matching `StorefrontSettingsInputSchema.featuredFamilyIds.max(6)`),
  plus `isDirty`/`onSave` so the Save button is real and disabled until there is something to
  save.
- **`pages/admin/settings/AdminSettings.tsx`** — replaced the old "one 100-row page" product
  picker and the fake `handleSaveStorefront` (which only fired a toast) with:
  - draft state (`draftProductIds`/`draftFamilyIds`) seeded from the server via `useEffect`,
    memoized derivation (`productIds`/`familyIds`) so downstream `useMemo`s don't recompute on
    every render;
  - a debounced (300 ms) server-searched product query (`useAdminCatalogProducts({ search, page:
    1, limit: 20 })`);
  - a separate `ids`-driven query (`useAdminCatalogProducts({ ids: productIds.join(",") }, {
    enabled: productIds.length > 0 })`) to resolve chip labels regardless of whether the featured
    product is in the current search page;
  - the families picker reusing the Hierarchy tab's existing `useCatalogFamilies({}, true)` query
    — no extra request;
  - one real `updateSettings.mutate({ storefront: { featuredProductIds, featuredFamilyIds } })`
    on Save.
- **`config/translations.json`** — 19 new keys: 8 under `admin.users.changePassword.*`, 11 under
  `admin.settings.storefront.*` (`featuredProductsHelp`, `searchProductsPlaceholder`,
  `noProductSelected`, `removeProduct`, `featuredFamilies`, `featuredFamiliesHelp`,
  `searchFamiliesPlaceholder`, `noFamilySelected`, `removeFamily`, `familyLimitReached`,
  `unsavedChanges`). `ar: ""` per convention. Every `t()` call across the touched files was
  cross-checked against the file — zero unresolved keys.

## Deviations from the plan

None. All 9 actions were implemented as specified.

## Validation gate (D12 — no test file read, edited, or run)

| Package | `tsc --noEmit` | `lint` (touched files) |
|---|---|---|
| `Apps/contract` | clean | not touched this set |
| `Apps/api` | `src/**` clean (verified: zero `error TS` lines outside `test/**`); `test/**` has pre-existing staleness only, unrelated to this set (inventory/orders/purchasing/repairs/sales spec fixtures predate S17) | `catalog.service.ts` clean |
| `Apps/web` | clean | clean — one prettier formatting error and 4 `react-hooks/exhaustive-deps` warnings were found and fixed during this set (the latter by memoizing `productIds`/`familyIds`, not by suppressing the rule) |

No test file was read, edited, or run.

## Manual verification checklist (browser)

Reproduced from the plan's §4 for the reviewer's convenience. Prepare: at least 1 staff user and
1 admin user; more than 100 products in the catalog, with at least one product whose name sorts
late enough that it is *not* in the newest 100; at least 7 enabled families.

**Users — change password**

1. `/admin/users`, Users tab: every row now shows a **key icon** beside Edit.
2. Click the key on a staff user → a dialog opens titled "Change password &lt;username&gt;", with
   the sign-out warning and exactly **two** fields (no current-password field).
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
11. The picked product no longer appears in the dropdown list (already-featured items are
    filtered out).
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
21. Home page (`/`) shows exactly those families in the family strip (falls back to
    `Family.isFeatured` if the saved list is empty).

**Both themes / regressions**

22. Repeat steps 9-14 in **light mode** — chips, helper text and the limit warning are legible.
23. The other Settings tabs (Categories, Delivery, Store, Invoicing, Hierarchy) still load and
    save exactly as before — in particular, Hierarchy's family list is unaffected by the new
    families picker sharing its query.
24. `/admin/products` still lists and searches normally (the `staffAdminWhere` change must be
    invisible when no `ids` is passed), and `/staff/products` likewise.

## Handoffs

1. **To S18** — `/admin/settings` and `/admin/users` have **no staff twin** and gain none here:
   both pages are admin-only surfaces. Nothing for S18 to mirror from this set.
2. **`staffAdminWhere`'s new `ids` filter** is now available to any admin/staff product list —
   S18 may use it but nothing in S18 requires it.
