# Report S37 — Accent token, price format & storefront navigation

Status: **executed, gates green, awaiting owner review.** Plan: `Docs/Stage-04-Fixes/plans/plan-S37-accent-price-format-navigation.md`.
Frontend only: no Prisma, contract or API change, no migration. Nothing committed.
**Not verified by me:** every visual and behavioural item below. There is no browser here, so the
owner checklist at the end is the only check of the UI.

---

## 1. What changed

### 1.1 Highlight token (§1)

- `index.css`: `--highlight` and `--highlight-foreground` in `:root` (scarlet) and `.dark` (vermilion).
  The values are the plan's OKLCH conversions of the set's HSL, because every color in this file
  is an OKLCH triple. `--accent` (the cyan hover tint) is untouched.
- `index.css`: `--bottom-nav-height: 4rem`, and `--bottom-nav-offset`. The offset is 0 by default.
  A `body:has([data-storefront-bottom-nav])` rule sets it to the bar height plus the safe-area
  inset, back to 0 from 768px up.
- `tailwind.config.ts`: `highlight` / `highlight-foreground` colors, giving `bg-`, `text-`,
  `border-` and `ring-highlight` and their `/alpha` forms.
- `ui/badge.tsx`: `highlight` (filled) and `highlightOutline` variants. Both are for storefront
  markers only.

### 1.2 Price format (§2)

- New `lib/price-format.ts` → `formatPrice(amount)`:
  - output is `3 200 DA`, with a no-break space as the thousands separator and before `DA`;
  - decimals appear only when there are cents, comma separated;
  - the format is the same in both languages.
- New constants `PRICE_CURRENCY_SUFFIX` and `STOREFRONT_SEARCH_INPUT_ID` in `config/constants.ts`.
- `formatPrice` replaces `formatDZD` or an inline `toLocaleString() + " DA"` in the 11 storefront
  and client files:
  - `ProductCard`
  - `StorefrontSearch`
  - `ProductPricingSection` (2)
  - `OrderPlacementSection` (5)
  - `CartItemRow` (2)
  - `OrderCard` (5)
  - `CancelOrderDialog`
  - `OrderConfirmationBody` (2)
  - client `InvoicesTable` (4) and `InvoiceView` (5) — Q3
  - `MoneyStatusCard` (3 amounts, plus their aria-labels)
- **Untouched on purpose:**
  - `formatDZD` and its `"en"` default (only a comment was added);
  - `ResolvedVsChargedPrice`, which is staff-only;
  - the staff `InvoicesTable`.
- The plan's grep gate over the storefront tree returns nothing.

### 1.3 French default (§3)

- `lib/i18n.ts`: `DEFAULT_LANGUAGE = "fr"`. `getLanguage()` falls back to it unless `sv_lang` is `"en"`.
- `LanguageProvider`: initial state is `DEFAULT_LANGUAGE`, and `<html lang>` now follows the language.
- `index.html`: `lang="fr"`, and `viewport-fit=cover` (needed for `env(safe-area-inset-bottom)` on iOS).
- The `ar` union, `dirForLanguage`, the `dir` effect and the `"ar": ""` fields are untouched (Q2).

### 1.4 Error icons (§4)

- New `components/shared/FieldError.tsx`: an `AlertCircle` icon plus text, `role="alert"`, and
  nothing rendered for an empty message.
- `ui/form.tsx` `FormMessage` shows the icon when it renders a validation error (not for helper
  text).
- **74 hand-rolled `<p class="… text-destructive">` field errors in 34 files** were converted to
  `<FieldError>`, preserving their `id`, size and spacing. This is a scripted conversion that
  matched exactly the plan's table (per-file counts agree).
- F9: `supplier-modify-dialog.tsx` had a hardcoded English line. It now uses
  `t("admin.suppliers.formErrors")`, an existing key with the same meaning, so no new key was added.
- Not converted, as the plan lists: signed amounts, trend colors, trash icons, destructive actions,
  and components that already carry an icon.

### 1.5 Accent placement (§5)

- New `components/shared/SectionTitle.tsx`: the title with a small highlight marker bar.
- Applied to:
  - `PageHeader` (17 admin/staff pages);
  - 7 raw admin/staff `h1`s (`AdminSettings` keeps its icon next to the title);
  - the storefront/client titles: the 3 home sections, related products, the catalog header, Cart,
    My invoices, My account and My orders.
- Not applied to the product-name `h1`, `LoginPage` or the hero.
- Active nav indicator:
  - `AdminSidebar`: the top-level left bar is `border-highlight`; active children get a thin
    highlight left bar;
  - `StaffSidebar`: its left bar is `border-highlight`.
- Hover rings (`hover:ring-2 hover:ring-highlight`, plus `focus-within` on cards):
  - `ProductCard`, the home family tile and brand tile;
  - the POS `FamilyQuickPickGrid` and `PosProductSearch` tiles, which lost their cyan fill.
- `ProductCard` badges: "in cart" is the filled `highlight` badge, "out of stock" the
  `highlightOutline` one.
- `ThemeToggle`: hover is a highlight tint with a highlight icon, overriding the cyan ghost hover.

### 1.6 Header, category bar, bottom nav (§6)

- New `hooks/useClientPortal.ts` additions:
  - `useClientCart({ enabled })`, with an optional flag; `Cart.tsx` calls it unchanged;
  - `useCartCount()`, enabled for CLIENT sessions only, sharing the cart query key so the bubble
    updates when the cart changes.
- New `CartCountBubble`: highlight fill with `highlight-foreground` text, hidden at 0, "9+" above 9.
- `StorefrontSearch`: one instance, no props, with `id=STOREFRONT_SEARCH_INPUT_ID`, `type="search"`
  and a clear button that shows when there is text. The clear button reuses
  `common.actions.clearSearch`.
- `PublicHeader` rewritten:
  - phones: row 1 is logo, language, theme and account; row 2 is a full-width search;
  - md+: logo, wide search, then the icon group with the cart and its bubble;
  - the burger menu and the Home/Products/Contact text links are removed (P2);
  - `Logo` gained `textClassName`, so only the mark shows below 380px.
- New `StorefrontCategoryBar` (md+): "All products" plus the top-level families, each with a
  hover/focus dropdown of its children. The links are exact family matches (Q1). The active item
  gets the highlight underline. Children of a disabled parent are skipped (P7).
- New `StorefrontBottomNav` (phones, `z-40`), with `STOREFRONT_BOTTOM_NAV` config in `nav-links.ts`:
  - Home / Categories / Search / Cart / Account;
  - Categories opens `/products` with `{ openFamilyFilter: true }` router state;
  - Account routes by session type: CLIENT `/my-account`, ADMIN `/admin`, STAFF `/staff`, guest `/login`.
- `PublicLayout`: pads the page bottom by the bar height plus the safe-area inset (phones only)
  and mounts the bar.
- `main.tsx`: toast offset is `calc(var(--bottom-nav-offset) + 24px)` (desktop) and `+ 16px` (mobile).
- Catalog: `ProductFilters` takes optional `sheetOpen` / `onSheetOpenChange`, and its Sheet
  breakpoint moved `sm` → `md` (P1). `Products.tsx` opens the Sheet once from the router state, then
  clears the state with a `replace` navigation. The `eslint-disable` on that effect follows the
  file's existing convention (it already had three).
- New `catalogFamilyLink()` in `lib/deep-links.ts`, also used by the home family tiles.
- New type `types/storefront-nav.types.ts`.

### 1.7 Translation keys added (10)

`header.allProducts`, `header.categoryBar`, `header.subFamiliesOf`, `header.cartWithCount`,
`storefront.bottomNav.{label,home,categories,search,cart,account}`. Each has `en`, `fr` and
`"ar": ""`.

Reused instead of added:
- `common.actions.clearSearch` (the plan proposed a new `header.clearSearch`);
- `admin.suppliers.formErrors` (the plan proposed a new `admin.suppliers.modify.fixErrorsBeforeSave`).

---

## 2. Findings and decisions as applied

- **F1–F10** hold as written in the plan. Two corrections from execution:
  - F7: confirmed. `FormMessage` and the hand-rolled errors were the only icon-less errors.
  - F10: **used the object form** of Sonner's `offset` / `mobileOffset`, setting only `bottom`.
    I read `node_modules/sonner/dist/index.mjs`: unset keys fall back to the library's own
    24px / 16px defaults, so right/left/top are unchanged.
- **P1–P10** applied as written.
- Overflow causes fixed at their source (no `overflow-x: hidden`, per P10):

  | Where | Cause | Fix |
  |---|---|---|
  | `PublicHeader` | about 500px of non-shrinking controls on one row | two-row header, burger and text links removed, wordmark hidden below 380px |
  | `Index`, `categories-section`, `brands-section`, `ProductListHeader` skeletons | `w-96` (384px) | `w-full max-w-96` |
  | `MyAccount` skeleton | `w-72` | `w-full max-w-72` |
  | `ProductDetails` `h1` | a long unbroken product name | `break-words [overflow-wrap:anywhere]` |
  | `ProductDetails` brand/model row | no wrap | `flex-wrap` |
  | `OrderCard` header | the left column had no `min-w-0`, and the joined line list could not shrink | `min-w-0 flex-1`, `shrink-0` on the total, `break-words` on the lines, `flex-wrap` on reference + badge |
  | `OrderCard` line rows | name and amount competed | `gap-3`, `min-w-0 break-words` on the name, `shrink-0 whitespace-nowrap` on the amount |
  | `OrderConfirmationBody` rows | long names, phones or references forced width | `gap-3`, `shrink-0` labels, `min-w-0 break-words` values |
  | `InvoiceView` header | long invoice number, client name or address | `min-w-0`, `break-words` |
  | `hero-section` | at 320px only ~224px of content width: the nowrap French CTA ("Parcourir les Produits", ~270px) and "Technologie" at 36px overflow | gutters trimmed on phones (`px-4 sm:px-8`, inner `px-0 sm:px-4`). S38 rebuilds this section; this is only the overflow fix. |

  The hero is the one place I fixed from arithmetic on the copy, not from a measured overflow.
  The owner checklist should confirm it.

---

## 3. Validation gate

| Gate | Result |
|---|---|
| web `tsc --noEmit` | **clean** |
| web `tsc --noEmit -p tsconfig.test.json` | **53 errors**, identical to the S36 baseline (no test file touched or run) |
| eslint on the 86 touched + 7 created web files | **0 new errors.** 197 errors across the set (HEAD: 209 on the same files), 4 warnings. No file has more errors than at HEAD, and the 7 new files are clean. Everything left is pre-existing Prettier noise (single-quote files such as `MyAccount`, `Register`, `brands-section`, `supplier-modify-dialog`), which I did not reformat. |

---

## 4. Manual verification checklist (owner, in the browser)

**Set-up:**
- Clear `localStorage` (`sv_lang`, `app_theme`) once, to see first-visit behaviour.
- Use DevTools device mode. "Phone" means **iPhone SE (375px)**, plus one pass at a custom
  **320px** width. "Desktop" means **≥ 1280px**.
- Run **every** section in **light and dark**.

### A. Default language
1. With `localStorage` cleared, open `/`. The UI is **French**, and DevTools shows `<html lang="fr">`.
2. Switch to English: the UI turns English and `<html lang="en">`. Reload: it stays English.
3. Switch back to French.

### B. Highlight token and contrast
1. **Light:** the cart bubble is **scarlet with white digits**.
2. **Dark:** the bubble is **vermilion with near-black digits**, not white.
3. Primary buttons (Login, "Commander", Save in admin) are still **blue** in both themes.
4. Hover any ghost icon button other than the theme toggle (the language switch, the admin avatar):
   the hover tint is unchanged.
5. Hover the **theme toggle** (storefront, admin, staff): a faint scarlet/vermilion tint with a
   highlight icon. **No cyan.**

### C. Price format (storefront and client only)
1. Phone and desktop. Each of these shows `3 200 DA`, with a space as thousands separator, a `DA`
   suffix, and no `DZD`, comma or `,00`:
   - home featured products;
   - catalog cards;
   - the header search dropdown;
   - the product page (unit price and total);
   - Cart (row price, row total, subtotal, delivery, total);
   - order confirmation;
   - My orders (card total, expanded lines, the cancel dialog);
   - My account → Billing (the three amounts);
   - My invoices (list and one invoice).
2. At 320px a price never breaks between its digits.
3. **Back-office unchanged:** `/admin/sales`, `/staff/pos`, `/admin/invoices`, a printed receipt and
   an invoice PDF all still show their previous format (`… DZD`).

### D. Error icons
1. `/register`: submit empty. Every field error has a **red circle-alert icon** before the text, in
   both themes.
2. `/login` with a wrong password: the banner and the field errors each carry an icon.
3. Admin → Products → Add: submit empty. The field errors have icons. On a shadcn `<Form>` dialog
   (for example a client-category dialog in Settings) the errors have icons too.
4. Admin → Suppliers → edit a supplier with an invalid value: the bottom "fix the errors" line is
   translated (switch FR/EN) and has an icon.
5. Error toasts (trigger any failed save) still show Sonner's icon.

### E. Accent placement (admin and staff restriction)
1. Admin sidebar, desktop and the mobile Sheet: the active item's **left bar is scarlet/vermilion**
   and its background is still the light blue tint. Open a group: the active child shows a thin
   highlight left bar.
2. Staff sidebar: same.
3. Admin page titles (Products, Orders, Statistics, Dashboard, Settings, a product, supplier or
   client detail) have a **small highlight bar** before the title. So do the staff Dashboard and
   Products.
4. **Status badges are unchanged:** admin Orders, Sales, Invoices and Repairs still use
   green/amber/grey/red. Nothing turned highlight.
5. POS: hover a family quick-pick tile and a product search result: a **highlight ring** appears,
   with no cyan fill.

### F. Storefront accent
1. Home, desktop: hovering a family tile, a brand tile or a product card shows a **highlight ring**.
   Section titles have the marker bar, centered with the text.
2. Catalog and product page: an out-of-stock product shows an **outlined highlight badge**. A
   product in a client's cart shows a **filled highlight badge**. Check both themes and read the
   text in dark mode.
3. My orders: the order status badges are still semantic (green, amber, red).

### G. Desktop header and category bar (≥ 1280px)
1. Row 1 holds the logo, a **wide search bar**, the language switch, the theme toggle, the cart, and
   the account control. A guest sees a "Se connecter" button.
2. Sign in as a client with items in the cart. The **bubble shows the count**. Add or remove a
   product (heart): the count updates without a reload. With more than 9 items it shows "9+".
3. Below the header, the **category bar** shows "Tous les produits" followed by each top-level family.
4. In Admin → Settings → Hierarchy, nest one family under another. On the storefront, hover the
   parent: a **dropdown lists the child**. Tab to the parent with the keyboard: the dropdown opens
   and the child is reachable by Tab.
5. Click a family: the catalog filters to it and that family has the **highlight underline**.
   "Tous les produits" is underlined when no family is selected.
6. Click a parent whose products are all under its child: an empty catalog page (Q1, expected).
7. Disable a parent family in Settings: its child does not appear in the bar (P7).
8. The header stays sticky on scroll, and the dropdown appears above page content.

### H. Phone header, bottom nav and overflow (375px and 320px)
1. Row 1 holds the logo (the mark only at 320px), language, theme and account (an icon for a guest).
   Row 2 is a **full-width search bar**. There is no burger menu.
2. **No horizontal scroll** on any of these: `/`, `/products`, a product page, `/login`,
   `/register`, `/cart`, `/orders`, `/my-account`, `/invoices`, one invoice, and the order
   confirmation. Check each at 320 and 375, while loading and loaded. **Include the home hero in
   French at 320px** (see the hero row in §2). Swipe sideways: nothing moves.
3. To find any offender, paste this in the console. It must print `[]`:

   ```js
   [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.outerHTML.slice(0, 120))
   ```

4. The **bottom nav** shows Accueil, Catégories, Rechercher, Panier, Compte. The current page's item
   carries the **highlight underline**: Home on `/`, Categories on `/products` and on a product
   page, Cart on `/cart`, Account on `/my-account`, `/orders` or `/login`.
5. **Catégories:** from the home page, the catalog opens with the **filter drawer already open**.
   Close it, then press Back: it doesn't reopen. On `/products?familyId=…`, tap Catégories again: the
   drawer reopens and the filter is kept.
6. **Rechercher:** the header search gets focus and the keyboard opens.
7. **Panier**, signed in as a client: the bubble shows the count. As a guest: it leads to login.
8. **Compte:** client → My account; guest → login; signed-in admin → `/admin`; signed-in staff →
   `/staff`.
9. Scroll to the bottom of the home page: the footer's last line is **fully visible above the bar**.
10. Open the catalog filter drawer, a product image dialog, and the sign-out confirm dialog. Each
    **covers the bar**: the bar is not above the overlay.
11. Trigger a toast (add a product to the cart as a client): it appears **above the bar**, not over
    it. In admin on a phone, toasts sit at their old position.
12. On a real iPhone, or with a safe-area simulation, the bar sits above the home indicator.
13. At 700px (tablet portrait), the bottom nav and two-row header still show, and the catalog
    filters are behind the drawer button (P1). At 768px and above, the desktop header and category
    bar appear and the bottom nav is gone.

---

## 5. Notes for the reviewer

- I ran `eslint --fix` only on files that were Prettier-clean at HEAD, so it touched nothing but my
  own lines. Files with older Prettier noise were not auto-fixed; I fixed my one new error there
  by hand.
- My first attempt at a per-file lint comparison was wrong (it reported no differences). I redid
  it with `eslint -f json` against a stashed HEAD, and that is where the numbers above come from.
- Nothing is committed.
