# Plan S2 — Shared UI Primitives

*Frontend only. Unblocks S3, S4, S6, S7, S8, S13, S17.*

---

## 0. Before you start

### 0.1 Sets that must land first

**S1** — Action 4 of this plan (the shared margin display) computes margins against
**`avgStockPrice`** (D10), which is the field S1 renames `AdminProductDto.averageCost` into.
Executing S2 before S1 lands will not compile.

Nothing else in this set depends on S1; if S1 is somehow blocked, Actions 1–3 and 5–8 can proceed
and Action 4 held back — but the default is to run S1 first, as the execution order states.

### 0.2 Scope discipline

This set fixes **shared primitives** and the places that consume them. It does **not** redesign any
page. In particular:

- The autocomplete rebuild (Action 1) changes the component's contract; Action 2 updates every
  consumer to that contract and **nothing else** about those pages. Field reordering on Add Product,
  the quick-add button on Add Invoice, the product-picker rework on POS — all belong to S3, S6 and
  S7.
- The margin display (Action 4) is added to the three sites RC-2 names. Add Product's *field order*,
  Product Info's *null-guest-price save bug* and the Add-Invoice *reprice section move* are S3 and
  S7.

### 0.3 Findings recorded during planning — read before acting

**G1 — RC-1's root cause, precisely.** `autocomplete-input.tsx` collapses two different things into
one `value: string` prop: the **selected entity's id** and the **text shown in the input**.
`handleOptionSelect` (line 104-114) does `onChange(option.value)` *and* `setSearchQuery(option.value)`
— so the input is set to the id by construction. The `useEffect` at line 185-187 then re-asserts
`setSearchQuery(value)` on every external change, which for the six consumers that bind
`value={field.value}` (an id) re-displays the id forever. Two consumers work around this by binding
a **name** instead (`AdminProductsAdd`'s `value={familyName}`), which breaks in the other direction:
typing into those fields emits raw text through `onChange`. Action 1 separates the two concepts.

**G2 — the same component has a duplicate-DOM-id bug.** Line 203/213 hardcode
`id="autocomplete-input"`, so a page with several of them (the supplier-invoice line editor and the
inventory adjustment line editor both render one *per line*) emits duplicate ids and every `<Label
htmlFor>` points at the first one. Action 1 fixes this while the file is open; it is the same
component and the same edit.

**G3 — RC-3's root cause is one CSS variable.** `--warning-foreground` is `1 0 89.9` (**white**) in
**both** `:root` and `.dark` (`index.css:31`, `:75`). Three components render text in it:
`StatusBadge.tsx:8` (`bg-warning/20 text-warning-foreground` — the *issued* invoice tag and the
*low in stock* product-table badge), `AgeFlag.tsx:34` (same tint), and
`ResolvedVsChargedPrice.tsx:28` (`text-warning-foreground` on the **plain card background** — white
text on white in light mode, fully invisible). Darkening the light-theme value fixes all three at
once. `success` and `destructive` do not have this bug: their tone classes use `text-success` /
`text-destructive` (the mid-tone colour), not the white `-foreground` token.

**G4 — sign-out's redirect is a race, not a missing navigation.** `AdminHeader.tsx:38-41` and
`StaffHeader.tsx:43-46` both call `logout()` then `nav("/login")`. `logout` is
`logoutMutation.mutate()` (`AuthProvider.tsx:59`) — fire-and-forget — and the cached session is only
dropped by `queryClient.clear()` in `useLogout`'s `onSettled`. So at the moment `/login` renders,
`PublicOnlyRoute` (`ProtectedRoute.tsx:34-48`) still sees a session and immediately bounces the user
back to `/admin` or `/staff`. Action 8 makes `logout` awaitable.

**G5 — the 404 shows the admin shell to *clients*, not just to admins.** `App.tsx:99-103` branches
on `isAuthenticated` alone, so a signed-in CLIENT hitting a bad URL gets the full admin sidebar.
Action 6 makes it standalone for everyone.

**G6 — there is no scroll reset anywhere.** No `<ScrollRestoration>`, no scroll effect, no
`window.scrollTo` in any layout. The browser simply keeps the previous offset across a client-side
navigation. Action 5 adds one shared component; note that React Router's own `<ScrollRestoration>`
is **not** the right tool here — it *restores* saved offsets, which is the behavior being complained
about.

**G7 — the repairs brand/model inputs are not autocompletes at all.** The RC-1 table lists
"Repairs (brand/model)" as a site, but `IntakeDialog.tsx:111-146` uses shadcn `<Select>` with a bare
`<SelectValue />`, which renders the selected `<SelectItem>`'s children (the **name**) — so it does
not exhibit the id bug and there is nothing here for S2's component fix to reach. **S13** owns the
conversion of these two fields to a searchable create-if-absent input. Action 3 covers what S2 must
actually do about them: verify and record.

### 0.4 Standing rules for this set

- **No test file may be edited and no test suite may be run.** Validation is `tsc --noEmit` and lint
  only. Several existing tests render `AutocompleteInput` and `CatchAllRoute` directly and will
  break against the new contracts — Action 10 says how to report that.
- **All user-facing text goes through `t()`.** The translation file is
  `Apps/web/src/config/translations.json` — **plural**, not `translation.json` as the brief writes
  it. Its keys are **flat dotted strings** mapping to `{ en, fr, ar }`; **`ar` is always `""`** in
  this codebase (nothing sets the language to Arabic yet — see `lib/i18n.ts`'s own comment). Match
  that shape exactly. Interpolation is `{name}` single-brace.
- **Read the comment above every line you change** and update any your change makes wrong. Several
  are named explicitly below.
- Colour semantics for margins are fixed by RC-2: **`> 0` green, `≤ 0` red**. Exactly zero is red.

---

## 1. Actions, in dependency order

Execute **1 → 10** in order. Action 2 cannot compile until Action 1 lands; Actions 5–8 are
independent of 1–4 and of each other.

---

### Action 1 — RC-1: rebuild the shared autocomplete

**File:** `Apps/web/src/components/shared/autocomplete-input.tsx`

**1a — the new prop contract.** `AutocompleteOption` is unchanged (`{ value, label, id?,
description?, isNew?, disabled? }`). The component's props change meaning:

| Prop | New meaning |
|---|---|
| `value: string` | **The selected option's `value` (the entity id) — never display text.** `""` means nothing selected. |
| `onChange: (value: string) => void` | Fires **only** when the selection changes: an option's `value` on select, `""` on clear. **It no longer fires on every keystroke.** |
| `onSearch?: (query: string) => void` | Unchanged — fires on every keystroke, for consumers that fetch remotely. |
| `onCreateNew?: (label: string) => void` | Unchanged — receives the typed **text**, since no entity exists yet. |
| `inputId?: string` | **New.** The DOM id for the input and the `<Label htmlFor>`. Defaults to a `useId()`-generated value (**G2**). |

**1b — internal state.** Replace the single `searchQuery` state with:

```ts
const [inputText, setInputText] = useState('');
const [isFocused, setIsFocused] = useState(false);
const selectedLabel = suggestions.find((s) => s.value === value)?.label;
```

**1c — the display-sync rule.** This one effect is the whole fix. While the input is focused the
user owns the text; while it is not, the text always mirrors the current selection — which also
handles the case where `suggestions` arrive asynchronously *after* `value` is already set (every
`Controller`-bound consumer editing an existing record hits this):

```ts
// The input shows the selected entity's LABEL, never its id (RC-1). While focused the user owns
// the text; the moment focus leaves, the text is re-derived from `value` -> its option's label,
// so an async-loaded suggestion list resolves the display correctly on arrival too.
useEffect(() => {
  if (!isFocused) setInputText(selectedLabel ?? '');
}, [isFocused, selectedLabel, value]);
```

**1d — the handlers.**

- `handleInputChange`: `setInputText(text)`, `onSearch?.(text)`, open the list. **Remove the
  `onChange(newValue)` call** — typing no longer mutates the selection.
- `handleOptionSelect(option)`: if `option.isNew && onCreateNew` → `onCreateNew(option.value)` as
  today; otherwise `onChange(option.value)` **and** `setInputText(option.label)`. Then close, reset
  the highlight, and blur.
- `handleBlur`: keep the existing 150 ms `relatedTarget` guard so a click on an option still
  registers, and inside it set `setIsFocused(false)` — 1c's effect then reverts any half-typed text
  to the selected label (or `''` if the field was cleared). If `inputText.trim() === '' && value
  !== ''`, call `onChange('')` first, so clearing the text really clears the selection.
- `handleFocus`: also `setIsFocused(true)`.
- `handleKeyDown`: unchanged, except `Escape` must also `setIsFocused(false)`.

**1e — filtering and create-new match against labels.**

- `filteredSuggestions`: filter on `label` (and `description` if present) only. **Drop the
  `suggestion.value.toLowerCase().includes(...)` clause** — it currently matches typed text against
  raw uuids.
- `shouldShowCreateNew`: compare `searchQuery` against `s.label`, not `s.value`.

**1f — a clear button.** When `value !== ''` and not `disabled`, render a small `X` button (the icon
is already imported and currently unused) inside the input's right-hand icon cluster, before the
`Search`/`ChevronDown`. `onClick` → `onChange('')` and `setInputText('')`. Give it
`aria-label={t('common.actions.clearSelection')}` (Action 9 adds the key) and `type="button"` so it
never submits the enclosing form.

**1g — the duplicate-id fix (G2).** Replace both hardcoded `id="autocomplete-input"` occurrences
(the `<Label htmlFor>` at line 203 and the `<Input id>` at line 213) with the resolved
`inputId ?? useId()` value.

**1h — the doc comment.** The current one-liner (*"Reusable autocomplete input component with
search, filter, and create new functionality"*) says nothing about the value/label split, which is
the entire point of the component now. Replace it with a comment stating the contract from 1a: that
`value` is always the selected entity's id, that the input always displays that entity's label, and
that `onChange` fires only on a selection change.

---

### Action 2 — RC-1: bring every consumer onto the new contract

Six of the eight call sites already bind an id and need **no change** beyond verification; two bind
a name and must be corrected.

**2a — `Apps/web/src/pages/admin/products/AdminProductsAdd.tsx` — the two-way break (family, brand,
model).** All three currently pass `value={familyName}` / `{brandName}` / `{modelName}` (lines 214,
245, 278) — display text, not ids. Change each to the form id:

- family: `value={familyId ?? ""}`
- brand: `value={brandId ?? ""}`
- model: `value={modelId ?? ""}`

(`familyId`, `brandId` and `modelId` are already destructured from the `watch([...])` call at
line ~95-101; `familyName`/`brandName`/`modelName` at lines 103-105 stay, since `recomputeName`
still uses them.)

Each `onChange` body is already correct — it looks the entity up by id and calls `setValue` — and
keeps working unchanged. Drop the now-pointless `onSearch={() => {}}` props (the component no longer
requires the callback to exist for local filtering).

Then re-read `recomputeName`: it is called from inside `onChange` with the *newly selected* name and
the two current ones, which still holds. No change.

**2b — `Apps/web/src/pages/admin/settings/components/storefront-settings.tsx` (featured
products).** `value={pickerValue}` with a local `pickerValue` state that `onChange` immediately
resets to `""` (lines 48-56). Under the new contract this behaves correctly — select fires
`onChange(productId)`, the handler calls `onAdd(productId)` and resets `pickerValue` to `""`, and
1c's effect (the input is blurred by `handleOptionSelect`) clears the text. **Verify only.** Note
that **S17** removes and rebuilds this input entirely; do not pre-empt that here.

**2c — the six already-correct sites — verify, do not edit.** Each binds an id and needs no change,
but you must confirm the option arrays are built as `{ value: <entity>.id, label: <entity>.name }`
(if any builds `value` from a *name*, correct that builder):

| Consumer | Bound value | Option array built in |
|---|---|---|
| `admin/clients/components/approval-dialog.tsx:112` (category) | `field.value` | `admin/clients/AdminClientDetail.tsx:48` |
| `admin/pos-clients/components/add-pos-client-dialog.tsx:86` (category) | `field.value ?? ""` | `admin/pos-clients/AdminPosClients.tsx:39` |
| `admin/pos-clients/components/edit-pos-client-dialog.tsx:96` (category) | `field.value` | `admin/pos-clients/AdminPosClients.tsx:39` |
| `admin/supplier-invoices/components/invoice-header-form.tsx:30` (supplier) | `field.value` | `admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx:76` |
| `admin/supplier-invoices/components/invoice-line-editor.tsx:43` (product) | `field.value ?? ""` | `admin/supplier-invoices/AdminSupplierInvoiceEditor.tsx:82` |
| `admin/inventory/components/adjustment-line-editor.tsx:46` (product) | `field.value` | `admin/inventory/AdminInventory.tsx:57` |

**2d — `inputId` for the repeated ones.** The two *line editor* consumers render one autocomplete
per array row, so pass an index-scoped id to close **G2** at the call site as well:
`inputId={`invoice-line-${index}-product`}` and `inputId={`adjustment-line-${index}-product`}`.
Both components already receive `index` as a prop.

---

### Action 3 — RC-1: the repairs brand/model sites (verify and hand off)

**File:** `Apps/web/src/pages/staff/repairs/components/IntakeDialog.tsx`

Do **not** convert these to `AutocompleteInput` in this set (**G7**). Verify in the browser that the
brand and model `<Select>`s display the device **name** after selection, and record the result in
the report as a handoff to **S13**, which owns turning them into searchable create-if-absent inputs.

If the verification shows they *do* display an id, that is a different defect from RC-1 (it would be
a missing `<SelectValue placeholder>` / mismatched `SelectItem` children) — report it rather than
fixing it here, since S13 replaces the whole control.

---

### Action 4 — RC-2: one shared margin display

**4a — the new component.** Create `Apps/web/src/components/shared/MarginDisplay.tsx`:

```tsx
interface Props {
  /** The sale price being evaluated. Undefined/null/NaN renders nothing. */
  price?: number | null;
  /** The cost basis. Per D10 this is always avgStockPrice (or, on Add Product, the initial unit cost). */
  cost?: number | null;
  className?: string;
}
```

Behavior:
- `marginPercent(price, cost) = ((price - cost) / cost) * 100`, exported alongside the component so
  no page re-derives it.
- Renders nothing when `price` is `null`/`undefined`/`NaN`.
- When `cost` is `null`/`undefined`/`0`, renders `t("common.margin.noCostBasis")` in
  `text-muted-foreground` — a divide-by-zero must not print `Infinity%`, which is what the current
  Product-Info code does whenever a product has no stock yet.
- Otherwise renders `` `${t("common.margin.label")}: ${value.toFixed(1)}%` `` with the colour rule:
  **`> 0` → `text-success`, `≤ 0` → `text-destructive`** (RC-2). Keep the existing `text-xs` sizing
  so it drops into the current layouts unchanged.

Because it is a plain function of its props, it **recomputes on every render of its parent** — which
is what fixes "goes stale" at every site below, provided the parent passes a *watched* value rather
than a fetched one. That is the substance of 4c.

**4b — Add Product.** `Apps/web/src/pages/admin/products/AdminProductsAdd.tsx`:
- Delete the local `marginPercent` helper (lines 123-126).
- Replace the two inline margin `<p>` blocks (lines 380-384 and 400-405) with `<MarginDisplay
  price={…} cost={initialUnitCost} />`.
- **Add the missing guest-price margin** (RC-2: *"rendered for the guest price too, beneath its
  'leave empty to not set' helper text"*): after the `admin.productsAdd.guestPriceHelper` paragraph
  at line ~365, add `<MarginDisplay price={watch("guestPrice")} cost={initialUnitCost} />`.
- The default-sale-price site currently calls `watch("defaultSalePrice")` **twice** per render
  (once to test, once to format) — pass it once through the component instead.
- Cost basis here is `initialUnitCost` (already in the `watch([...])` destructure), which *is* the
  product's `avgStockPrice`-to-be: the product does not exist yet, and its first FIFO layer is
  created at this cost.

**4c — Product Info (edit mode).**
`Apps/web/src/pages/admin/products/components/enhanced-pricing-section.tsx` is the RC-2 "goes stale"
site: it computes margins from `product.defaultSalePrice` / `category.price` — the **fetched DTO** —
so editing an input never moves the margin.

- Delete the local `marginPercent` helper (lines 19-22).
- Add a `watch: UseFormWatch<ProductPricingFormValues>` prop to `ProductPricingSectionProps` and
  thread it from the page (`AdminProductInformation.tsx`, whose `pricingForm` comes from
  `use-edit-mode.ts` — pass its `watch` down beside the existing `register`/`control`/`errors`).
- Cost basis is `product.avgStockPrice` (S1).
- Render `<MarginDisplay>` for **all three** kinds of price — guest, default, and each category —
  in **both** modes, reading:
  - `isEditMode ? watch("guestPrice") : product.guestPrice`
  - `isEditMode ? watch("defaultSalePrice") : product.defaultSalePrice`
  - `isEditMode ? watch(\`categoryPrices.${index}.price\`) : category?.price`
- Update the component's block comment (lines 24-27), which describes the card as *"dumb,
  form-bound"* and does not mention margins.

**Out of scope here:** the null-guest-price save bug on this page ("when the guest price is null the
price-section update never fires") is **S3**'s, not S2's. Do not touch the submit path.

**4d — the Add-Invoice reprice section.**
`Apps/web/src/pages/admin/supplier-invoices/components/reprice-prompt.tsx` is RC-2's third site.
Render a `<MarginDisplay>` beneath each price field in the prompt, with
`cost={candidate.avgStockPrice}` (S1's rename), reading the **live input value** for that field, not
the candidate's stored current price.

S7 moves this section to the top of the invoice, adds the `-previous 1000-` labelling and the
per-product stock/avg columns. S2's job is only that the margin exists here, is coloured, and tracks
the input. If the prompt's price inputs are uncontrolled today, wire the minimum needed to read
their current values — do not restructure the form.

**4e — sweep.** `grep -rn "marginPercent\|Margin" Apps/web/src --include=*.tsx` and confirm no
inline margin arithmetic survives outside `MarginDisplay.tsx`. (The three
`pages/admin/statistics/components/charts/*.tsx` hits are chart `margin` layout props — unrelated,
leave them. `hooks/use-pricing-calculation.ts` computes price-ratio *warnings*, not margins — also
unrelated.)

---

### Action 5 — RC-3: light-mode badge contrast

**File:** `Apps/web/src/index.css`

In `:root` (the **light** theme) change line 31:

```css
  --warning-foreground: 0.42 0.105 75;   /* dark amber — readable on bg-warning/20 and on --card */
```

Leave `.dark`'s `--warning-foreground: 1 0 89.9` (white) unchanged: there the same tint sits over a
dark card, where white is correct.

That single variable is the root cause (**G3**) and fixes all three consumers at once:
`StatusBadge.tsx`'s `warning` tone (the **issued** invoice tag on both the admin and client invoice
lists, and the **low in stock** badge in the products table), `AgeFlag.tsx:34`, and
`ResolvedVsChargedPrice.tsx:28` — the last of which currently renders **white on white** in light
mode with no tint behind it at all.

**Do not** change `TONE_CLASS` in `StatusBadge.tsx`, and do not touch `--success` /
`--destructive`: their tone classes use the mid-tone colour token (`text-success` /
`text-destructive`), not a white `-foreground`, so they do not have this bug.

Add a short comment beside the changed line recording *why* the two themes differ, so a future
"consistency" pass does not helpfully set it back to white.

---

### Action 6 — Not Found: standalone, no shell

**File:** `Apps/web/src/App.tsx`

`CatchAllRoute` (lines 82-104) currently wraps its content in `AdminLayout` when authenticated —
which shows the **admin sidebar to signed-in clients** (**G5**) — and `PublicLayout` otherwise.

- Delete the `isAuthenticated` branch and the `useAuth()` call; return the 404 content directly,
  wrapped in a standalone full-screen container (`min-h-screen`, centred) rather than either layout.
- Keep the existing content exactly: `NotFoundState` with `eyebrow="404"`,
  `title={t("common.errors.notFoundTitle")}`, `body={t("common.errors.notFoundBody")}`, and the
  `<Button asChild><Link to="/">{t("common.actions.goHome")}</Link></Button>` action. **All four
  keys already exist** — no translation work here.
- Remove the now-unused `useAuth` import. **Keep** the `AdminLayout` and `PublicLayout` imports —
  both are still used as route elements further down the file.
- Rewrite the comment at lines 79-81, which explicitly documents the behavior being removed
  (*"it picks the layout that matches the current session"*). State instead that the 404 is
  deliberately shell-less for every user, and keep the existing note that the component is exported
  so a unit test can render it.

**Two comments elsewhere assert the behavior this action removes** — both must be corrected
(rule: update comments your change falsifies):

- `Apps/web/src/components/layout/StaffLayout.tsx`, lines 4-9: *"...CatchAllRoute, which picks
  between Admin/PublicLayout only; a 404 under /staff still renders inside AdminLayout's branch"*.
  No longer true — a 404 under `/staff` now renders shell-less like every other.
- `Apps/web/src/components/layout/PublicLayout.tsx` line 7 and
  `Apps/web/src/components/layout/AdminLayout.tsx` line 7, both: *"Explicit children override
  `<Outlet/>` — used by the catch-all route"*. After this action **nothing** passes `children` to
  either layout, so the prop is dead. Leave the prop itself in place (removing it is churn that
  touches two more files for no behavioral gain) but correct both comments to say it is currently
  unused, and note the dead prop in the report.

---

### Action 7 — Scroll restoration: land at the top of every route

**7a — the component.** Create `Apps/web/src/components/layout/ScrollToTop.tsx`:

```tsx
// Every client-side navigation lands at the top of the page. Keyed on `pathname` only — not on
// `search` — so changing a filter, a page number or a tab query param keeps the reader where they
// are, while moving to a different route always resets.
//
// Deliberately NOT React Router's <ScrollRestoration>: that component *restores* each entry's saved
// offset, which is exactly the behavior being fixed here.
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
```

**7b — mount it in all three shells**, as the first child inside each layout's root element:

- `Apps/web/src/components/layout/AdminLayout.tsx`
- `Apps/web/src/components/layout/StaffLayout.tsx`
- `Apps/web/src/components/layout/PublicLayout.tsx`

`window` is the scrolling element in all three — verified during planning: `AdminLayout` and
`StaffLayout` are both `min-h-screen bg-surface` with a `sticky` header and no inner
`overflow-auto`; `PublicLayout` is `flex min-h-screen flex-col` with a `flex-1` main. So mounting
`ScrollToTop` and calling `window.scrollTo` is correct for all three, with no per-layout special
case.

Action 6 makes the 404 standalone, so it no longer inherits a layout — that is fine; a 404 page is
one screen tall.

---

### Action 8 — Sign out redirects immediately

**8a — make `logout` awaitable.** `Apps/web/src/components/providers/AuthProvider.tsx`:

- In the `AuthCtx` type (line 18), change `logout: () => void` → `logout: () => Promise<void>`.
- At line 59, replace `logout: () => logoutMutation.mutate()` with:
  ```ts
  // Awaitable so callers can navigate only *after* useLogout's onSettled has run
  // queryClient.clear() — otherwise PublicOnlyRoute still sees the cached session at /login and
  // bounces straight back to /admin. The catch is deliberate: authService.logout() clears the
  // local tokens in its own `finally` even when the API call throws, so a failed round-trip is
  // still a completed logout and must still resolve.
  logout: async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      /* tokens already cleared by the service's finally; the cache by onSettled */
    }
  },
  ```

**8b — the two headers.** In `Apps/web/src/components/layout/AdminHeader.tsx` (lines 38-41) and
`Apps/web/src/components/layout/StaffHeader.tsx` (lines 43-46), make the handler await and replace
the history entry:

```ts
const handleLogout = async () => {
  await logout();
  nav("/login", { replace: true });
};
```

`{ replace: true }` stops the browser Back button returning to the admin URL the user just left.
Both handlers are passed to an `<AlertDialogAction onClick={...}>`, which accepts an async handler
— no signature change is needed at the call sites.

**8c — check the public header.** `Apps/web/src/components/layout/PublicHeader.tsx` may have its own
sign-out for clients. RC's list names admin and staff only, and **S15** owns the public header — so
if the same pattern is there, **record it in the report as an S15 handoff** rather than changing it,
unless it is a literal one-line copy of 8b, in which case fix it and say so.

---

### Action 9 — Translation keys

Add to `Apps/web/src/config/translations.json`, in the flat `{ en, fr, ar }` shape with `ar: ""`:

| Key | en | fr |
|---|---|---|
| `common.margin.label` | `Margin` | `Marge` |
| `common.margin.noCostBasis` | `No cost basis yet` | `Pas encore de coût de revient` |
| `common.actions.clearSelection` | `Clear selection` | `Effacer la sélection` |

**Then delete `admin.productsAdd.marginLabel`** ("Margin"/"Marge"). Its only two consumers —
`AdminProductsAdd.tsx` and `enhanced-pricing-section.tsx` — both become `MarginDisplay` consumers in
Action 4, and the shared component uses `common.margin.label`. Verify with
`grep -rn "admin.productsAdd.marginLabel" Apps/web/src` before deleting; if anything else still
references it, keep the key and say so in the report.

Every other string this set renders (`common.errors.notFoundTitle`, `common.errors.notFoundBody`,
`common.actions.goHome`, `common.actions.signOut`) **already exists** — verified during planning. Do
not duplicate them.

---

### Action 10 — Sweep and report the test fallout

Do not edit or run tests. Instead, produce the list the owner needs:

```bash
grep -rln "AutocompleteInput\|CatchAllRoute\|marginLabel\|averageCost" Apps/web/tests
```

Every file that comes back references a contract this set changed (the autocomplete's
value/label split, the shell-less 404, the deleted margin key, S1's renamed field). Name each one in
the report, with a one-line note on what about it is now stale, so the owner can schedule that work
separately.

---

## 2. Validation gate

From the repo root. **Do not run any test suite.**

```bash
cd Apps/web && npx tsc --noEmit && npm run lint
```

`Apps/web` carries roughly 10 200 pre-existing prettier-noise lint findings (recorded in the
stage-03 set-04 results). Compare against the baseline on `main` rather than expecting zero; only
findings your diff introduced matter. Fix every new one before reporting.

---

## 3. Manual verification checklist

The owner performs these in the browser after the set is reported. No automated test runs. Check
each in **both light and dark mode** where colour is involved.

**RC-1 — the input shows the name, never the id**

1. `/admin/products/add` — pick a **family**, then a **brand**, then a **model**. Each input shows
   the chosen name immediately after selection **and still shows it** after picking the next one.
   The auto-generated product name below still assembles as `family brand model`.
2. On the same page, select a family, then reopen the dropdown and select a **different** family.
   The input shows the second name — not the first, and not an id. (This is the "first and every
   subsequent selection" clause.)
3. `/admin/pos-clients` → **Add** → the **category** field shows the category name after selection.
   Save, then reopen the same client for **edit**: the category field is pre-filled with the name,
   not the id. (This is the async-suggestions path from 1c.)
4. `/admin/clients` → open a **pending** client → **Approve** → the category dropdown shows the name
   after selection.
5. `/admin/supplier-invoices/new` → the **supplier** field shows the supplier name; add two product
   lines and confirm **each** shows its own product name (not both showing the same one, and not
   ids) — this is the duplicate-DOM-id fix.
6. `/admin/inventory` → **Adjustments** → the product picker shows the product name.
7. `/admin/settings` → **Storefront** → **featured products**: selecting a product adds it to the
   badge list and the search field goes **empty** (not left showing an id).
8. In any of the above: select an option, then type over it and click away without picking anything.
   The field reverts to the previously selected name. Then clear the field completely and click
   away — the selection is cleared, and saving no longer submits the old id.
9. The small **×** clear button appears once something is selected and clears both the text and the
   selection.

**RC-2 — margins**

10. `/admin/products/add` — enter an initial quantity and unit cost to unlock pricing. Type a
    **default sale price above** the cost: the margin appears in **green** and updates on every
    keystroke. Lower it **below** the cost: it turns **red**. Set it exactly **equal** to the cost:
    still **red** (`≤ 0`).
11. Same page — a margin now also appears beneath the **guest price**, under its "leave empty to not
    set" helper text, and beneath **each category price**.
12. `/admin/products/:id` → **Edit**. Change the default sale price and watch the margin move as you
    type — it must not stay pinned to the saved value. Same for each category price and the guest
    price.
13. Open a product that has **never had stock** (avg stock price 0): the margin area reads "No cost
    basis yet" rather than `Infinity%` or `NaN%`.
14. `/admin/supplier-invoices/new` → confirm an invoice → in the reprice prompt, each price field
    shows a coloured margin that tracks what you type.

**RC-3 — light-mode contrast**

15. Switch to **light** mode. `/admin/invoices` → outgoing tab: an **ISSUED** invoice's status tag
    is legible (dark amber text on a pale amber pill), not white-on-pale.
16. Still in light mode: `/invoices` as a signed-in **client** — the same tag is legible there too.
17. `/admin/products` — a product in the **low in stock** state shows a legible badge.
18. Switch back to **dark** mode and re-check 15–17: all three still look correct (white on the dark
    tint).
19. Anywhere a "charged price differs from resolved price" indicator appears (POS / sale detail),
    the warning-coloured figure is visible in light mode — it was invisible before.

**Scroll, 404, sign-out**

20. Scroll to the bottom of `/admin/products`, then click through to any other admin page: the new
    page opens at the **top**. Repeat on the public storefront (`/products` → a product detail page).
21. On a filterable list, change a filter or page number: the page does **not** jump to the top.
22. Visit `/admin/this-route-does-not-exist` while signed in as an **admin**: a bare 404 with a
    return button — **no sidebar, no admin header**.
23. Repeat 22 signed in as a **client** and while **signed out**: same bare 404 in all three cases.
24. `/admin` → user menu → **Sign out** → confirm. You land on `/login` **immediately** and stay
    there. Press the browser **Back** button: you are **not** returned to `/admin`.
25. Repeat 24 from `/staff`.

---

## 4. Execution protocol

Start Set S2 plan execution. After finishing, write
**`Docs/Stage-04-Fixes/results/report-S02.md`** describing what changed, and ending with the
**verification checklist** above. The report must additionally record:

- The new `AutocompleteInput` contract from Action 1a, **verbatim** — S6, S7, S13 and S17 all add
  new consumers and must build them against it rather than re-deriving it.
- Action 3's finding: whether the repairs brand/model `<Select>`s display names correctly today, as
  a handoff to **S13**.
- Action 7's finding: whether `StaffLayout` and `PublicLayout` really scroll `window`, or an inner
  container.
- Action 8c's finding: whether `PublicHeader` has the same sign-out race, as a handoff to **S15**.
- Action 9's outcome: whether `admin.productsAdd.marginLabel` was safely deleted.
- Action 10's list: every test file now stale against a changed contract, named individually. None
  may be edited in this set.
- Anything you deliberately left for the set that owns it (Product Info's null-guest-price save bug
  → S3; the reprice section's move and previous-value labels → S7; the featured-products input
  rebuild → S17).

The owner reviews and approves before the next set begins.
