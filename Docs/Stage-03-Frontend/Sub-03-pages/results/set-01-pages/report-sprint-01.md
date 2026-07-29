# Sprint 1 Report — Schemas & i18n (Foundation)

**Set:** pub-pages · **Status:** ✅ Done · **Branch:** `pages-set-01`

---

## Summary

Landed the four missing co-located Zod schemas (aligned to their `Apps/contract` Commands, each with a
compile-time `AssertAssignable` guard), added 28 translation keys + updated 1 existing key's copy, and
cleared the two real inline-string/effect debts this sprint owns. Zero new lint errors, `tsc --noEmit`
clean, full test suite green (299/299, no regressions).

## Files changed

**New**
- `src/pages/register/register.schema.ts` — `registerSchema(t)` → `RegisterFormValues`, checked against `RegisterClientCommand`.
- `src/pages/product-detail/order.schema.ts` — `orderSchema(t, availableQuantity)` → `OrderFormValues`, checked against `PlaceOrderCommand`.
- `src/pages/my-account/update-me.schema.ts` — `updateMeSchema(t)` → `UpdateMeFormValues`, checked against `UpdateMeCommand`.
- `src/pages/my-account/change-password.schema.ts` — `changePasswordSchema(t)` → `ChangePasswordFormValues`, checked against `ChangeMyPasswordCommand` (minus `confirmPassword`).

**Modified**
- `src/config/translations.json` — +28 keys, 1 key's copy updated (see below).
- `src/pages/LoginPage.tsx` — hardcoded `"App Template"` h1 → `t("common.brand.pageTitle")`.
- `src/pages/Products.tsx` — deleted the 47-line SEO `useEffect` block (`document.title`/meta tags); out of this set's concern per plan.md.

**Verified, not modified**
- `src/pages/login.schema.ts` — already correct (`loginSchema(t)` + `AssertAssignable<LoginCommand>`); no change needed.
- `src/pages/Register.tsx` — audited line-by-line for inline JSX text; **none found**, the success panel already routes through `t('register.registrationSuccess')`. The sprints.md task description ("inline success SVG/text → keys") was stale from planning; corrected in the sprint doc rather than forcing a phantom edit.

## Schema design notes

- **`register.schema.ts`**: `email` uses `z.union([z.email(...), z.literal("")]).optional().transform(v => v ? v : undefined)` so a cleared/untouched controlled input (`""`) never fails email-format validation and never reaches the wire as `""` (the contract's `z.email()` would reject an empty string server-side). Same pattern reused in `update-me.schema.ts`.
- **`order.schema.ts`**: `availableQuantity` is a schema-factory parameter (`orderSchema(t, availableQuantity)`), mirroring `loginSchema(t)`'s factory pattern — the caller (Sprint 5, `ProductDetails`) will pass the product's live stock count. The two `.refine()`s mirror the contract's own `PlaceOrderSchema` refines (delivery required unless `PICKUP`, forbidden when `PICKUP`) so the form surfaces the same rule locally. `clientId` is intentionally not a form field (populated from the session at submit time, per plan.md PUB-03 §4); since it's optional on `PlaceOrderCommand`, the `AssertAssignable` check holds without it.
- **`update-me.schema.ts`**: no `phone` field, matching PUB-08 (read-only) and the contract's `.strict()` UpdateMeSchema (a stray `phone` key would 400). `wilayaId`/`communeId` reuse `register.wilayaRequired`/`register.communeRequired` for their required-message rather than new `account.*` duplicates.
- **`change-password.schema.ts`**: `confirmPassword` is real in the RHF schema (drives the match `.refine`) but is excluded from the `AssertAssignable` check via `Omit<..., "confirmPassword">` — the wiring sprint (6) must strip it before calling `useChangeClientPassword`.

## i18n — key inventory

**Reuse-first correction:** sprints.md's own shorthand ("`home.*`, `catalog.*`, `productDetail.*`") named scopes that don't exist and shouldn't — Home's sections (`hero.*`, `categories.*`, `brands.*`, `products.*`) and Catalog (`products.filters.*`, `products.errorLoading*`, `products.results.*`) are **already fully keyed** by prior sprints. Per rules §6B ("no page-local translation files; reuse keys"), no new scope was added for either page. This is the correct application of the rule, not a deviation — flagged here for visibility since it diverges from sprints.md's literal wording.

**New keys added (28):**

| Key | Purpose |
|---|---|
| `auth.login.noAccount` | Login page register-link lead-in text (Sprint 6 wires the `<Link>`; reuses existing `auth.createAccount` as the link label) |
| `register.storeName`, `register.storeNamePlaceholder` | New field PUB-07 requires that the current form is missing |
| `register.phoneRegistered`, `register.phonePending` | Exact PUB-07 copy for the two `PhoneAvailability` conflict states |
| `account.emailInvalid` | My-Account profile-form email format error |
| `account.currentPassword`, `account.currentPasswordPlaceholder`, `account.currentPasswordRequired` | New change-password form (distinct from the old admin-driven `PasswordResetForm` which has no current-password field) |
| `account.newPasswordMinLength` | min-6 copy — deliberately **not** reusing `account.passwordRequirements.minLength` (says "8 characters", tied to the old reset flow's `min(8)`; reusing would state the wrong number) |
| `account.confirmPasswordRequired` | Change-password form |
| `account.changePassword`, `account.changePasswordSuccess`, `account.changePasswordError` | Change-password card/toast copy |
| `account.totalPaid`, `account.totalSold` | `MoneyStatusCard`'s new DTO fields (`ClientMeDto.totalPaid`/`totalSold`) — pre-provisioned for Sprint 3's retype |
| `account.myInvoices`, `account.myInvoicesSubtitle` | Billing-tab shortcut PUB-08 requires that didn't exist yet |
| `account.statusActive` | The one literal status word PUB-08 allows — replaces the old `getStatusText()` helper's untranslated raw English strings |
| `product.quantityMin`, `product.quantityExceedsStock`, `product.fullNameRequired`, `product.phoneRequired`, `product.deliveryRequired`, `product.deliveryForbiddenForPickup` | Order-form validation messages (`order.schema.ts`) — placed under the already-established `product.*` scope rather than a new `productDetail.*`, matching every other product-detail key already in the file |
| `staff.landing.redirecting`, `staff.landing.noPermittedPages`, `staff.landing.noPermittedPagesBody` | New `/staff` landing surface (Sprint 2 routing, Sprint 4 empty state) |

**Updated in place:** `register.registrationSuccess` — old copy ("Please contact us to validate your account") replaced with PUB-07's exact wording: *"Thank you for registering — please wait for the admin's approval."* Both of its two call sites in `Register.tsx` (the post-confirm toast and the success-panel body) inherit the corrected copy automatically.

**Deliberately reused, not duplicated:** `register.wilayaRequired`, `register.communeRequired` (order form + my-account form), `register.passwordMismatch` (change-password form), `common.brand.pageTitle` (login h1), `auth.createAccount` (login register-link label).

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both `tsconfig.json` and `tsconfig.test.json` via `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 299/299 passed, 35/35 files, no regressions |
| `eslint` on the 4 new schema files + `LoginPage.tsx` | ✅ 0 errors |
| `eslint` on `Products.tsx` | 65 errors remaining, **down from 84 pre-existing** (verified via `git stash`) — all pre-existing prettier quote/formatting noise unrelated to this sprint's change (memory: `eslint-node18-crash`, `stage-03-sprint4-complete`); zero new errors introduced |
| Inline strings | ✅ none introduced; 1 pre-existing one fixed (`LoginPage.tsx`) |
| `useEffect` fetching | ✅ none introduced; 1 non-fetching SEO effect removed |
| Test files in `/src` | ✅ none added |

## Deviations from the sprint task list (both resolved toward "reuse keys" / verified-current-code)

1. **No `home.*`/`catalog.*`/`productDetail.*` scopes created** — see i18n section above.
2. **No `Register.tsx` inline-string edit** — audited and found already fully keyed; the sprint doc's task description was stale. Corrected in `sprints.md`'s Sprint 1 block rather than forcing an unnecessary change.

Neither deviation affects downstream sprints — Sprint 3 (DTO retype) and Sprint 5/6 (wiring) still consume exactly the hooks/schemas/keys `plan.md` specified.

## Next

Sprint 2 — Routing, Guards, Lazy & Engine-gap prep (`:id` route, `/staff` surface, client-scoped
`/my-account`, idempotency-key header, related-products hydration decision).
