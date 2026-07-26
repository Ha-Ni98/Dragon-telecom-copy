# Report S2 — Shared UI Primitives

Executed per `Docs/Stage-04-Fixes/plans/plan-S02-shared-ui-primitives.md`, actions 1→10 in order,
single session, immediately following S1 in the same session (S1's `avgStockPrice` field is a
prerequisite for Action 4).

## Summary

All 10 actions completed. `tsc --noEmit` is clean on `Apps/web`. Lint on every S2-touched file
introduces zero new errors relative to each file's pre-existing baseline (verified file-by-file
via `git stash` comparison where any error appeared).

## What changed

### Action 1 — Rebuilt `AutocompleteInput` (RC-1 root cause)
`Apps/web/src/components/shared/autocomplete-input.tsx` — full rewrite of the component's
internal state model:
- `value` is now always the selected option's id; the input's displayed text (`inputText`) is a
  separate piece of state, kept in sync with the current selection via one `useEffect` keyed on
  `isFocused`/`selectedLabel`/`value` — while focused the user owns the text, the moment focus
  leaves it re-derives from `value` → its option's `label`. This also correctly resolves the
  display when `suggestions` loads asynchronously after `value` is already set (editing an
  existing record).
- `onChange` no longer fires on every keystroke — only on an actual selection change (an option's
  `value`, or `""` on clear).
- Filtering and the "create new" match now compare against `label`/`description`, never the raw
  `value` (previously matched typed text against raw uuids).
- New `inputId` prop (defaults to `useId()`) — fixes the duplicate hardcoded
  `id="autocomplete-input"` that broke every `<Label htmlFor>` on pages rendering more than one
  instance (G2).
- New clear (×) button, shown once something is selected.
- Removed the unused `Badge` import while rewriting the file.
- Component doc comment rewritten to state the new contract explicitly (§ below).

**New contract, verbatim, for S6/S7/S13/S17 to build against:**

| Prop | Meaning |
|---|---|
| `value: string` | The selected option's `value` (the entity id) — never display text. `""` = nothing selected. |
| `onChange: (value: string) => void` | Fires only on a selection change: an option's `value` on select, `""` on clear. Never on keystroke. |
| `onSearch?: (query: string) => void` | Unchanged — fires on every keystroke, for remote-fetch consumers. |
| `onCreateNew?: (label: string) => void` | Unchanged — receives the typed text. |
| `inputId?: string` | New. DOM id for the input + its label. Defaults to a generated id; pass one explicitly when rendering several instances per page. |

### Action 2 — Consumers brought onto the new contract
- **`AdminProductsAdd.tsx`** (the two-way break): family/brand/model `AutocompleteInput`s now bind
  `value={familyId ?? ""}` / `{brandId ?? ""}` / `{modelId ?? ""}` instead of the display-name
  locals. `onChange` bodies were already correct (look up by id, `setValue` + `recomputeName`) and
  needed no change. Dropped the now-pointless `onSearch={() => {}}` no-ops on all three.
- **`storefront-settings.tsx`** — verified only, no edit. Behaves correctly under the new contract
  as-is (S17 rebuilds this input entirely later).
- **Six already-correct sites** (approval-dialog, add/edit-pos-client-dialog,
  invoice-header-form, invoice-line-editor, adjustment-line-editor) — verified their option
  arrays are all built as `{ value: <entity>.id, label: <entity>.name }`. No changes needed.
- **`invoice-line-editor.tsx`** and **`adjustment-line-editor.tsx`** — added
  `inputId={\`invoice-line-${index}-product\`}` / `` `adjustment-line-${index}-product` `` to close
  G2 at the per-row call sites.

### Action 3 — Repairs brand/model (verify + handoff)
`IntakeDialog.tsx`'s brand/model fields use shadcn `<Select>` with a bare `<SelectValue />`, which
renders the matched `<SelectItem>`'s children — the device **name**, confirmed by reading
`brands.map((brand) => <SelectItem>{brand.name}</SelectItem>)`. This is **not** an
`AutocompleteInput` and does not exhibit RC-1's id-display bug. No S2 changes. **Handoff to S13**:
these two fields are still shadcn `<Select>`s, not searchable/create-if-absent inputs — that
conversion is S13's, per the brief.

### Action 4 — Shared `MarginDisplay` (RC-2)
- New `Apps/web/src/components/shared/MarginDisplay.tsx` — exports `marginPercent(price, cost)`
  and the `<MarginDisplay>` component. Renders nothing for a null/undefined/NaN price; renders
  "No cost basis yet" when cost is null/0 (previously Product Info printed `Infinity%`/`NaN%` for
  an unstocked product); otherwise renders `Margin: X.X%` in `text-success` (`> 0`) or
  `text-destructive` (`≤ 0`).
- **Add Product** (`AdminProductsAdd.tsx`): deleted the local `marginPercent` helper; wired
  `<MarginDisplay>` for default-sale-price and each category price; **added the previously-missing
  guest-price margin** beneath its "leave empty to not set" helper text.
- **Product Info edit mode** (`enhanced-pricing-section.tsx` + `AdminProductInformation.tsx`):
  deleted the local `marginPercent` helper; added a `watch` prop
  (`UseFormWatch<ProductPricingFormValues>`), threaded from `AdminProductInformation.tsx`'s
  `editMode.pricingForm.watch`. `<MarginDisplay>` now renders in **both** view and edit mode for
  guest price, default price, and every category price — in edit mode reading the live `watch()`
  value (fixing "goes stale"), in view mode the DTO value. Cost basis is `product.avgStockPrice`
  throughout.
- **Add-Invoice reprice section** (`reprice-prompt.tsx`): added `watch` to the row's own
  `useForm()` destructure; wired `<MarginDisplay>` beneath both the guest-price and default-price
  inputs, `cost={candidate.avgStockPrice}`, reading the live typed value.
- Swept the whole of `Apps/web/src` for stray margin arithmetic outside `MarginDisplay.tsx` — none
  found.
- **Left untouched, as scoped**: Product Info's null-guest-price save bug (S3), the reprice
  section's move-to-top + previous-value labelling (S7).

### Action 5 — RC-3 light-mode contrast
`Apps/web/src/index.css` — `:root`'s `--warning-foreground` changed from `1 0 89.9` (white) to
`0.42 0.105 75` (dark amber), with a comment explaining why light and dark diverge. `.dark`'s value
is untouched (still white — correct there, a dark tint on a dark card). This single variable is
the root cause for all three consumers named by RC-3: `StatusBadge.tsx`'s `warning` tone (issued
invoice tag, low-in-stock badge), `AgeFlag.tsx`, and `ResolvedVsChargedPrice.tsx` (previously
white-on-white with no tint at all).

### Action 6 — Standalone 404
`Apps/web/src/App.tsx` — `CatchAllRoute` no longer branches on `isAuthenticated` / wraps in
`AdminLayout`/`PublicLayout` (G5: a signed-in client hitting a bad URL saw the full admin
sidebar). Removed the `useAuth` import (now unused in this file); `AdminLayout`/`PublicLayout`
imports kept (still used as route elements elsewhere in the file). Updated the stale comments this
falsified in three files:
- `App.tsx`'s own comment above `CatchAllRoute`.
- `StaffLayout.tsx`'s comment, which asserted "a 404 under /staff still renders inside
  AdminLayout's branch" — no longer true.
- `AdminLayout.tsx` and `PublicLayout.tsx`'s `children` prop doc comments, which claimed the prop
  was "used by the catch-all route" — it no longer is. Left the prop itself in place (removing it
  touches more files for no behavioral gain); comments now say it is currently unused.

### Action 7 — Scroll restoration
New `Apps/web/src/components/layout/ScrollToTop.tsx` — a `useLocation()`-keyed effect calling
`window.scrollTo({top:0, left:0, behavior:"instant"})` on every pathname change (not on `search`
changes, so filters/pagination don't reset scroll). Mounted as the first child in `AdminLayout`,
`StaffLayout`, and `PublicLayout`. Verified all three scroll `window` directly (no inner
`overflow-auto` container in any of the three root divs) before mounting.

### Action 8 — Sign-out race (G4)
- `AuthProvider.tsx`: `AuthCtx.logout` changed from `() => void` to `() => Promise<void>`; the
  provider's `logout` now `await`s `logoutMutation.mutateAsync()` inside a try/catch (tokens are
  already cleared by the service's own `finally` even on a failed round-trip, so the catch is a
  deliberate no-op).
- `AdminHeader.tsx` and `StaffHeader.tsx`: `handleLogout` is now `async`, awaits `logout()`, then
  navigates with `{ replace: true }` so the browser Back button can't return to the admin/staff
  URL just left.
- **`PublicHeader.tsx`** had the identical one-line-copy race (`logout(); navigate("/login");`,
  same pattern, same bug) — fixed identically, per the plan's instruction to fix rather than defer
  when it's a literal copy.

### Action 9 — Translation keys
Added to `Apps/web/src/config/translations.json` (flat `{en, fr, ar:""}` shape):
`common.margin.label`, `common.margin.noCostBasis`, `common.actions.clearSelection`. Deleted
`admin.productsAdd.marginLabel` after confirming (grep) its only two consumers were both replaced
by `MarginDisplay` in Action 4 and nothing else referenced it. `common.errors.notFoundTitle`,
`common.errors.notFoundBody`, `common.actions.goHome`, `common.actions.signOut` were verified
pre-existing and not duplicated. JSON validity and all four new/changed keys confirmed via a
direct `require()` check.

### Action 10 — Stale test sweep (not edited)
`grep -rln "AutocompleteInput|CatchAllRoute|marginLabel|averageCost" Apps/web/tests` returned:

| File | What's stale |
|---|---|
| `tests/unit/pages/not-found/not-found.test.tsx` | Renders `CatchAllRoute` and asserts on the old layout-branching behavior (`isAuthenticated` → `AdminLayout`) that Action 6 removed. |
| `tests/fixtures/data/inventory.mock.ts` | Fixture object has an `averageCost` field (line 26) — contract field renamed to `avgStockPrice` in S1. |
| `tests/fixtures/data/purchasing.mock.ts` | Same, line 104. |
| `tests/fixtures/data/catalog.mock.ts` | Same, line 160. |

None of these were edited or run, per rule.

## Validation gate — green

```
Apps/web: tsc --noEmit ✓ (0 errors)
          lint: 0 new errors across every S2-touched file. One genuine new issue was found and
          fixed during the session — MarginDisplay.tsx's initial draft had a prettier line-wrap
          violation, corrected before this report. Four remaining errors on touched files
          (AdminLayout.tsx ×1, PublicHeader.tsx ×2, AuthProvider.tsx ×1) are confirmed
          pre-existing via git-stash comparison — none introduced by this set's edits.
```

No test file was edited. No test suite was run.

## Manual verification checklist

The owner performs these in the browser after the set is reported. No automated test runs. Check
each in **both light and dark mode** where colour is involved.

**RC-1 — the input shows the name, never the id**
1. `/admin/products/add` — pick a **family**, then a **brand**, then a **model**. Each input shows
   the chosen name immediately after selection **and still shows it** after picking the next one.
   The auto-generated product name below still assembles as `family brand model`.
2. On the same page, select a family, then reopen the dropdown and select a **different** family.
   The input shows the second name — not the first, and not an id.
3. `/admin/pos-clients` → **Add** → the **category** field shows the category name after selection.
   Save, then reopen the same client for **edit**: the category field is pre-filled with the name,
   not the id.
4. `/admin/clients` → open a **pending** client → **Approve** → the category dropdown shows the name
   after selection.
5. `/admin/supplier-invoices/new` → the **supplier** field shows the supplier name; add two product
   lines and confirm **each** shows its own product name (not both showing the same one, and not
   ids).
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
    still **red**.
11. Same page — a margin now also appears beneath the **guest price** and beneath **each category
    price**.
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
18. Switch back to **dark** mode and re-check 15–17: all three still look correct.
19. Anywhere a "charged price differs from resolved price" indicator appears (POS / sale detail),
    the warning-coloured figure is visible in light mode.

**Scroll, 404, sign-out**
20. Scroll to the bottom of `/admin/products`, then click through to any other admin page: the new
    page opens at the **top**. Repeat on the public storefront.
21. On a filterable list, change a filter or page number: the page does **not** jump to the top.
22. Visit `/admin/this-route-does-not-exist` while signed in as an **admin**: a bare 404 with a
    return button — **no sidebar, no admin header**.
23. Repeat 22 signed in as a **client** and while **signed out**: same bare 404 in all three cases.
24. `/admin` → user menu → **Sign out** → confirm. You land on `/login` **immediately** and stay
    there. Press the browser **Back** button: you are **not** returned to `/admin`.
25. Repeat 24 from `/staff`, and from the public storefront's account menu.
