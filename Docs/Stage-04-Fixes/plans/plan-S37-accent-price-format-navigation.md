# Plan S37 — Accent token, price format & storefront navigation

Execution plan for **set 37** of `Docs/Stage-04-Fixes/sets-37-39.md`. **The work is frontend only.**
There are no Prisma, contract or API changes and no migration.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

- **S1–S36 are merged** (latest is `61f82bc`, "complete version 1.6"). The branch is `version-1-7`.
- **S37 depends on nothing.** **S38 and S39 both depend on S37:**
  - they use the `highlight` token;
  - they use `formatPrice`;
  - they use the `SectionTitle` marker;
  - they use the restructured header.
- **S38 rebuilds the hero and the footer.** **S39 rebuilds the home rows, the tiles and
  `ProductCard`.** In S37, touch those files **only** where an action below says so. Do not start
  their redesign here.

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | The category bar lists top-level families, each with a dropdown of its child families. The catalog's `familyId` filter is an exact match (`catalog.service.ts:472`). Should a parent family also show its children's products? | **No. Exact match, as today.** No backend change. A parent family whose products all sit under its children opens an empty catalog page. That is accepted. |
| Q2 | Unused Arabic/RTL plumbing already exists: `"ar"` in `Language`, `dirForLanguage`, the `dir` effect in `LanguageProvider`, and an `"ar": ""` field on every translation entry. What happens to it? | **Leave it untouched.** Build nothing new for Arabic and remove nothing. New translation entries keep the file's existing shape (`en`, `fr`, `"ar": ""`). The empty `ar` field is the file's shape, not Arabic content. |
| Q3 | Do the client's own **My Invoices** list and on-screen invoice view use the new price format? | **Yes.** The set's "invoices keep their format" means the **back-office** invoice pages and the **server-generated invoice PDF**. Everything a client sees on screen uses `3 200 DA`. |

### 0.3 Findings from reading the code (record them in the report)

- **F1 — tokens are OKLCH, not HSL.**
  - `index.css` stores every color as an OKLCH triple (`--primary: 0.552 0.228 260.9`).
  - `tailwind.config.ts` wraps each one as `oklch(var(--x) / <alpha-value>)`.
  - The set's HSL values (`358 75% 51%` …) would render as garbage inside `oklch()`. They were
    converted during planning, and the contrast was re-measured:

  | Token | Set (HSL) | This file (OKLCH) | RGB |
  |---|---|---|---|
  | light `--highlight` (scarlet) | `358 75% 51%` | `0.583 0.219 26.2` | 224 36 43 |
  | light `--highlight-foreground` | `0 0% 100%` | `1 0 89.9` (the file's white) | 255 255 255 |
  | dark `--highlight` (vermilion) | `11 100% 61%` | `0.687 0.204 34.1` | 255 93 56 |
  | dark `--highlight-foreground` | `222 30% 6%` | `0.161 0.014 266.7` | 11 13 20 |

  - White on scarlet: **4.72:1** (passes AA).
  - White on vermilion: **3.06:1** (fails).
  - Near-black on vermilion: **6.33:1** (passes).
  - Vermilion text on the dark card: **5.8:1**.

  These match the set's figures.
- **F2 — the "cyan theme-toggle state" is the ghost-button hover.**
  - In this app, `--accent` is a saturated **cyan** (`0.784 0.143 221.1`), not shadcn's usual grey.
  - `Button variant="ghost"` hovers with `hover:bg-accent`, so the theme toggle (a ghost icon
    button) turns cyan on hover.
  - `--accent` stays as it is (the set forbids overwriting it). Action 5.6 overrides the hover on
    the toggle only.
- **F3 — client pages render `3,200 DZD` today.**
  - `formatDZD(amount, language = "en")` (`lib/utils.ts:22`) appends `DZD`.
  - Most client callers pass no language, so they render en-US grouping (`3,200 DZD`).
  - `ProductPricingSection` and `MoneyStatusCard` concatenate `toLocaleString() + " DA"` inline.
  - So three formats appear on the storefront today.
- **F4 — the storefront header is the main cause of phone overflow.**
  - The header row holds, all non-shrinking: burger (36px), logo with text (about 190px), the
    search icon, the language switch, the theme toggle, the cart, and a text "Se connecter" button.
  - Together that is about 500px, wider than a 375px viewport.
  - The `w-96` (384px) loading skeletons also overflow while loading (Action 6.10).
- **F5 — the dead Tailwind classes are no-ops.** None of these is defined in `tailwind.config.ts`
  or `index.css`:
  - `shadow-card`, `shadow-elegant`;
  - `from-primary-glow` / `to-primary-glow`;
  - `bg-gradient-hero`, `animate-float`, `text-black-500`.

  The cards' `hover:shadow-elegant` therefore does nothing. S37 replaces it with the highlight
  hover ring on the cards it touches. Leave the other dead classes for S38 and S39, which rebuild
  those components.
- **F6 — the storefront cart has no count today.** The cart icon is a plain link. The count comes
  from the existing `useClientCart()` list (`GET` cart, the favorites list). No new endpoint is
  needed.
- **F7 — error toasts already carry an icon.** `main.tsx` mounts Sonner with `richColors`, so
  `toast.error` already shows an icon.

  The gaps are elsewhere:
  - `FormMessage` (`components/ui/form.tsx`) renders no icon;
  - about 70 hand-rolled `<p className="text-sm text-destructive">` field errors render no icon.
- **F8 — the error red and the highlight scarlet are nearly the same hue in light mode.**
  `--destructive` is `0.636 0.208 25.4`, against scarlet's `0.583 0.219 26.2`. That is why the
  set's "error = icon + text" rule matters. Use the **`AlertCircle`** icon for errors. `AlertTriangle`
  stays the warning glyph.
- **F9 — a hardcoded English string.** `supplier-modify-dialog.tsx:242` renders "Please fix the
  errors above before saving." without `t()`. Action 4.3 fixes it in passing, because that line is
  being converted anyway.
- **F10 — Sonner toasts would sit on top of the bottom nav.** Sonner is at `bottom-right`, with a
  16px mobile offset. Action 6.9 lifts the toasts above the bar on storefront pages only.

### 0.4 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **One layout breakpoint, `md` (768px), for "phone layout"**: two-row header, bottom nav, no category bar, and catalog filters in a Sheet. `ProductFilters` moves its Sheet breakpoint from `sm` to `md` to match. | With two breakpoints, a 640–767px window would show the bottom nav's "Categories" item while the filter Sheet trigger was hidden. One threshold removes that case. `use-mobile.ts` already uses 768. |
| P2 | **The mobile burger menu and the desktop text links (Home / Products / Contact) are removed.** | On phones the bottom nav covers Home, Categories and Search. On desktop the logo is Home, and the category bar starts with "All products". Contact is in the footer, which S38 wires to settings. |
| P3 | **The theme toggle stays in the header on both breakpoints.** | The set's header list omits it, but the set also restyles it, and the storefront must stay switchable. It sits in the icon group with the language switch and the account control. |
| P4 | **The account control stays in mobile row 1 as well as in the bottom nav.** | Sign out exists only in the header's account dropdown. `MyAccount` has no sign-out, so the dropdown must stay reachable on phones. A guest sees an icon-only login button below `md` and the text button from `md` up. |
| P5 | **The bottom nav's Account item routes by session type:** CLIENT → `/my-account`, ADMIN → `/admin`, STAFF → `/staff`, guest → `/login`. | `/my-account` is CLIENT-only. A staff member sent there is bounced to `/` by `RoleGuard`. |
| P6 | **Categories (bottom nav) opens `/products` with its filter Sheet open**, through router state. If the user is already on `/products`, the current query string is kept. | This is "the catalog with the family filter, not a new page". Router state keeps the URL, which is the catalog's single source of truth, free of a UI-only flag. The state is cleared after use, so Back or refresh doesn't reopen the Sheet. |
| P7 | **A child family whose parent is disabled does not appear in the category bar.** The public families list omits the disabled parent. | This follows S21 Q5 (`AdminSettings.tsx:303-305`): "the child family will not surface under it … until the parent is back". It stays reachable through the catalog's flat family filter. |
| P8 | **Status badges on client pages also stay semantic**, for example the order and payment badges in `OrderCard` and the invoice status. | The set restricts admin and staff explicitly. The same reasoning holds on the client side: a cancelled order and a decorative badge must not share one red. On the storefront, highlight badges are product markers (Action 5.5). |
| P9 | **The `DA` suffix is a constant, not a translation key.** | It is a currency symbol, identical in both locales, and the set fixes it. `config/constants.ts` is the file whose comment invites "hardcoded, non-DTO-derived values shared across pages". |
| P10 | **No `overflow-x: hidden` / `clip` safety net on `body`, `#root` or the layout.** Every overflow is fixed at its cause. | The set says to fix the cause. `overflow-x: hidden` on an ancestor also breaks the sticky header. |

### 0.5 Accent usage policy (copy this verbatim into the report; it is deliberate)

**The accent (`highlight`) is used in these places only:**

- **Storefront and client pages:** badges, the cart count bubble, the active-nav underline, the
  marker before section titles, the hero-slider dots (S38), and hover rings on tiles and cards.
- **Admin and staff:** **only** the active nav indicator, the section-title markers, hover rings
  on interactive tiles, and the theme toggle.

**It is never used for:**

- primary buttons (they stay blue);
- large background fills;
- long passages of text;
- **status badges, anywhere.**

**Status badges keep their semantic colors:**

- green — success / completed;
- amber — warning / pending;
- grey — neutral / inactive;
- red (`destructive`) — reserved for errors and destructive states.

Red already means "error" in the back-office tables. If decorative badges and *cancelled* badges
shared one red, the tables would stop communicating. **Do not "unify" status badges onto
`highlight` later.**

**Contrast rule:** a filled highlight surface always pairs `bg-highlight` with
`text-highlight-foreground`, **never `text-white`**. White on dark-mode vermilion is 3.06:1 and
fails AA.

### 0.6 Gates (no tests: do not edit or run any test file)

Run these from `Apps/web`:
- `npx tsc --noEmit` must stay **clean**.
- `npx tsc --noEmit -p tsconfig.test.json` must stay **53 errors**, the S36 baseline. Compare
  **per file**, not the total. A change in this count means a signature used by a test changed.
  Fix the source, never the test.
- `npx eslint <every file you created or touched>` must show **0 new errors**. The repo carries
  pre-existing Prettier noise, so lint only your files and note any error that was already there.

---

## §1 — The highlight token

### Action 1.1 — `Apps/web/src/index.css`

1. In the **`:root`** block, directly after `--accent-foreground`, add:

   ```css
   /* S37 — brand accent (scarlet). NOT --accent: in this file --accent is the cyan that shadcn's
      ghost/outline hovers use, so repainting it would turn every hover state red. Pair the fill
      with --highlight-foreground, never a hardcoded white (see the dark block). Usage policy:
      plan-S37 §0.5 — never on primary buttons, large fills, long text, or status badges. */
   --highlight: 0.583 0.219 26.2;
   --highlight-foreground: 1 0 89.9;
   ```

2. In the **`.dark`** block, directly after `--accent-foreground`, add:

   ```css
   /* S37 — vermilion. White text on it is only 3.1:1 (fails AA), so the foreground flips to
      near-black (6.3:1). This pair is the reason the token has a foreground at all. */
   --highlight: 0.687 0.204 34.1;
   --highlight-foreground: 0.161 0.014 266.7;
   ```

3. In `:root`, after `--sidebar-ring`, add the bottom-nav height used by Actions 6.7–6.9:

   ```css
   /* S37 — storefront mobile bottom nav (StorefrontBottomNav). One value, read by the bar itself,
      the layout's bottom padding and the toast offset, so the three can't drift apart. */
   --bottom-nav-height: 4rem;
   --bottom-nav-offset: 0px;
   ```

4. After the `.dark { … }` block and before `@layer base`, add:

   ```css
   /* S37 — while the storefront bottom nav is mounted (phone layout only, it is md:hidden), toasts
      and anything else reading --bottom-nav-offset clear it. :has() keeps this CSS-only; the
      same selector style is already used by the receipt print rules below. */
   body:has([data-storefront-bottom-nav]) {
     --bottom-nav-offset: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
   }
   @media (min-width: 768px) {
     body:has([data-storefront-bottom-nav]) {
       --bottom-nav-offset: 0px;
     }
   }
   ```

### Action 1.2 — `Apps/web/tailwind.config.ts`

In `theme.extend.colors`, after the `warning` entry, add:

```ts
// S37 — brand accent. Distinct from `accent` (shadcn's hover tint, cyan here). Gives
// bg-/text-/border-/ring-highlight (+ /<alpha>) utilities; never use raw hex for it.
highlight: {
  DEFAULT: "oklch(var(--highlight) / <alpha-value>)",
  foreground: "oklch(var(--highlight-foreground) / <alpha-value>)",
},
```

**Result:** `bg-highlight`, `text-highlight`, `border-highlight`, `ring-highlight`,
`bg-highlight/10` and `text-highlight-foreground` all work.

### Action 1.3 — `Apps/web/src/components/ui/badge.tsx`

Add two variants to `badgeVariants.variants.variant`:

```ts
// S37 — storefront marker badges only (plan-S37 §0.5). Never for a status: statuses keep
// their semantic success/warning/muted/destructive colors.
highlight: "border-transparent bg-highlight text-highlight-foreground shadow",
highlightOutline: "border-highlight/50 bg-highlight/10 text-highlight",
```

---

## §2 — The storefront price format

### Action 2.1 — `Apps/web/src/config/constants.ts`

Replace `export {};` with the following, and keep the file's header comment:

```ts
// S37 — currency suffix of the storefront/client price format ("3 200 DA"). A symbol, identical
// in both locales, so a constant rather than a translation key. Back-office screens keep
// formatDZD (lib/utils.ts) and are not affected.
export const PRICE_CURRENCY_SUFFIX = "DA";
// S37 — the single storefront search input (PublicHeader). The bottom nav's Search item focuses
// it by id; the header is sticky, so the input is always on screen.
export const STOREFRONT_SEARCH_INPUT_ID = "storefront-search-input";
```

### Action 2.2 — create `Apps/web/src/lib/price-format.ts`

```ts
import { PRICE_CURRENCY_SUFFIX } from "@/config/constants";

// S37 — THE storefront & client-area price format: "3 200 DA", "12 500,50 DA".
// - thousands separator: a no-break space (U+00A0), so a price never wraps mid-number;
// - decimals: only when the amount has cents (prices are Decimal(12,2)), comma separator;
// - suffix: a no-break space + "DA".
// Deliberately NOT Intl.NumberFormat("fr-FR"): that emits a narrow no-break space (U+202F) and
// would vary with the runtime's ICU data. Language-independent by design — both locales show the
// same string. Scope: storefront + client pages only. Admin, staff, POS, receipts, back-office
// invoices and PDFs keep formatDZD — do not swap those call sites.
const NBSP = " ";

export function formatPrice(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100).toString();
  const fraction = cents % 100;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = fraction === 0 ? "" : `,${fraction.toString().padStart(2, "0")}`;
  const sign = amount < 0 && cents !== 0 ? "-" : "";
  return `${sign}${grouped}${decimals}${NBSP}${PRICE_CURRENCY_SUFFIX}`;
}
```

### Action 2.3 — `Apps/web/src/lib/utils.ts`

**Do not change `formatDZD`, its `"en"` default, or any date helper.** Admin depends on the
current output.

Add one comment line above `formatDZD`:

```ts
// Back-office money format (admin, staff, POS, receipts). Storefront/client pages use
// formatPrice (lib/price-format.ts) instead — S37.
```

### Action 2.4 — swap the storefront and client call sites to `formatPrice`

In each file, replace the money expression with `formatPrice(<amount>)` and import `formatPrice`
from `@/lib/price-format`. Then:
- remove the `formatDZD` import where nothing else uses it;
- if `language` from `useTranslation()` becomes unused, drop it from the destructure (lint).

| File | Lines (at planning time) | Change |
|---|---|---|
| `components/shared/ProductCard.tsx` | 169 | `formatDZD(resolvedPrice, language)` → `formatPrice(resolvedPrice)` |
| `components/shared/StorefrontSearch.tsx` | 170 | `formatDZD(resolvedPrice, language)` → `formatPrice(resolvedPrice)`. This file is also rewritten in Action 6.4, so do both together. |
| `components/sections/product-details/ProductPricingSection.tsx` | 71, 144 | `{resolvedPrice.toLocaleString()} DA` → `{formatPrice(resolvedPrice)}`; `{totalPrice.toLocaleString()} DA` → `{formatPrice(totalPrice)}` |
| `components/shared/OrderPlacementSection.tsx` | 346, 363, 373, 378, 384 | every `formatDZD(x, language)` → `formatPrice(x)`. Its only callers are `Cart` and `ProductPricingSection`, both storefront. |
| `pages/cart/components/CartItemRow.tsx` | 70, 88 | `formatDZD(…, language)` → `formatPrice(…)` |
| `components/shared/OrderCard.tsx` | 144, 158, 163, 169, 189 | `formatDZD(x)` → `formatPrice(x)`. Its only caller is the client `pages/Orders.tsx`. |
| `components/shared/CancelOrderDialog.tsx` | 75 | `formatDZD(order.totalAmount)` → `formatPrice(order.totalAmount)`. Its only caller is `OrderCard`. |
| `pages/order-confirmation/components/OrderConfirmationBody.tsx` | 65, 75 | `formatDZD(x)` → `formatPrice(x)` |
| `pages/my-invoices/components/InvoicesTable.tsx` | 67, 73, 95, 97 | `formatDZD(x)` → `formatPrice(x)` (Q3). This is the **client** table. The back-office one is `pages/staff/invoices/components/InvoicesTable.tsx`: **do not touch it.** |
| `pages/my-invoices/components/InvoiceView.tsx` | 123, 124, 136, 140, 145 | `formatDZD(x)` → `formatPrice(x)` (Q3) |
| `components/shared/MoneyStatusCard.tsx` | 36, 38, 50, 52, 64, 66 | `${x.toLocaleString()} DA` (both the visible text and the `aria-label`) → `formatPrice(x)`. Its only caller is `MyAccount`. Leave its red/green/blue panels alone: they are semantic. |

**Do not touch** `components/shared/ResolvedVsChargedPrice.tsx`. Its only callers are staff
(`SaleDetailDrawer`, `PosTicket`, `OrderShowDialog`).

**Check after the swap:** this grep must return nothing:

```
grep -rnE "formatDZD|toLocaleString|\bDZD\b|\} DA" src/components/sections src/components/shared/{ProductCard,StorefrontSearch,OrderPlacementSection,OrderCard,CancelOrderDialog,MoneyStatusCard}.tsx src/pages/{cart,my-invoices,order-confirmation,product-detail,products} src/pages/{Index,Products,ProductDetails,Orders,MyAccount}.tsx
```

The hero's translation string `hero.sparePartsPrice` ("À partir de 999 DZ") belongs to the hero.
S38 deletes that markup, so leave it.

---

## §3 — French becomes the default locale

### Action 3.1 — `Apps/web/src/lib/i18n.ts`

1. Below the `Language` type, add:

   ```ts
   // S37 — French is the default locale, English second. A saved choice ("sv_lang") still wins.
   export const DEFAULT_LANGUAGE: Language = "fr";
   ```

2. In `getLanguage()`, change `return saved === "fr" ? "fr" : "en";` to
   `return saved === "en" ? "en" : DEFAULT_LANGUAGE;`.
3. Update the comment above `getLanguage` if needed. **Do not touch** the `Language` union,
   `dirForLanguage` or its comment (Q2).

### Action 3.2 — `Apps/web/src/components/providers/LanguageProvider.tsx`

1. Change `useState<Language>("en")` to `useState<Language>(DEFAULT_LANGUAGE)`, imported from
   `@/lib/i18n`.
2. Leave the saved-value effect as it is. It accepts only `"en"` or `"fr"`.
3. Add an effect that keeps `<html lang>` in sync (accessibility and correct hyphenation; this is
   not RTL work):

   ```ts
   // S37 — screen readers and hyphenation follow <html lang>; index.html ships "fr" (the default).
   useEffect(() => {
     if (typeof document !== "undefined") document.documentElement.lang = language;
   }, [language]);
   ```

4. **Do not touch** the `dir` effect (Q2).

### Action 3.3 — `Apps/web/index.html`

- `<html lang="en">` → `<html lang="fr">`.
- The viewport meta → `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />`.
  Without `viewport-fit=cover`, iOS reports `env(safe-area-inset-bottom)` as 0, and the bottom
  nav would sit under the home indicator.
- Leave the meta description and og tags alone. S38 owns them.

**Result:** a first-time visitor sees French. A visitor who already chose English keeps English.
`formatDZD` and the date helpers keep their `"en"` default parameters, so back-office formats are
unchanged.

---

## §4 — Every error message carries an icon

### Action 4.1 — create `Apps/web/src/components/shared/FieldError.tsx`

```tsx
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// S37 — every error message is icon + text, so a red line is never read as a warning or as a
// decorative accent (the highlight scarlet is close to --destructive in light mode). AlertCircle
// = error; AlertTriangle stays the warning glyph. Renders nothing when there is no message, so
// call sites can pass `errors.x?.message` straight through.
export function FieldError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (children === undefined || children === null || children === "" || children === false) {
    return null;
  }
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex items-start gap-1.5 text-sm font-medium text-destructive", className)}
    >
      <AlertCircle className="mt-[0.15em] h-[1em] w-[1em] shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
```

### Action 4.2 — `Apps/web/src/components/ui/form.tsx` (`FormMessage`)

`FormMessage` shows either a validation error or helper `children`. Show the icon only for the
error. Replace the returned `<p>` with:

```tsx
<p
  ref={ref}
  id={formMessageId}
  className={cn(
    "text-[0.8rem] font-medium text-destructive",
    error && "flex items-start gap-1.5",
    className,
  )}
  {...props}
>
  {/* S37 — error = icon + text (FieldError's rule; kept inline so ui/ doesn't import shared/). */}
  {error && <AlertCircle className="mt-[0.15em] h-[1em] w-[1em] shrink-0" aria-hidden="true" />}
  {error ? <span className="min-w-0">{body}</span> : body}
</p>
```

Import `AlertCircle` from `lucide-react`.

### Action 4.3 — convert the hand-rolled field errors to `<FieldError>`

Convert each `{cond && <p className="… text-destructive">{msg}</p>}` to `<FieldError>{msg}</FieldError>`.
`FieldError` returns `null` for an empty message, so the `cond &&` guard can go when the condition
is just "message exists".
- Keep existing `id` attributes by passing `id`.
- Keep a non-default size by passing `className="text-xs"`.
- Keep `role="alert"` (`FieldError` already has it).

| File | Lines at planning time |
|---|---|
| `pages/Register.tsx` | 137, 146, 157, 181, 182, 212, 234 |
| `pages/MyAccount.tsx` | 279, 323, 351, 391, 403, 415 |
| `pages/LoginPage.tsx` | 93, 121 (`text-xs`; keep `id="username-error"` / `id="password-error"`). **Not** 75: that banner already has an `AlertCircle`. |
| `pages/cart/components/CartItemRow.tsx` | 85 (`blockedReason`, `className="text-xs"`) |
| `components/shared/OrderPlacementSection.tsx` | 190, 202, 300, 330 |
| `components/shared/autocomplete-input.tsx` | 314 (keep `mt-1` via `className`). **Not** 261: that is the required-field asterisk. |
| `components/shared/label-size-field.tsx` | 128 (`text-xs`) |
| `pages/admin/repairs/components/TechniciansTab.tsx` | 187 |
| `pages/admin/settings/components/storefront-settings.tsx` | 130 |
| `pages/admin/users/components/user-dialog.tsx` | 347 |
| `pages/admin/invoices/components/SupplierPaymentDialog.tsx` | 80 |
| `pages/admin/suppliers/components/supplier-modify-dialog.tsx` | 184, 217 (keep their ids), and **242**. At 242, also replace the hardcoded English with a key (F9): first grep `translations.json` for an existing "fix the errors" key and reuse it if found; otherwise add `admin.suppliers.modify.fixErrorsBeforeSave` (§7). |
| `pages/admin/inventory/components/adjustment-unit-cost-field.tsx` | 82 (`className="mt-1"`) |
| `pages/admin/inventory/components/adjustment-form.tsx` | 148, 151 |
| `pages/admin/sales/components/ReturnDialog.tsx` | 165, 192, 221 |
| `pages/admin/sales/components/ReturnWholeSaleDialog.tsx` | 159 |
| `pages/admin/clients/components/approval-dialog.tsx` | 87 |
| `pages/admin/supplier-invoices/components/quick-add-product-dialog.tsx` | 120, 152, 191 |
| `pages/admin/supplier-invoices/components/barcode-labels-dialog.tsx` | 268, 337 (337 has no `text-sm`; pass `className="text-base"` to keep its size) |
| `pages/admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx` | 330 |
| `pages/admin/products/components/product-details-section.tsx` | 54, 81 |
| `pages/admin/products/AdminProductsAdd.tsx` | 259, 291, 331, 357, 377, 391 |
| `pages/admin/products/components/enhanced-pricing-section.tsx` | 67, 92 |
| `pages/admin/orders/components/return-order-dialog.tsx` | 83, 112 |
| `pages/staff/repairs/components/RepairStatusDialog.tsx` | 141, 172, 200 |
| `pages/staff/repairs/components/RecordRepairPaymentDialog.tsx` | 58 |
| `pages/staff/repairs/components/IntakeDialog.tsx` | 116, 125, 243, 254 |
| `pages/staff/repairs/components/RepairPartsStaging.tsx` | 126, 129 |
| `pages/staff/pos/components/PosPaymentPanel.tsx` | 64 |
| `pages/staff/pos/components/PosClientAttachZone.tsx` | 93 |
| `pages/staff/pos/components/QuickAddPosClientDialog.tsx` | 61 |
| `pages/staff/invoices/components/RecordPaymentDialog.tsx` | 122 |
| `pages/staff/orders/components/OrderStatusDialog.tsx` | 135, 144, 172, 188 |
| `pages/staff/sales/components/SaleDetailDrawer.tsx` | 52 (the "forbidden" message) |

**Do not convert these `text-destructive` uses.** They are values, glyphs or destructive actions,
not error messages:
- `stock-levels-table.tsx` (low-stock values);
- `dashboard-stats-cards.tsx` (a negative trend);
- `purchased-product-documents-dialog.tsx` (return rows);
- `MarginDisplay`, `CreditMovementPreview`, `RepairTicketDetail:294` (signed amounts);
- the `Trash2` icons;
- `OrderActionsMenu`, `admin-product-actions` (destructive actions);
- `StatusBadge`;
- `SectionRetryChip` (already has an icon);
- `NotFoundState`, `ErrorBoundary`, `ProductErrorBoundary`, `components/error-boundary.tsx`
  (already have icons).

**Check after the swap:** `grep -rn 'className="text-sm text-destructive"' src` should return
nothing that renders an error message.

---

## §5 — Applying the accent

### Action 5.1 — create `Apps/web/src/components/shared/SectionTitle.tsx`

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// S37 — section/page title with the small highlight marker in front (plan-S37 §0.5: one of the
// few places the accent appears in admin/staff). The marker is decorative (aria-hidden).
// `align="center"` for the storefront's centered section headers.
export function SectionTitle({
  as: Tag = "h2",
  align = "start",
  className,
  children,
  id,
}: {
  as?: "h1" | "h2" | "h3";
  align?: "start" | "center";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn("flex items-center gap-2.5", align === "center" && "justify-center", className)}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[0.8em] w-1 shrink-0 rounded-full bg-highlight"
      />
      <span className="min-w-0">{children}</span>
    </Tag>
  );
}
```

### Action 5.2 — section-title markers

**Admin and staff:**
- `components/shared/PageHeader.tsx`: replace the `<h1 …>` with
  `<SectionTitle as="h1" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</SectionTitle>`.
  This covers the 17 pages that use `PageHeader`.
- These raw `<h1>`s become `<SectionTitle as="h1" className={<their existing classes>}>`:
  - `pages/admin/products/AdminProductsAdd.tsx:223`
  - `pages/admin/products/components/product-information-header.tsx:36`
  - `pages/admin/dashboard/AdminDashboard.tsx:29` (keep `id="dashboard-title"`)
  - `pages/admin/suppliers/components/supplier-information-header.tsx:69`
  - `pages/admin/clients/components/client-detail-header.tsx:36`
  - `pages/staff/products/StaffProducts.tsx:100`
  - `pages/staff/dashboard/StaffDashboard.tsx:34`
  - `pages/admin/settings/AdminSettings.tsx:379`. That `h1` is already `flex items-center gap-2`
    with an icon. Keep the icon after the marker.

**Storefront and client:**
- `<SectionTitle align="center" className={<existing h2 classes>}>`:
  - `components/sections/landing/categories-section.tsx:71`
  - `components/sections/landing/brands-section.tsx:177`
  - `components/sections/landing/products-section.tsx:69`
- `<SectionTitle as="h2" className="text-2xl font-bold">`:
  `pages/product-detail/components/RelatedProductsStrip.tsx:44`.
- `<SectionTitle as="h1" className={<existing classes>}>`:
  - `pages/products/components/ProductListHeader.tsx:58`
  - `pages/cart/Cart.tsx:100`
  - `pages/my-invoices/MyInvoices.tsx:49`
  - `pages/MyAccount.tsx:182`
  - `pages/Orders.tsx:70`
- **Not** the product name `h1` on `ProductDetails`: it's a product name, not a section title.
  **Not** `LoginPage` or the hero.

### Action 5.3 — active nav indicator (admin and staff)

- `components/layout/AdminSidebar.tsx`:
  - The top-level active class: `border-primary` → `border-highlight`. Keep
    `bg-primary-light text-primary border-l-4 -ml-1 pl-2`.
  - The child active class: `"bg-primary-light text-primary"` →
    `"bg-primary-light text-primary border-l-2 border-highlight rounded-l-none"`.
  - The group header (`text-primary` when a child is active) is unchanged.
- `components/layout/StaffSidebar.tsx`: `ACTIVE_CLASS`, `border-primary` → `border-highlight`.

Both navs also render inside the mobile Sheets of `AdminHeader` and `StaffHeader`, so phones are
covered.

### Action 5.4 — hover rings on interactive tiles and cards

Use this ring class string everywhere in this action:

`transition-shadow hover:ring-2 hover:ring-highlight focus-within:ring-2 focus-within:ring-highlight`

| File | Element | Change |
|---|---|---|
| `components/shared/ProductCard.tsx:83` | the `<Card>` | replace `hover:shadow-elegant` (a no-op, F5) with the ring classes. Keep the `product-card` lift. |
| `components/sections/landing/categories-section.tsx:81` | the family `<Card>` | same |
| `components/sections/landing/brands-section.tsx:43` | the `BrandCard` `<Card>` | same; drop the no-op `hover:shadow-elegant` |
| `pages/staff/pos/components/FamilyQuickPickGrid.tsx:31` | the tile button | `hover:bg-accent` → `hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight` |
| `pages/staff/pos/components/PosProductSearch.tsx:104` | the result tile button | same as the row above |

### Action 5.5 — storefront badges

In `components/shared/ProductCard.tsx` (badges block, about lines 108–122):
- **In cart:** `<Badge variant="highlight" className="text-xs">`. Drop the raw
  `bg-green-50 text-green-700 border-green-200`.
- **Out of stock:** `<Badge variant="highlightOutline" className="text-xs">`. On a light image
  tile it gets a translucent highlight tint with highlight text.

These are product markers, not order statuses (P8). Client order and invoice status badges stay
as they are.

### Action 5.6 — `components/shared/ThemeToggle.tsx`

Add `className="hover:bg-highlight/10 hover:text-highlight focus-visible:ring-highlight"` to the
`<Button>`. `cn` and twMerge in `Button` make it override the ghost variant's cyan
`hover:bg-accent hover:text-accent-foreground` (F2).

Add the comment:

```tsx
{/* S37 — the ghost hover is the app's cyan --accent; the toggle is one of the admin/staff
    places that carries the brand highlight instead (plan-S37 §0.5). */}
```

`ThemeToggle` is shared by `PublicHeader`, `AdminHeader` and `StaffHeader`, so all three update.

---

## §6 — Header, category bar, bottom nav and overflow

### Action 6.1 — `Apps/web/src/lib/deep-links.ts`

Append:

```ts
// S37 — the catalog filtered to one family (category bar, bottom-nav, home family tiles). Exact
// family match — a parent does NOT include its children's products (S37 Q1).
export const CATALOG_FAMILY_PARAM = "familyId";

export const catalogFamilyLink = (familyId: string): string =>
  `/products?${CATALOG_FAMILY_PARAM}=${encodeURIComponent(familyId)}`;
```

Then use it in `categories-section.tsx:82` in place of the inline template literal.

### Action 6.2 — create `Apps/web/src/types/storefront-nav.types.ts`

```ts
// S37 — router state the bottom nav's "Categories" item passes to /products. Kept out of the URL
// on purpose: the URL is the catalog's filter source of truth (Products.tsx), and "open the
// filter drawer" is a one-shot UI request, cleared as soon as Products reads it.
export interface CatalogLocationState {
  openFamilyFilter?: boolean;
}
```

### Action 6.3 — `Apps/web/src/hooks/useClientPortal.ts`

1. `useClientCart` gains an optional `enabled`:

   ```ts
   export function useClientCart(options: { enabled?: boolean } = {}) {
     return useQuery({
       queryKey: qk.clients.cart(),
       queryFn: clientsService.getCart,
       enabled: options.enabled ?? true,
     });
   }
   ```

   `Cart.tsx` calls it with no argument, so it is unchanged.

2. Add a hook below it:

   ```ts
   // S37 — the header/bottom-nav cart bubble. CLIENT sessions only (the cart endpoint is
   // CLIENT-scoped; a guest or staff session would 401/403). Same query key as the Cart page,
   // so adding/removing (which invalidates qk.clients.cart()) updates the bubble too.
   export function useCartCount(): number {
     const { data: session } = useSession();
     const { data } = useClientCart({ enabled: session?.type === UserType.CLIENT });
     return session?.type === UserType.CLIENT ? (data?.length ?? 0) : 0;
   }
   ```

   Import `useSession` from `@/hooks/useSession` and `UserType` from `@dragon-telecom/contract`,
   if they are not already imported.

### Action 6.4 — `Apps/web/src/components/shared/StorefrontSearch.tsx`

The header now mounts **one** search input. It sits inline on desktop and fills row 2 on phones
(Action 6.6). That removes the expand-in-place mobile mode.

1. Remove the `variant`, `onDone` and `autoFocus` props, and the `StorefrontSearchProps`
   interface. The component takes no props.
2. `reset()` no longer calls `onDone`.
3. Container class: `cn("relative", variant === "desktop" ? …)` → `"relative w-full min-w-0"`.
4. The `<Input>` gets `id={STOREFRONT_SEARCH_INPUT_ID}` (imported from `@/config/constants`),
   `type="search"`, `enterKeyHint="search"`, and `className="w-full pl-10 pr-9"`. Remove its
   `autoFocus`.
5. The X button now shows on every breakpoint, **only when `input` is non-empty**. Its aria-label
   becomes `t("header.clearSearch")` (new key). On click it calls `reset()`.
6. `formatDZD` → `formatPrice` (Action 2.4).
7. Rewrite the S15/R1 header comment's last two sentences. It is still a typeahead. It is now
   **one instance**, sitting inline on desktop and full-width on row 2 on phones (S37).

### Action 6.5 — create `Apps/web/src/components/shared/CartCountBubble.tsx`

```tsx
// S37 — the cart's count bubble (header on md+, bottom nav on phones). Filled highlight →
// highlight-foreground text, never text-white (dark-mode vermilion fails AA with white).
// Hidden at 0. Decorative: the parent link carries the count in its aria-label.
export function CartCountBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-bold leading-none text-highlight-foreground"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
```

### Action 6.6 — rewrite `Apps/web/src/components/layout/PublicHeader.tsx`

**Keep as they are:**
- the account dropdown (avatar, label, My account, My orders, the sign-out `AlertDialog`);
- the `useSession` / `useClientMe` / initials logic and its S15/F1 comment;
- `handleLogout`.

**Remove:**
- the burger `Sheet`, `mobileOpen`, `mobileSearchOpen`, `navLinks()` and `scrollToFooter` (P2);
- the imports that become unused (`Menu`, `Search`, `Sheet*`).

Leave the translation keys `header.menu`, `header.contact`, `header.openSearch` and
`header.closeSearch` in the JSON (harmless).

**New structure.** The single `StorefrontSearch` reflows between the two layouts with flex `order`,
so it is never mounted twice:

```tsx
<header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-md">
  <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:h-16 md:flex-nowrap md:gap-4 md:py-0">
    {/* row 1 left */}
    <Link to="/" className="order-1 flex min-w-0 shrink items-center" aria-label={t("header.home")}>
      <Logo size={32} textClassName="hidden min-[380px]:inline" />
    </Link>

    {/* phones: own full-width row 2 · md+: inline, grows */}
    <div className="order-3 w-full basis-full md:order-2 md:mx-4 md:w-auto md:max-w-2xl md:flex-1 md:basis-auto">
      <StorefrontSearch />
    </div>

    {/* row 1 right */}
    <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3 md:ml-0">
      <LanguageToggle />
      <ThemeToggle />
      {/* cart: md+ only — on phones it lives in the bottom nav */}
      <Button variant="ghost" size="icon" asChild className="relative hidden md:inline-flex"
              aria-label={t("header.cartWithCount", { count: cartCount })}>
        <Link to="/cart"><ShoppingCart className="h-5 w-5" aria-hidden="true" /><CartCountBubble count={cartCount} /></Link>
      </Button>
      {isAuthenticated ? <AccountDropdown …existing JSX… /> : (
        <>
          <Button variant="ghost" size="icon" asChild className="md:hidden" aria-label={t("auth.login.submit")}>
            <Link to="/login"><UserIcon className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link to="/login">{t("auth.login.submit")}</Link>
          </Button>
        </>
      )}
    </div>
  </div>
  <StorefrontCategoryBar />  {/* Action 6.7; renders `hidden md:block` itself */}
</header>
```

- `cartCount` comes from `useCartCount()` (Action 6.3).
- The account dropdown JSX is the existing block, moved and not changed.
- Header z-index stays `z-30`. It must stay below Sheets, Dialogs and Drawers (`z-50`).

**`Apps/web/src/components/shared/Logo.tsx`:**
- Add an optional `textClassName?: string` prop, merged with `cn` into the text `<span>`'s class.
- At 320–379px, only the mark shows. That keeps row 1 within a 320px viewport.
- The text is still the hardcoded "Dragon Telecom". S38 changes it to the store-name setting, so
  leave it.

### Action 6.7 — create `Apps/web/src/components/layout/StorefrontCategoryBar.tsx`

**Data:**
- `useCatalogFamilies()` (public, enabled only, sorted by name by the API). It shares the cache
  with the catalog filter's call.
- Build the tree in a `useMemo`:
  - `tops` = families with no `parentId`;
  - `childrenByParent` = `Map<parentId, FamilyDto[]>`;
  - a child whose parent isn't in the list is **skipped** (P7).
- While loading, and on error, render only the "All products" link. The bar never shows an error
  state.

**Active state.** Read `useLocation()` and `useSearchParams()`:
- **All products** is active when `pathname === "/products"` and there is no `familyId` param.
- **A top family** is active when the `familyId` param equals its id or one of its children's ids.
- **A child entry** in a dropdown is active when the param equals its id.

**Markup** (`hidden md:block`, a desktop-only second header row):

```tsx
<nav aria-label={t("header.categoryBar")} className="hidden border-t border-border md:block">
  <ul className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 px-4">
    <li><Link to="/products" className={itemClass(allActive)}>{t("header.allProducts")}</Link></li>
    {tops.map((family) => {
      const kids = childrenByParent.get(family.id) ?? [];
      return (
        <li key={family.id} className="group relative">
          <Link to={catalogFamilyLink(family.id)} className={itemClass(isTopActive(family, kids))}
                aria-haspopup={kids.length > 0 ? "true" : undefined}>
            {family.name}
            {kids.length > 0 && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          </Link>
          {kids.length > 0 && (
            <div className="invisible absolute left-0 top-full z-40 min-w-48 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul aria-label={t("header.subFamiliesOf", { name: family.name })}
                  className="rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                {kids.map((child) => (
                  <li key={child.id}>
                    <Link to={catalogFamilyLink(child.id)} className={cn(
                      "block rounded-sm px-3 py-1.5 text-sm hover:bg-muted",
                      paramFamilyId === child.id && "font-semibold text-foreground")}>{child.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      );
    })}
  </ul>
</nav>
```

Where:

```ts
const itemClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
    active
      ? "border-highlight text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
```

**Notes:**
- `invisible` (not `hidden`) plus `group-focus-within` makes the dropdown keyboard-reachable. Tab
  onto the parent link opens it, and the child links become tabbable.
- Don't add `overflow-x-auto` to the `<ul>`: it would clip the absolutely positioned dropdowns.
  Many families wrap onto a second line instead.
- `hover:bg-muted`, not `hover:bg-accent` (cyan).

**Header comment:**

```tsx
// S37 — desktop category bar: top-level families, each with a hover/focus dropdown of its child
// families (one nesting level, catalog.service assertOneNestingLevel). Links are exact-match
// family filters (Q1). Children of a disabled parent don't surface (S21 Q5 / plan-S37 P7).
```

### Action 6.8 — create `Apps/web/src/components/layout/StorefrontBottomNav.tsx`, plus config

**`Apps/web/src/config/nav-links.ts`.** Append, and import `Home`, `LayoutGrid`, `User` from
lucide; `Search` and `ShoppingCart` are already imported:

```ts
// S37 — storefront mobile bottom nav (phones only, md:hidden). Order is the set's: Home,
// Categories, Search, Cart, Account. Behaviour per key lives in StorefrontBottomNav.
export const StorefrontBottomNavKey = {
  HOME: "home",
  CATEGORIES: "categories",
  SEARCH: "search",
  CART: "cart",
  ACCOUNT: "account",
} as const;
export type StorefrontBottomNavKey =
  (typeof StorefrontBottomNavKey)[keyof typeof StorefrontBottomNavKey];

export const STOREFRONT_BOTTOM_NAV: { key: StorefrontBottomNavKey; labelKey: string; icon: LucideIcon }[] = [
  { key: StorefrontBottomNavKey.HOME, labelKey: "storefront.bottomNav.home", icon: Home },
  { key: StorefrontBottomNavKey.CATEGORIES, labelKey: "storefront.bottomNav.categories", icon: LayoutGrid },
  { key: StorefrontBottomNavKey.SEARCH, labelKey: "storefront.bottomNav.search", icon: Search },
  { key: StorefrontBottomNavKey.CART, labelKey: "storefront.bottomNav.cart", icon: ShoppingCart },
  { key: StorefrontBottomNavKey.ACCOUNT, labelKey: "storefront.bottomNav.account", icon: User },
];

// Pages the Account item counts as "active" for (account area + auth screens).
export const STOREFRONT_ACCOUNT_PATHS = ["/my-account", "/orders", "/invoices", "/login", "/register"];
```

**The component.**

Behaviour per key:

| Key | Action | Active when |
|---|---|---|
| HOME | `<Link to="/">` | `pathname === "/"` |
| CATEGORIES | button: `navigate({ pathname: "/products", search: pathname === "/products" ? location.search : "" }, { state: { openFamilyFilter: true } satisfies CatalogLocationState })` (P6) | `pathname.startsWith("/products")` |
| SEARCH | button: `document.getElementById(STOREFRONT_SEARCH_INPUT_ID)?.focus()`. The header is sticky, so the input is on screen. | never (it is an action) |
| CART | `<Link to="/cart">` with `<CartCountBubble count={cartCount} />` on the icon wrapper. `aria-label={t("header.cartWithCount", { count })}`. A guest is sent to `/login` by the existing `RoleGuard`. | `pathname === "/cart"` |
| ACCOUNT | `<Link>` to the session's home (P5): CLIENT `/my-account`, ADMIN `/admin`, STAFF `/staff`, none `/login`. Use the `UserType` enum. | `STOREFRONT_ACCOUNT_PATHS.some(p => pathname.startsWith(p))` |

Markup:

```tsx
<nav
  data-storefront-bottom-nav=""
  aria-label={t("storefront.bottomNav.label")}
  className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
>
  <ul className="grid h-[var(--bottom-nav-height)] grid-cols-5">
    {/* each item: */}
    <li className="min-w-0">
      <… className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
          active ? "text-foreground" : "text-muted-foreground")}
         aria-current={active ? "page" : undefined}>
        <span className="relative"><Icon className="h-5 w-5" aria-hidden="true" />{/* bubble for CART */}</span>
        <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
        {active && <span aria-hidden="true" className="absolute bottom-1.5 h-0.5 w-6 rounded-full bg-highlight" />}
      </…>
    </li>
  </ul>
</nav>
```

**Layering:**
- `z-40` keeps the bar **above page content and the header's search dropdown**, and **below every
  overlay**: Sheet, Dialog, AlertDialog and Drawer are all `z-50` with a `bg-black/80` overlay,
  so an open filter Sheet or dialog covers the bar.
- Do not raise it.

**Header comment:** what the bar is, P5, P6, and the `z-40` reasoning above.

### Action 6.9 — `Apps/web/src/components/layout/PublicLayout.tsx` and `Apps/web/src/main.tsx`

- `PublicLayout`:
  - The root div becomes
    `className="flex min-h-screen flex-col bg-background pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-0"`.
    The padding is on the **root**, not `<main>`, so the footer's last line also clears the bar.
  - Render `<StorefrontBottomNav />` after `<PublicFooter />`.
  - Add a one-line comment on the padding.
- `main.tsx`: the Toaster becomes:

  ```tsx
  <Toaster
    richColors
    position="bottom-right"
    // S37 — clear the storefront bottom nav on phones; --bottom-nav-offset is 0 everywhere else
    // (index.css), so admin/staff toasts sit exactly where they did.
    offset={{ bottom: "calc(var(--bottom-nav-offset) + 24px)", right: "24px" }}
    mobileOffset={{ bottom: "calc(var(--bottom-nav-offset) + 16px)" }}
  />
  ```

  Sonner 2.0.7 accepts string offsets and writes them as CSS variables on its list element, which
  inherits `--bottom-nav-offset` from `body`.
  - **If `tsc` rejects the object form**, use `offset="24px"`, and set
    `mobileOffset={{ bottom: "calc(var(--bottom-nav-offset) + 16px)" }}` only.
  - **Read `node_modules/sonner/dist/index.d.ts` first**, and say in the report which form you
    used.

### Action 6.10 — `Apps/web/src/pages/Products.tsx` and `pages/products/components/ProductFilters.tsx`

**`ProductFilters.tsx`:**
1. Add optional props `sheetOpen?: boolean` and `onSheetOpenChange?: (open: boolean) => void`.
   Keep the internal `useState` as a fallback: `const open = sheetOpen ?? internalOpen`, and
   `const setOpen = onSheetOpenChange ?? setInternalOpen`. `handleClearFilters` uses `setOpen(false)`.
2. P1 breakpoint: the trigger `sm:hidden` → `md:hidden`; the inline panel `hidden sm:block` →
   `hidden md:block`.
3. Update the two comments that say "mobile (< sm)" / "Desktop-only" to say `< md`, and cite S37 P1.

**`Products.tsx`:**

```ts
const location = useLocation();
const navigate = useNavigate();
const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

// S37 P6 — the bottom nav's "Categories" item lands here with { openFamilyFilter: true } in
// router state: open the filter drawer once, then drop the state (replace) so Back/refresh
// doesn't reopen it. Keyed on location.key: tapping Categories again while already here pushes
// a new entry, so it reopens.
useEffect(() => {
  const state = location.state as CatalogLocationState | null;
  if (!state?.openFamilyFilter) return;
  setFiltersSheetOpen(true);
  navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key]);
```

Pass `sheetOpen={filtersSheetOpen}` and `onSheetOpenChange={setFiltersSheetOpen}` to
`<ProductFilters>`. Only add the eslint-disable comment if the repo's lint config actually flags
the dependency list. Check by running eslint on the file.

### Action 6.11 — horizontal-overflow audit (no masking, P10)

The header rewrite (6.6) removes the main cause (F4). Fix these confirmed or likely causes as well:

| File | Problem | Fix |
|---|---|---|
| `pages/Index.tsx:17` | `Skeleton h-4 w-96` (384px) while loading | `w-full max-w-96` |
| `components/sections/landing/categories-section.tsx:25` | same | `w-full max-w-96` |
| `components/sections/landing/brands-section.tsx:136` | same | `w-full max-w-96` |
| `pages/products/components/ProductListHeader.tsx:44` | same | `w-full max-w-96` |
| `pages/MyAccount.tsx:130` | `Skeleton w-72` | `w-full max-w-72` |
| `pages/ProductDetails.tsx:158` | the product-name `h1`: a long unbroken token (a model code or barcode-like name) forces width | add `break-words [overflow-wrap:anywhere]` |
| `components/shared/OrderCard.tsx:118-150` | `flex justify-between`: the left column has no `min-w-0`, and the joined line list can't shrink | left column `min-w-0 flex-1`; right column `shrink-0`; the line-list `<span>` gets `break-words` |
| `components/shared/OrderCard.tsx:186-190` | the line row `flex justify-between` | add `gap-3`; the name span `min-w-0 break-words`; the amount span `shrink-0 whitespace-nowrap` |

Then **read every file under `components/layout/Public*`, `components/sections/`,
`pages/{Index,Products,ProductDetails,Cart,Orders,MyAccount,Register,LoginPage}.tsx`,
`pages/{cart,my-invoices,order-confirmation,product-detail,products}/`** looking for:
- **(a)** a flex child holding user/DB text (a product name, email, reference, address) without
  `min-w-0`. Add `min-w-0`, plus `truncate` or `break-words` as the design wants;
- **(b)** any fixed width above `w-80` (20rem) or `min-w-[…]` not inside an `overflow-x-auto`
  wrapper;
- **(c)** `whitespace-nowrap` on long text.

Fix each case at its cause and list each one in the report.
- The hero (`hero-section.tsx`) is rebuilt by S38. Only fix it if it overflows at 320px, and say
  so.
- `InvoiceView`'s `min-w-[420px]` table is already inside `overflow-x-auto`. That is fine.

---

## §7 — Translation keys (`Apps/web/src/config/translations.json`)

Add these keys. Each keeps the file's shape: `{ "en": …, "fr": …, "ar": "" }` (Q2). First grep
for an existing key with the same meaning and reuse it if one exists; list any reuse in the
report.

| Key | en | fr |
|---|---|---|
| `header.allProducts` | All products | Tous les produits |
| `header.categoryBar` | Product categories | Catégories de produits |
| `header.subFamiliesOf` | Subcategories of {name} | Sous-catégories de {name} |
| `header.cartWithCount` | Cart ({count} items) | Panier ({count} articles) |
| `header.clearSearch` | Clear search | Effacer la recherche |
| `storefront.bottomNav.label` | Shop navigation | Navigation de la boutique |
| `storefront.bottomNav.home` | Home | Accueil |
| `storefront.bottomNav.categories` | Categories | Catégories |
| `storefront.bottomNav.search` | Search | Rechercher |
| `storefront.bottomNav.cart` | Cart | Panier |
| `storefront.bottomNav.account` | Account | Compte |
| `admin.suppliers.modify.fixErrorsBeforeSave` (F9; only if no equivalent exists) | Please fix the errors above before saving. | Veuillez corriger les erreurs ci-dessus avant d'enregistrer. |

---

## §8 — Files touched (summary for the report)

**Created:**
- `lib/price-format.ts`
- `components/shared/FieldError.tsx`
- `components/shared/SectionTitle.tsx`
- `components/shared/CartCountBubble.tsx`
- `components/layout/StorefrontCategoryBar.tsx`
- `components/layout/StorefrontBottomNav.tsx`
- `types/storefront-nav.types.ts`

**Edited, infrastructure:**
- `index.css`, `tailwind.config.ts`, `index.html`, `main.tsx`
- `components/ui/badge.tsx`, `components/ui/form.tsx`
- `config/constants.ts`, `config/nav-links.ts`, `config/translations.json`
- `lib/i18n.ts`, `lib/utils.ts` (comment only), `lib/deep-links.ts`
- `components/providers/LanguageProvider.tsx`
- `hooks/useClientPortal.ts`

**Edited, layout and storefront:**
- `PublicLayout`, `PublicHeader`, `Logo`, `StorefrontSearch`, `ThemeToggle`
- `AdminSidebar`, `StaffSidebar`, `PageHeader`
- `ProductCard`, `OrderCard`, `CancelOrderDialog`, `OrderPlacementSection`, `MoneyStatusCard`
- `ProductPricingSection`, the 3 landing sections, `RelatedProductsStrip`
- `Products`, `ProductFilters`, `ProductListHeader`, `ProductDetails`, `Index`
- `Cart`, `CartItemRow`, `Orders`, `MyAccount`, `MyInvoices`
- the client `InvoicesTable` and `InvoiceView`, `OrderConfirmationBody`

**Edited, `FieldError` swap and title markers:** the files listed in Actions 4.3 and 5.2.

**Edited, POS tiles:** `FamilyQuickPickGrid`, `PosProductSearch`.

**Not touched:**
- the API, the contract, Prisma;
- `formatDZD` callers in admin, staff and POS;
- `ResolvedVsChargedPrice`;
- the hero markup (S38) and the footer (S38).

---

## §9 — Manual verification checklist (owner, in the browser)

**Set-up:**
- Clear `localStorage` (`sv_lang`, `app_theme`) once, to see first-visit behaviour.
- Use DevTools device mode. "Phone" means **iPhone SE (375px)**, plus one pass at a custom
  **320px** width. "Desktop" means **≥ 1280px**.
- Run **every** section in **light and dark**. The toggle is in the header.

### A. Default language
1. With `localStorage` cleared, open `/`. The UI is **French**, and DevTools shows `<html lang="fr">`.
2. Switch to English. The UI turns English and `<html lang="en">`. Reload: it stays English.
3. Switch back to French.

### B. Highlight token and contrast
1. **Light:** the cart bubble is **scarlet with white digits**.
2. **Dark:** the bubble is **vermilion with near-black digits**, not white.
3. Primary buttons (Login, "Commander", Save in admin) are still **blue** in both themes.
4. Hover any ghost icon button other than the theme toggle, for example the language switch or
   the admin avatar. The hover tint is unchanged.
5. Hover the **theme toggle** (storefront, admin, staff). It shows a faint scarlet/vermilion tint
   with a highlight icon. **No cyan.**

### C. Price format (storefront and client only)
1. Phone and desktop. Each of these shows `3 200 DA` style, with a space as thousands separator,
   `DA` suffix, and no `DZD`, comma or `,00`:
   - the home featured products;
   - the catalog cards;
   - the header search dropdown;
   - the product page (unit price and total);
   - Cart (row price, row total, subtotal, delivery, total);
   - order confirmation;
   - My orders (card total, expanded lines, the cancel dialog);
   - My account → Billing (the three amounts);
   - My invoices (list and one invoice).
2. Resize to 320px. A price never breaks across two lines between its digits.
3. **Back-office unchanged:** `/admin/sales`, `/staff/pos`, `/admin/invoices`, a printed receipt
   and an invoice PDF all still show their previous format (`… DZD`).

### D. Error icons
1. `/register`: submit empty. Every field error shows a **red circle-alert icon** before the text,
   in both themes.
2. `/login` with a wrong password: the banner and the field errors each carry an icon.
3. Admin → Products → Add: submit empty. The field errors have icons. On a shadcn `<Form>` dialog
   (for example a client-category dialog in Settings), the errors have icons too.
4. Admin → Suppliers → edit a supplier with an invalid value. The bottom "fix the errors" line is
   translated (switch FR/EN) and has an icon.
5. Error toasts (trigger any failed save) still show Sonner's icon.

### E. Accent placement (admin and staff restriction)
1. Admin sidebar, desktop and the mobile Sheet: the active item's **left bar is scarlet/vermilion**,
   and its background is still the light blue tint. Open a group and check that the active child
   shows a thin highlight left bar.
2. Staff sidebar: same.
3. Admin page titles (Products, Orders, Statistics, Dashboard, Settings, a product or supplier or
   client detail) have a **small highlight bar** before the title. So do the staff Dashboard and
   Products.
4. **Status badges are unchanged:** admin Orders, Sales, Invoices and Repairs still use
   green/amber/grey/red. Nothing turned highlight.
5. POS: hover a family quick-pick tile and a product search result. A **highlight ring** appears,
   with no cyan fill.

### F. Storefront accent
1. Home, desktop: hovering a family tile, a brand tile or a product card shows a **highlight
   ring**. Section titles ("Catégories", "Marques", featured products) have the marker bar,
   centered with the text.
2. Catalog and product page: an out-of-stock product shows an **outlined highlight badge**. A
   product in a client's cart shows a **filled highlight badge**. Check both themes and read the
   text in dark mode.
3. My orders: the order status badges are still semantic (green, amber, red).

### G. Desktop header and category bar (≥ 1280px)
1. Row 1 holds the logo, a **wide search bar**, the language switch, the theme toggle, the cart,
   and the account control. The guest sees a "Se connecter" button.
2. Sign in as a client with items in the cart. The **bubble shows the count**. Add or remove a
   product (heart): the count updates without a reload. With more than 9 items it shows "9+".
3. Below the header, the **category bar** shows "Tous les produits" followed by each top-level
   family.
4. In Admin → Settings → Hierarchy, nest one family under another. Back on the storefront, hover
   the parent: a **dropdown lists the child**. Tab to the parent with the keyboard: the dropdown
   opens and the child is reachable by Tab.
5. Click a family. The catalog filters to it, and that family has the **highlight underline**.
   "Tous les produits" is underlined when no family is selected.
6. Click a parent whose products are all under its child: an empty catalog page (Q1, expected).
7. Disable a parent family in Settings. Its child does not appear in the bar (P7).
8. The header stays sticky on scroll, and the dropdown appears above page content.

### H. Phone header, bottom nav and overflow (375px and 320px)
1. Row 1 holds the logo (the mark only at 320px), language, theme, and account (an icon for a
   guest). Row 2 is a **full-width search bar**. There is no burger menu.
2. **No horizontal scroll** on any of these: `/`, `/products`, a product page, `/login`,
   `/register`, `/cart`, `/orders`, `/my-account`, `/invoices`, one invoice, and the order
   confirmation. Check each at 320 and 375, while loading and loaded. Swipe sideways: nothing
   moves.
3. To find any offender, paste this in the console. It must print `[]`:

   ```js
   [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.outerHTML.slice(0, 120))
   ```

4. The **bottom nav** shows Accueil, Catégories, Rechercher, Panier, Compte. The current page's
   item carries the **highlight underline**: Home on `/`, Categories on `/products` and on a
   product page, Cart on `/cart`, Account on `/my-account`, `/orders` or `/login`.
5. **Catégories:** from the home page, the catalog opens with the **filter drawer already open**.
   Close it, then press Back: it doesn't reopen. On `/products?familyId=…`, tap Catégories again:
   the drawer reopens and the filter is kept.
6. **Rechercher:** the header search gets focus and the keyboard opens.
7. **Panier**, signed in as a client: the bubble shows the count. As a guest: it leads to login.
8. **Compte:** client → My account; guest → login; signed-in admin → `/admin`; signed-in staff →
   `/staff`.
9. Scroll to the bottom of the home page: the footer's last line is **fully visible above the
   bar**.
10. Open the catalog filter drawer, a product image dialog, and the sign-out confirm dialog. Each
    **covers the bar**: the bar is not above the overlay.
11. Trigger a toast (add a product to the cart as a client). It appears **above the bar**, not
    over it. In admin on a phone, toasts sit at their old position.
12. On a real iPhone, or with a safe-area simulation, the bar sits above the home indicator.
13. At 700px (tablet portrait), the bottom nav and two-row header still show, and the catalog
    filters are behind the drawer button (P1). At 768px and above, the desktop header and category
    bar appear, and the bottom nav is gone.

---

## §10 — Execution protocol

Execute this set, then write `Docs/Stage-04-Fixes/results/report-S37.md`. It covers:
- what changed, file by file;
- the findings (F1–F10) and the decisions (P1–P10) as applied;
- every overflow cause found in Action 6.11;
- which Sonner offset form was used;
- any translation key reused instead of added;
- the gate results (§0.6).

End the report with the verification checklist above. The owner reviews and approves before S38
begins.
