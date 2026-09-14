# Plan — Set S29: POS workspace layout & repair device label

Target branch: `version-1-3`. Source set: `Docs/Stage-04-Fixes/sets-26-29.md` §S29.

**Sets that must land first: none.** The brief's own ordering note says *"S28 and S29 are
independent"*. Nothing here reads the settings fields, the print logo, the 80 mm receipt or the
label-print path introduced in S26.1/S27, and nothing here touches inventory. It can be executed
against the current `version-1-3` head.

**This set is 100% frontend.** No Prisma migration, no contract change, no API route, controller,
service or mapper change, no new query key, no cache invalidation change. Every field this set
writes already exists end to end. If the executor finds themselves editing anything under
`Apps/api/` or `Apps/contract/`, they have gone off-plan — stop and re-read §0.

**Set-internal order:** §2 (types constant) → §3 (focus provider) → §4 (mount the provider) →
§5 (the two layouts) → §6 (POS grid + panes) → §7 (product card) → §8 (ticket row) → §9 (POS
focus toggle / Esc / floating exit) → §10 (repairs device-label helper) → §11 (intake dialog) →
§12 (repair detail + claim slip) → §13 (translations).

§10–§12 (repairs) are fully independent of §2–§9 (POS) and may be done first if preferred.

**No test gate.** Per the Stage-04 programme rule: do not modify and do not run any test suite.
Validation is `tsc --noEmit` + lint only; the owner verifies behaviour in the browser (§15).

---

## 0. Read this first — five premises in the brief need correcting

The executor must not go looking for things that do not exist, and must not "fix" things that are
already correct.

| Brief says | Actual state | What this plan does |
|---|---|---|
| "The cause is a flex/grid child without `min-width: 0`, which lets **long product names** force the container wider" | The **mechanism** is right and there are **two** such children (§1.1). The **content** blamed is wrong: product names are already `truncate` inside `min-w-0` boxes at `PosProductSearch.tsx:100` and `PosTicket.tsx:61–62`. What actually pushes the row wide is the **ticket line's fixed-width columns**, which sum to ≈ **504 px** of irreducible width (§1.2). | §5/§6 add the missing `min-w-0`/`minmax(0,·)`, **and** §8 shrinks the ticket row's fixed columns. Doing only the first would merely move the overflow from the page to the inside of the ticket card. |
| "**Truncate** long product names to one line with an ellipsis, with the full name in a tooltip" | The truncation already exists (both sites above). Only the **tooltip** is missing. | §7.1 / §8.2 add the tooltip. Do **not** re-add `truncate`; do not remove the existing `min-w-0`. |
| "**`Repair.deviceLabel` already exists** in the schema" | True — and so does the **entire write path**: `CreateRepairSchema.deviceLabel` (`Apps/contract/src/modules/repairs/repairs.command.ts:10`), `intakeRepairSchema.deviceLabel` (`Apps/web/src/pages/staff/repairs/intake-repair.schema.ts:17`), `RepairsMapper.toPersistenceIntake` (`Apps/api/src/modules/repairs/repairs.mapper.ts:126`) and `toRepairDto` → `device.label` (`repairs.mapper.ts:64`). | §11 adds **only** the input control. Nothing else on the write path is touched. |
| "**Confirm** the label renders on the repair detail view and the claim slip" | It does **not**. `RepairTicketDetail.tsx:125` prints `brand.name + model.name` and ignores `device.label` outright. `RepairReceipt.tsx:28–30` prefers brand+model and falls back to `device.label` only when **both** are absent — precedence that becomes backwards the moment a technician can hand-edit the label. | §12 changes both to **label-wins**, through one shared helper (§10). This is a real change, not a confirmation. |
| keys go in "`Apps/web/src/config/translation.json`" | The file is **`Apps/web/src/config/translations.json`** (plural). Flat dotted keys, each value `{ "en": …, "fr": …, "ar": "" }`. | §13 adds keys there, in that shape, with `"ar": ""` like every neighbouring key. |

### One deliberate deviation from the brief, decided here

The brief lists three ways out of focus mode: *"a floating button at the top right, the **Esc**
key, or the same toggle."* Rendered literally that is two buttons within ~30 px of each other:
with the app header hidden, the POS page's own header row sits at the very top of the viewport and
its right-hand button cluster lands directly under a `fixed right-4 top-4` floating button.

**Resolution (§9.3):** there is **one** toggle button. In normal mode it sits in the POS header
row (enter). In focus mode that same button renders `fixed right-4 top-4 z-40` with the exit icon
and label — it *becomes* the floating button. All three exits in the brief are satisfied (floating
button, Esc, the toggle) by a single element, with no overlap. Record this in the report.

---

## 1. Facts established by reading the code — do not re-derive these

### 1.1 The two `min-width: auto` children that produce the horizontal scrollbar

1. `Apps/web/src/components/layout/AdminLayout.tsx:25–27` and its exact mirror
   `Apps/web/src/components/layout/StaffLayout.tsx:15–19`:
   ```tsx
   <div className="mx-auto flex max-w-7xl">
     <AdminSidebar />                                  {/* hidden w-64 shrink-0 … lg:block */}
     <main className="flex-1 p-4 sm:p-6 lg:p-8">…</main>
   </div>
   ```
   `flex-1` is `flex: 1 1 0%` — the **basis** is 0, but a flex item's `min-width` still defaults to
   `auto`, i.e. its min-content width. A wide child therefore pushes `<main>` past the row, and the
   page scrolls sideways.
2. `Apps/web/src/pages/staff/pos/StaffPos.tsx:471`:
   ```tsx
   <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
   ```
   Grid items default to `min-width: auto` for exactly the same reason, so a `3fr` track never
   shrinks below its content's min-content width.

`AdminPos.tsx` is a three-line wrapper (`<StaffPos scope="admin" />`) — fixing `StaffPos.tsx` fixes
both routes. Both layouts must be fixed because POS is mounted under both shells.

### 1.2 Why `min-width: 0` alone is not enough — the ticket row's irreducible width

`Apps/web/src/pages/staff/pos/components/PosTicket.tsx:60–126`, one line row:

| Child | Classes | Width |
|---|---|---|
| row padding | `p-4` | 32 |
| 5 × gap | `gap-3` | 60 |
| product name | `min-w-0 flex-1` | **0** (already shrinks) |
| qty stepper | two `h-7 w-7` buttons + `w-6` span + 2 × `gap-1` | 88 |
| charged-price input | `w-24` | 96 |
| `ResolvedVsChargedPrice` | `w-24` | 96 |
| line total | `w-24` | 96 |
| remove button | `size="icon"` → `h-9 w-9` (`button.tsx:24`) | 36 |
| | **min-content** | **≈ 504 px** |

At the `lg` breakpoint (1024 px) with the sidebar (256) and `lg:p-8` (2 × 32) and `gap-6` (24), the
grid has 680 px; the `3fr` track gets 408 px. 504 > 408 — so after §6 the overflow would simply
move inside the ticket card. §8.1 shrinks the row to **≈ 424 px** and §8.3 adds an
`overflow-x-auto` containment guarantee so a future addition can never reach the page again.

### 1.3 The "recompute a default unless the user edited it" pattern already in this codebase

`Apps/web/src/pages/admin/products/AdminProductsAdd.tsx:87, 117–125, 241–315` — the product-name
auto-fill. This is the pattern §11 copies, and it is **imperative, not an effect**:

```tsx
const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
const brandName = brands?.find((b) => b.id === brandId)?.name ?? "";

const recomputeName = (nextFamily: string, nextBrand: string, nextModel: string) => {
  if (nameManuallyEdited) return;
  const parts = [nextFamily, nextBrand, nextModel].filter(Boolean);
  if (parts.length) setValue("name", parts.join(" "));
};
// …called from every select's onChange AND from every onCreateNew success, with the *next* name
// in hand: recomputeName(familyName, brand.name, modelName)
// …and the flag is set from the input itself:
{...register("name", { onChange: () => setNameManuallyEdited(true) })}
```

**Why imperative and not a `useEffect` on `[brandId, deviceModelId]`:** the display names live in
two separately-fetched lists (`useCatalogBrands()`, `useCatalogModels({brandId})`, the latter
`enabled: !!brandId`), so an effect keyed on the ids would fire *before* the names arrive and write
a half-built label. At each call site the chosen entity — including a just-created one — is already
in hand. Copy the shape exactly.

`setValue()` does **not** fire `register`'s `onChange`, so the auto-fill can never mark itself as
user-edited. That is what makes the flag correct.

### 1.4 Escape and `useKeyboardShortcuts`

`Apps/web/src/hooks/use-keyboard-navigation.ts:261–285`: `useKeyboardShortcuts` attaches a
**document-level** `keydown` listener and calls `event.preventDefault()` for **every** key it has a
handler for. `StaffPos.tsx:411–417` already uses it for `f2`/`f4`/`enter`.

**Do not add `escape` to that map.** Radix's dismissable-layer Escape handling is also document
level, and the POS mounts three Radix overlays (`QuickAddPosClientDialog`, `MyDraftsDrawer`, plus
any alert dialog). A preventDefaulting page-wide Escape is exactly the kind of thing that stops a
dialog closing. §9.2 uses its own listener that never calls `preventDefault` and stands down while
an overlay is open.

### 1.5 Printing is not affected by any of this

`Apps/web/src/lib/print.ts` + the `@media print` blocks in `Apps/web/src/index.css` mask the screen
tree entirely (`body.printing-receipt * { visibility: hidden }` / `body.printing-labels > *:not(#label-print-portal) { display: none }`).
Hiding the header and sidebar on screen changes nothing about any print. No print code is touched
by this set.

### 1.6 Per-workstation preference persistence — the S27 precedent

`Apps/web/src/hooks/use-label-size.ts` + `Apps/web/src/types/label-print.types.ts:40–42`: the
constant key lives in `src/types/`, the read is lazy `useState(initializer)` wrapped in
`try/catch` (a browser with storage disabled must not crash the page), and the write is also
`try/catch`'d with a comment saying the feature still works for the session, it just will not
persist. §2/§3 follow this shape exactly — focus mode is likewise a property of *that counter's
browser*, not of the store, so it is `localStorage`, not a server setting.

---

## 2. `Apps/web/src/types/workspace-focus.types.ts` — **new file**

The storage key, as a named constant (hard rule §1: single-side values live in that side's `types`
folder).

```ts
// S29 — POS focus mode. Web-only: nothing back-end knows this exists. localStorage rather than a
// store setting, for the same reason as LABEL_SIZE_STORAGE_KEY (label-print.types.ts) — this is a
// property of the individual till's browser, not of the store.
export const WORKSPACE_FOCUS_STORAGE_KEY = "dt_pos_focus";
```

---

## 3. `Apps/web/src/components/providers/WorkspaceFocusProvider.tsx` — **new file**

The POS page owns the toggle, but the header and sidebar it has to hide are owned by
`AdminLayout`/`StaffLayout`, which are the POS page's **ancestors**. A context is the only way the
state can travel upwards. Model it on `LanguageProvider.tsx` (same `createContext` + null-guarded
`useX()` throw shape).

### 3.1 The value shape

```ts
interface WorkspaceFocusValue {
  /** The remembered preference. Stays true even when no focus-capable page is mounted. */
  focusPreferred: boolean;
  setFocusPreferred: (next: boolean) => void;
  /** focusPreferred AND a focus-capable page is currently mounted. The layouts read THIS. */
  chromeHidden: boolean;
  /** Called by a focus-capable page on mount (true) and unmount (false). */
  registerFocusScope: (active: boolean) => void;
}
```

**Why two flags and not one.** The preference must survive across sessions (brief: *"Remember the
preference so the counter stays in focus mode across sessions"*), but focus mode must apply **only
on the POS page** — a counter who left focus mode on must not find `/admin/settings` or
`/staff/repairs` rendering with no navigation at all. `chromeHidden = focusPreferred && scopeCount > 0`
gives both.

### 3.2 Implementation notes the executor must follow

- `focusPreferred` initial value: `useState(readStoredPreference)` — lazy initializer, and
  `readStoredPreference()` is `try { localStorage.getItem(WORKSPACE_FOCUS_STORAGE_KEY) === "true" } catch { return false }`.
- `setFocusPreferred(next)` sets state then writes `String(next)` inside its own `try/catch` with
  the "storage disabled — works for this session, just will not persist" comment.
- Scope tracking is a **counter** (`const [scopeCount, setScopeCount] = useState(0)`), not a
  boolean: `registerFocusScope` must use the functional form
  (`setScopeCount((n) => n + (active ? 1 : -1))`) and be wrapped in `useCallback(…, [])` so it is
  referentially stable. A stable identity is load-bearing — §3.3's effect depends on it, and an
  unstable one would register/unregister on every render. The counter (rather than a bool) keeps
  React StrictMode's dev-only mount → unmount → mount cycle balanced.
- Export `useWorkspaceFocus()` with the `if (!c) throw new Error("useWorkspaceFocus outside provider")`
  guard, mirroring `useLanguage()`.

### 3.3 `useWorkspaceFocusScope()` — exported from the same file

```tsx
// Declares "this page supports focus mode". Mount/unmount registration is what confines focus mode
// to the POS while still remembering the preference globally.
export function useWorkspaceFocusScope(): WorkspaceFocusValue {
  const ctx = useWorkspaceFocus();
  const { registerFocusScope } = ctx;
  useEffect(() => {
    registerFocusScope(true);
    return () => registerFocusScope(false);
  }, [registerFocusScope]);
  return ctx;
}
```

---

## 4. `Apps/web/src/main.tsx` — mount the provider

Wrap `<AuthProvider>` with `<WorkspaceFocusProvider>`, inside `<LanguageProvider>`:

```tsx
<LanguageProvider>
  <WorkspaceFocusProvider>
    <AuthProvider>
      <App />
      <Toaster richColors position="bottom-right" />
    </AuthProvider>
  </WorkspaceFocusProvider>
</LanguageProvider>
```

It must sit above `<App />` because both the layouts and the POS page live inside the router.
It does not depend on auth, so its exact position relative to `AuthProvider` is only a convention —
keep it as written so the diff is one nesting level.

---

## 5. The two layout shells

Three changes each, identical in both files. Both need `import { cn } from "@/lib/utils"` and
`import { useWorkspaceFocus } from "@/components/providers/WorkspaceFocusProvider"`.

### 5.1 `Apps/web/src/components/layout/AdminLayout.tsx:22–32`

```tsx
export function AdminLayout({ children }: Props) {
  const { chromeHidden } = useWorkspaceFocus();
  return (
    <div className="min-h-screen bg-surface">
      <ScrollToTop />
      {!chromeHidden && <AdminHeader />}
      <div className="flex w-full pl-2">
        {!chromeHidden && <AdminSidebar />}
        <main className={cn("min-w-0 flex-1", chromeHidden ? "p-2" : "p-4 sm:p-6 lg:p-8")}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
```

Three distinct edits, each with its own reason — keep them distinguishable in the diff:

1. **`min-w-0` on `<main>`** — the §1.1 fix. This is the one that removes the horizontal
   scrollbar; everything else is cosmetic.
2. **`mx-auto flex max-w-7xl` → `flex w-full pl-2`** — the brief's *"Move the sidebar flush to the
   left with a small margin, reclaiming the wasted gutter."* `max-w-7xl` is 1280 px, so on a
   1440 px screen 160 px was being thrown away as symmetric gutter. `pl-2` is the "small margin".
3. **Conditional chrome + padding** — focus mode.

### 5.2 `Apps/web/src/components/layout/StaffLayout.tsx:12–22`

Identical, with `StaffHeader`/`StaffSidebar` and no `children` prop. The existing comment
(*"Mirrors AdminLayout.tsx"*) stays true and needs no edit.

### 5.3 Ripple the executor must record in the report

Change (2) is **layout-level and therefore global**: every `/admin/*` and `/staff/*` page becomes
full-width instead of capped at 1280 px. That is intended — the brief asks for the gutter back, and
the wide admin tables (inventory, statistics, movement ledger) benefit — but it is a visible change
on ~30 pages that the owner did not ask about page by page. **Call it out explicitly in
`report-S29.md` and in the §15 checklist** so it gets looked at, and note that reverting it is a
one-token change (`flex w-full pl-2` → `mx-auto flex max-w-7xl`) that does **not** undo the
scrollbar fix.

`PublicLayout.tsx` is **not** touched — the storefront's centred measure is deliberate.

---

## 6. `Apps/web/src/pages/staff/pos/StaffPos.tsx:471` — grid tracks and pane balance

```tsx
// S29 — minmax(0,·) rather than a bare fr: a grid item's min-width defaults to auto, so a 3fr
// track could not shrink below the ticket row's min-content width and the whole page scrolled
// sideways. The ratio also shifts 2:3 -> 1:2 toward the ticket, which holds the editable quantity
// and price inputs and needs the room more than the read-only product list does.
<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
```

Concretely, on a 1440 px screen after §5 (1440 − 256 sidebar − 8 `pl-2` − 64 `lg:p-8` − 24 gap =
1088): the product list gets **363 px** and the ticket **725 px**, against 435/653 before. The
product card at 363 px is comfortable; §7.2 handles the four-price line at that width.

Nothing else in this file changes in §6. Leave the `receipt ? … : …` branch, the state and the
effects alone.

---

## 7. `Apps/web/src/pages/staff/pos/components/PosProductSearch.tsx` — card readability

### 7.1 Full name in a tooltip (line 100)

```tsx
<div className="min-w-0 truncate font-medium" title={product.name}>{product.name}</div>
```

**Use the native `title` attribute, not the Radix `Tooltip`.** Justification to record in the
report: this list renders up to 20 cards and is tapped rapidly by a cashier; a Radix tooltip means
20 extra `Tooltip` roots plus a hover-delay popover firing during scan-and-tap, which fights the
exact rhythm the brief is trying to protect. `title` is zero-cost, needs no provider, and works on
the truncated element itself. If the owner asks for a styled tooltip later it is a local swap to
the `TooltipProvider`/`Tooltip`/`TooltipTrigger asChild` shape already used in
`Apps/web/src/pages/admin/pos-clients/components/pos-clients-table.tsx:122–145`.

### 7.2 The four-price line elides before the name does (lines 108–117)

The brief: *"Keep the four-price line on the product card readable at the narrower width — it is
secondary information and may shrink or elide before the name does."* Today it is free-flowing text
that wraps to two or three lines at 363 px, breaking the card rhythm.

- Add `truncate` to that `<div className="text-xs text-muted-foreground">` so it stays on exactly
  one line and ellipsises.
- Give the same `<div>` a `title` carrying the full breakdown, so nothing becomes unreachable.
  Build it once above the JSX, next to `const breakdown = posPriceBreakdown(product)`:
  ```tsx
  const breakdownTitle = [
    `${t("staff.pos.search.defaultPriceLabel")} ${formatDZD(product.defaultSalePrice ?? 0, language)}`,
    ...breakdown.map((e) => `${e.label} ${formatDZD(e.price, language)}`),
  ].join(" · ");
  ```
- Do **not** change `text-muted-foreground` or `text-xs`. This line is secondary by design and the
  brief confirms it.

Leave the stock/brand line (105–107) as it is — it is short and already fits.

Update the component's header comment (lines 26–30) to mention that the breakdown line now
ellipsises with its full content in `title`, since that comment currently describes it only as
"secondary, visually muted".

---

## 8. `Apps/web/src/pages/staff/pos/components/PosTicket.tsx` — the row must actually fit

### 8.1 Shrink the fixed columns (the §1.2 arithmetic)

In the row `<div>` at line 60 and its children:

| Element | Line | From | To |
|---|---|---|---|
| row container | 60 | `flex items-center gap-3 p-4` | `flex items-center gap-2 p-3` |
| charged-price `Input` | 98–105 | `className="w-24"` | `className="w-20"` |
| `ResolvedVsChargedPrice` wrapper | 107 | `className="w-24 text-right"` | `className="w-20 text-right"` |
| line total | 114 | `className="w-24 text-right font-semibold"` | `className="w-20 text-right font-semibold"` |
| remove `Button` | 118–125 | `size="icon"` | `size="icon" className="h-8 w-8 shrink-0"` (and the `Trash2` drops to `h-3.5 w-3.5`) |

New min-content width: 24 + 40 + 88 + 80 + 80 + 80 + 32 = **424 px**, which clears the 408 px the
`lg` breakpoint affords and leaves headroom at every width above it.

Add `shrink-0` to the qty-stepper wrapper (line 70) and to the three fixed-width boxes, so the
browser shrinks the **name** (which has `min-w-0` and truncates) rather than the numbers.

### 8.2 Full name in a tooltip (line 62)

```tsx
<div className="truncate font-medium" title={line.productName}>{line.productName}</div>
```

Same native-`title` reasoning as §7.1. The serials line at 63–67 is already `truncate`; give it a
`title={line.serialNumbers.join(", ")}` too, for the same reason.

### 8.3 Containment guarantee

On the lines wrapper at line 58, `divide-y divide-border` → `divide-y divide-border overflow-x-auto`.

If a future change ever pushes a row past the pane again, it scrolls **inside the ticket card**
instead of scrolling the whole page — which is the defect this set exists to remove. Add a
one-line comment saying exactly that, so a later reader does not delete it as decoration.

### 8.4 Comment maintenance

The header comment at lines 33–35 stays accurate. Add a line recording the S29 width budget
("the fixed columns sum to ≈424 px — that figure is what lets the ticket pane shrink to the lg
breakpoint without the page scrolling sideways; widening any of them needs the §1.2 arithmetic
redone"), because the `w-20`s otherwise look arbitrary and are the first thing someone would widen.

---

## 9. `Apps/web/src/pages/staff/pos/StaffPos.tsx` — focus mode

### 9.1 Wire the scope

At the top of the component, alongside `const { t } = useTranslation()`:

```tsx
// S29 — declares the POS as focus-capable. The preference itself is remembered globally
// (localStorage), but the chrome only actually hides while this page is mounted.
const { focusPreferred, setFocusPreferred, chromeHidden } = useWorkspaceFocusScope();
```

New imports: `useWorkspaceFocusScope` from the provider, and `Maximize2`, `Minimize2` from
`lucide-react` (added to the existing `FileStack` import line).

### 9.2 Escape

A dedicated effect — **not** `useKeyboardShortcuts` (§1.4):

```tsx
// Esc leaves focus mode. Deliberately NOT routed through useKeyboardShortcuts: that hook
// preventDefaults every key it handles, and Escape belongs to whichever Radix overlay is open
// (quick-add client, drafts drawer). This listener never preventDefaults, stands down while any
// overlay is open, and is only attached while the chrome is actually hidden.
useEffect(() => {
  if (!chromeHidden) return;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    setFocusPreferred(false);
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [chromeHidden, setFocusPreferred]);
```

### 9.3 The single toggle / floating-exit button

In the header row at lines 427–445, as the **first** child of the `<div className="flex gap-2">`
cluster (before `MyDraftsDrawer`):

```tsx
<Button
  variant="outline"
  size={chromeHidden ? "icon" : "default"}
  onClick={() => setFocusPreferred(!focusPreferred)}
  aria-label={chromeHidden ? t("staff.pos.focus.exit") : t("staff.pos.focus.enter")}
  // S29 — one button, three exits. In focus mode it detaches from this row and pins itself to the
  // viewport's top-right, which is the brief's "floating button"; rendering a second, separate
  // floating button would land it on top of this one once the app header is gone.
  className={cn(chromeHidden && "fixed right-4 top-4 z-40 shadow-lg")}
>
  {chromeHidden ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
  {!chromeHidden && t("staff.pos.focus.enter")}
</Button>
```

Needs `import { cn } from "@/lib/utils"` in this file.

`z-40` is chosen to sit **above** page content and the app header (`z-30`, `AdminHeader.tsx:44` /
`StaffHeader.tsx:49`) but **below** every Radix overlay (`dialog.tsx:24,41` and `sheet.tsx:24,34`
are all `z-50`), so a dialog or drawer opened while in focus mode still covers the exit button
rather than having it punch through the backdrop.

### 9.4 What focus mode must *not* do

- **Do not use the Fullscreen API.** The brief is explicit: it interferes with barcode scanners and
  print dialogs. This is a pure CSS/React layout toggle and nothing in this set may call
  `requestFullscreen`.
- Do not gate the receipt view on focus mode — `PosReceiptView` keeps rendering normally in both
  states, and `printReceipt` is unaffected (§1.5).
- Do not persist anything server-side. No settings field, no contract change.
- Note for the report: with the header hidden, the mobile nav Sheet (which lives *in* the header)
  is unavailable. Focus mode is a desktop till feature and the exit button is always on screen, so
  this is acceptable — but say so rather than leaving it to be discovered.

---

## 10. `Apps/web/src/pages/staff/repairs/repair-device-label.ts` — **new file**

One helper module, so the intake default and the two display sites cannot drift apart.

```ts
import type { RepairDto } from "@dragon-telecom/contract";

// S29 — the intake dialog's default for Repair.deviceLabel: "Samsung S24 Ultra". Blanks dropped so
// a brand chosen before its model yields "Samsung", not "Samsung ".
export function buildDeviceLabelDefault(brandName?: string, modelName?: string): string {
  return [brandName, modelName].filter(Boolean).join(" ");
}

// S29 — what to show wherever a repair's device is named. The stored free-text label WINS over the
// brand/model pair: from S29 on it is prefilled from that pair and then freely editable, so a label
// that differs from brand+model is the technician's correction and must not be overruled by a
// derived string. `?? ""` is not enough — the intake form posts "" for an untouched optional text
// input (the same shape deviceImei/reportedIssueOther have always had), so the blank must fall
// through to the pair.
export function formatRepairDeviceLabel(device: RepairDto["device"]): string {
  return device.label?.trim() || buildDeviceLabelDefault(device.brand?.name, device.model?.name);
}
```

`RepairDto["device"]` is `{ brand?: {id,name}; model?: {id,name}; label?: string; imei?: string }`
(`Apps/contract/src/modules/repairs/repairs.dtos.ts:14–19`) — take the type from the DTO, do not
re-declare it.

---

## 11. `Apps/web/src/pages/staff/repairs/components/IntakeDialog.tsx` — the device-label field

### 11.1 Fix the misleading id on the IMEI field first (lines 166–169)

```tsx
<Label htmlFor="intake-device-imei">{t("staff.repairs.intake.imeiLabel")}</Label>
<Input id="intake-device-imei" {...register("deviceImei")} />
```

The IMEI input currently carries `id="intake-device-label"`, which is about to become actively
wrong (and would be a duplicate id). Rename both the `htmlFor` and the `id`. Nothing else in the
app selects on it — verified, no `getElementById`/CSS/test reference exists to that string outside
this file.

### 11.2 Track manual edits + derive the display names

Alongside the existing `const brandId = watch("brandId")`:

```tsx
const [deviceLabelEdited, setDeviceLabelEdited] = useState(false);
const brandName = brands?.find((b) => b.id === brandId)?.name ?? "";
const modelName = models?.find((m) => m.id === watch("deviceModelId"))?.name ?? "";

// S29 — mirrors AdminProductsAdd's auto-name (imperative, called with the *next* names from each
// picker's own handler, never from an effect on the ids: the brand/model name lists are fetched
// separately and an id-keyed effect would fire before the names arrive and write a half-built
// label). setValue does not fire register's onChange, so the auto-fill can never mark itself
// as user-edited.
const recomputeDeviceLabel = (nextBrand: string, nextModel: string) => {
  if (deviceLabelEdited) return;
  setValue("deviceLabel", buildDeviceLabelDefault(nextBrand, nextModel));
};
```

Reset the flag whenever the dialog opens, so the next ticket starts fresh:

```tsx
useEffect(() => {
  if (open) setDeviceLabelEdited(false);
}, [open]);
```

New imports: `useEffect`, `useState` from `react`; `buildDeviceLabelDefault` from
`@/pages/staff/repairs/repair-device-label`.

### 11.3 Call it from all four picker handlers

| Handler | Line | Add |
|---|---|---|
| brand `onChange` | 114–122 | after `setValue("deviceModelId", undefined)`: `recomputeDeviceLabel(brand.name, "")` — the cascading model reset means the model half is genuinely gone |
| brand `onCreateNew` → `onSuccess` | 128–131 | after the two `setValue`s: `recomputeDeviceLabel(brand.name, "")` |
| model `onChange` | 142–145 | inside `if (model)`: `recomputeDeviceLabel(brandName, model.name)` |
| model `onCreateNew` → `onSuccess` | 153 | `recomputeDeviceLabel(brandName, model.name)` |

### 11.4 The field itself — insert between the brand/model row (ends line 164) and the IMEI field

```tsx
<div className="space-y-1">
  <Label htmlFor="intake-device-label">{t("staff.repairs.intake.deviceLabelLabel")}</Label>
  <Input
    id="intake-device-label"
    placeholder={t("staff.repairs.intake.deviceLabelPlaceholder")}
    {...register("deviceLabel", { onChange: () => setDeviceLabelEdited(true) })}
  />
  <p className="text-xs text-muted-foreground">
    {t("staff.repairs.intake.deviceLabelHelper")}
  </p>
</div>
```

It is optional in `intakeRepairSchema` (line 17) and stays optional — *"When no brand or model is
selected, the field stays empty and editable, preserving its existing role as the fallback for
unlisted devices."* No error paragraph is needed; the schema can never reject it.

### 11.5 Do not touch

`intake-repair.schema.ts` — `deviceLabel: z.string().optional()` is already correct, and its
`_CreateRepairCommandCheck` compile-time guard already passes. **Do not add a `.transform()` or a
`z.preprocess()` to normalise `""` → `undefined`:** S3's execution recorded that `z.preprocess`
breaks `zodResolver`'s inference in this codebase, and §10's helper already treats a blank label
as absent at every display site. `StaffRepairs.tsx`'s `handleIntakeSubmit` passes the form values
straight through and needs no change.

The dialog also does not `reset()` its form when it closes, so reopening it shows the previous
ticket's values. That is **pre-existing** and out of scope for S29 — note it in the report as an
observation, do not fix it here.

---

## 12. Render the label where it matters

### 12.1 `Apps/web/src/pages/staff/repairs/components/RepairTicketDetail.tsx:124–127`

```tsx
<div className="text-muted-foreground">
  {formatRepairDeviceLabel(repair.device)}
  {repair.device.imei ? ` · IMEI ${repair.device.imei}` : ""}
</div>
```

replacing the current `{repair.device.brand?.name} {repair.device.model?.name}`, which ignores
`device.label` outright.

### 12.2 `Apps/web/src/pages/staff/repairs/components/RepairReceipt.tsx:28–30` — the claim slip

```tsx
const deviceLabel = formatRepairDeviceLabel(repair.device);
```

replacing the current brand+model-first expression. **This inverts the precedence** — see §0's
fifth row. Keep the `{deviceLabel && (…)}` guard at line 87 as it is; the helper returns `""` for a
device with no brand, no model and no label, which is still the right reason to hide the block.

The hard rule in this file's header comment (never print margins) is untouched by this change and
must stay.

### 12.3 `Apps/web/src/pages/staff/repairs/components/RepairBoard.tsx:214`

The board card shows `{repair.device.brand?.name} {repair.device.model?.name}`. Switch it to
`{formatRepairDeviceLabel(repair.device)}` as well — the brief only names the detail view and the
claim slip, but leaving one of the three device renderings on the old precedence would mean a card
and its own detail sheet disagreeing about what the device is. One-line change, same import.

---

## 13. `Apps/web/src/config/translations.json`

Five new keys. Insert each next to its existing sibling block so the file stays grouped
(`staff.pos.*` around line 10382–10472, `staff.repairs.intake.*` around line 11582). Every value
object carries `"ar": ""`, like every neighbouring key.

| Key | en | fr |
|---|---|---|
| `staff.pos.focus.enter` | `Focus mode` | `Mode concentration` |
| `staff.pos.focus.exit` | `Exit focus mode` | `Quitter le mode concentration` |
| `staff.repairs.intake.deviceLabelLabel` | `Device (optional)` | `Appareil (facultatif)` |
| `staff.repairs.intake.deviceLabelPlaceholder` | `e.g. Samsung S24 Ultra` | `ex. Samsung S24 Ultra` |
| `staff.repairs.intake.deviceLabelHelper` | `Prefilled from the brand and model — edit it freely.` | `Prérempli à partir de la marque et du modèle — modifiable librement.` |

No key is needed for the tooltips (§7.1, §7.2, §8.2): their content is data — the product name, the
serial list, the price breakdown — not copy.

---

## 14. Validation gates

From the repo root, exactly these, no test suite:

```
npm --workspace Apps/web run check    # tsc --noEmit && tsc --noEmit -p tsconfig.test.json
npm --workspace Apps/web run lint     # eslint .
```

Note that `check` compiles `tsconfig.test.json` too, so it type-checks the existing test files
against the changed components. **That is a compile check only — it is not running them, and it does
not license editing them.** Nothing in this set changes a prop type or a public signature, so they
should compile unchanged; if one does not, report it, do not edit it.

`Apps/contract` and `Apps/api` are untouched by this set; running their gates is harmless but
proves nothing. If either web gate reports a pre-existing failure unrelated to the files listed
above, record it in the report rather than fixing it.

Grep gate before declaring done — each of these must return **nothing**:

- `grep -rn "max-w-7xl" Apps/web/src/components/layout/` — both layouts converted.
- `grep -rn "requestFullscreen" Apps/web/src/` — the Fullscreen API was not used.
- `grep -rn "lg:grid-cols-\[2fr_3fr\]" Apps/web/src/` — the old POS grid is gone.
- `grep -n 'intake-device-label' Apps/web/src/pages/staff/repairs/components/IntakeDialog.tsx | grep -E 'deviceImei|imeiLabel'` — the id/`htmlFor` no longer sits on the IMEI field (it must now appear only on the new device-label field).

And each of these must return a hit:

- `grep -rn "formatRepairDeviceLabel" Apps/web/src/pages/staff/repairs/` — three call sites (§12.1–§12.3).
- `grep -rn "min-w-0 flex-1" Apps/web/src/components/layout/` — `<main>` in both shells.

---

## 15. Manual verification checklist (the owner, in a browser)

### POS layout

1. `/staff/pos` at a **1366×768** window, then **1280×800**, then a window narrowed to exactly the
   `lg` breakpoint (1024 px): **no horizontal scrollbar** at any of the three, and the cart/ticket
   panel is fully visible with its Confirm button reachable without sideways scrolling.
2. Add a product with a very long name (e.g. `AFFICHEUR ACE BUZZ 6 PRIME • BUZZ 7 LITE • BUZZ 7
   PRIME • BUZZ 7 PRIM…`). In **both** the search results and the ticket, the name is one line with
   an ellipsis and hovering it shows the full name. The card's height has not grown.
3. Hover the four-price line on a product card that has all four prices: it is one ellipsised line
   and the hover reveals the full breakdown.
4. The sidebar now starts at the left edge of the window (small gap only), not floating in a
   centred column. **Then spot-check three other pages** — `/admin/inventory`, `/admin/statistics`
   and `/staff/repairs` — since this change is global: confirm the wider content reads acceptably
   and nothing is stretched in a way you dislike. If you want the old centred measure back, say so;
   it is a one-line revert that does not undo step 1.
5. Repeat step 1 at `/admin/pos` — the admin twin mounts the same component.

### Focus mode

6. Click **Focus mode** in the POS header: the app header and the sidebar disappear and the
   workspace fills the window edge to edge. The exit button is pinned at the top right.
7. Press **Esc** — focus mode exits. Re-enter it, then click the pinned exit button — it exits.
8. Re-enter focus mode, then **reload the page**: it comes back still in focus mode.
9. Still in focus mode, navigate to `/staff/repairs` (or any other page): **the header and sidebar
   are back** — focus mode applies only to the POS. Navigate back to `/staff/pos`: focus mode is
   active again.
10. In focus mode, open the **quick-add client** dialog and press **Esc** — the dialog closes and
    focus mode stays on. Open the **My drafts** drawer and press Esc — same.
11. In focus mode, complete a sale and press **Print** on the receipt. **Print to the actual
    thermal printer**, not just the preview: the 80 mm receipt comes out exactly as it does outside
    focus mode — same width, same content, no chrome, nothing clipped.
12. Also confirm a **barcode label** print is unaffected: `/admin/products` → label dialog → print
    to the **actual label printer** and check the labels feed correctly.

### Repairs — device label

13. `/staff/repairs` → **New intake**. Pick brand `Samsung`: the Device field reads `Samsung`. Pick
    model `S24 Ultra`: it reads `Samsung S24 Ultra`.
14. Type over it — e.g. `Samsung S24 Ultra (dual SIM, blue)`. Now change the **model**: your text
    is **not** overwritten.
15. Close the dialog and open a fresh intake, choose a brand and model: the field auto-fills again
    (the edited flag resets per ticket).
16. Create a repair with no brand and no model at all, typing only a free-text device
    (`Nokia 3310 — unlisted`). It saves.
17. Open each of those tickets: the **board card**, the **detail sheet** and the **printed claim
    slip** all show the label you typed — not a brand+model string that contradicts it. **Print the
    claim slip to the actual thermal printer** and read the Device line on paper.
18. Open an **older repair created before this set** (one with a brand/model but no stored label):
    all three surfaces still show `brand model` as before. Nothing regressed for existing tickets.

---

## 16. Files touched — complete list

**New (3)**

- `Apps/web/src/types/workspace-focus.types.ts`
- `Apps/web/src/components/providers/WorkspaceFocusProvider.tsx`
- `Apps/web/src/pages/staff/repairs/repair-device-label.ts`

**Modified (11)**

- `Apps/web/src/main.tsx`
- `Apps/web/src/components/layout/AdminLayout.tsx`
- `Apps/web/src/components/layout/StaffLayout.tsx`
- `Apps/web/src/pages/staff/pos/StaffPos.tsx`
- `Apps/web/src/pages/staff/pos/components/PosProductSearch.tsx`
- `Apps/web/src/pages/staff/pos/components/PosTicket.tsx`
- `Apps/web/src/pages/staff/repairs/components/IntakeDialog.tsx`
- `Apps/web/src/pages/staff/repairs/components/RepairTicketDetail.tsx`
- `Apps/web/src/pages/staff/repairs/components/RepairReceipt.tsx`
- `Apps/web/src/pages/staff/repairs/components/RepairBoard.tsx`
- `Apps/web/src/config/translations.json`

**Deliberately not touched:** everything under `Apps/api/` and `Apps/contract/`,
`Apps/web/src/lib/print.ts`, `Apps/web/src/index.css`,
`Apps/web/src/pages/staff/repairs/intake-repair.schema.ts`,
`Apps/web/src/components/layout/PublicLayout.tsx`, and every test file.
