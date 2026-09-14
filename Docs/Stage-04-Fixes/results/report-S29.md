# Report — Set 29: POS workspace layout & repair device label

Executed against
`Docs/Stage-04-Fixes/plans/plan-S29-pos-layout-and-repair-device-label.md` on `version-1-3`,
2026-09-14. Independent of every other set in this run — no `Apps/api/` or `Apps/contract/` file
was touched; this is a pure `Apps/web` change.

## Summary

All twelve numbered sections of the plan landed exactly as specified, in the plan's own dependency
order (types constant → focus provider → mount → the two layouts → POS grid → product card →
ticket → focus toggle/Esc/floating exit → repairs device-label helper → intake dialog → repair
detail/receipt/board → translations):

1. **POS horizontal scroll** — both offending `min-width: auto` children fixed: `<main>` in
   `AdminLayout.tsx`/`StaffLayout.tsx` gained `min-w-0 flex-1`, and `StaffPos.tsx`'s grid changed
   from `lg:grid-cols-[2fr_3fr]` to `lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`. Per the plan's own
   arithmetic (§1.2), the ticket row's fixed columns were also shrunk (`gap-3 p-4` → `gap-2 p-3`,
   three `w-24` columns → `w-20`, the remove button `size="icon"` (36px) → an explicit `h-8 w-8`
   (32px) with a smaller icon) to bring the row's min-content width down to ≈424px, comfortably
   under the ~408px the `lg` breakpoint now affords the ticket pane. An `overflow-x-auto`
   containment guarantee was added to the ticket's line-list wrapper as specified.
2. **Sidebar flush-left / gutter reclaim** — both layouts changed `mx-auto flex max-w-7xl` to
   `flex w-full pl-2`. This is global (see Deviations/Notes below).
3. **Tooltips** — native `title` attributes added to the product-search card's name and price
   breakdown (which also gained `truncate` — it previously wrapped to 2–3 lines at the narrower
   card width) and to the ticket row's product name and serials line. No Radix `Tooltip` was used,
   per the plan's reasoning (hover-delay popovers on a rapidly scanned/tapped list fight the
   scan-and-tap rhythm).
4. **Focus mode** — new `WorkspaceFocusProvider` (two-flag model: a globally-persisted
   `focusPreferred` in `localStorage`, gated by a `scopeCount` so the chrome only actually hides
   while a focus-capable page — today, only POS — is mounted), mounted in `main.tsx` between
   `LanguageProvider` and `AuthProvider`. `StaffPos.tsx` (shared by `/staff/pos` and `/admin/pos`)
   declares itself focus-capable via `useWorkspaceFocusScope()`, adds a single header button that
   becomes the fixed top-right exit button once focus mode is active, and a dedicated
   non-preventDefault Escape listener that stands down while any Radix dialog is open. The
   Fullscreen API was not used anywhere.
5. **Repair device label** — new `repair-device-label.ts` helper (`buildDeviceLabelDefault`,
   `formatRepairDeviceLabel`) shared by three call sites: `IntakeDialog.tsx` (auto-fill, mirroring
   `AdminProductsAdd.tsx`'s imperative name-recompute pattern, reset per ticket on dialog open),
   and the two display sites `RepairTicketDetail.tsx` and `RepairReceipt.tsx`. `RepairBoard.tsx`'s
   kanban card was also switched to the helper — the plan flagged this as a one-line addition
   beyond the brief's named two surfaces, to keep the board card, the detail sheet and the claim
   slip from disagreeing about what the device is.
6. **Translations** — 5 new keys added to `translations.json` next to their existing sibling
   blocks (`staff.pos.focus.*` beside `staff.pos.pageTitle`; the three
   `staff.repairs.intake.deviceLabel*` keys beside `imeiLabel`), each with `en`/`fr` filled and
   `ar: ""` matching every neighbouring key.

## Deviations from the plan

None of substance. Two things worth flagging, both anticipated by the plan itself:

- **§5.3's global gutter-reclaim ripple is real and as described.** Every `/admin/*` and
  `/staff/*` page is now full-width instead of capped at 1280px. This was called out explicitly in
  the plan as something the owner should look at rather than something quietly slipped in — see
  the manual verification checklist's step 4, which asks the owner to spot-check
  `/admin/inventory`, `/admin/statistics` and `/staff/repairs` specifically. Reverting it is a
  one-token change (`flex w-full pl-2` → `mx-auto flex max-w-7xl`) that does not touch the
  scrollbar fix.
- **One syntax correction during execution, not a plan change.** The plan's §6 code sample placed
  a JSX-style `{/* comment */}` directly inside a ternary's parenthesized branch
  (`receipt ? (...) : ({/* comment */} <div>...)`), which is JS/TS expression context, not JSX
  children context, and does not parse there. Written as a plain `//` comment instead — same
  content, same location, no behavioural difference. Caught immediately by `tsc --noEmit` on first
  run.

## Validation

- `npm run check` (`tsc --noEmit && tsc --noEmit -p tsconfig.test.json`) in `Apps/web`: the
  **main** project compiles with **zero errors**. The **test** project reports 58 lines of
  pre-existing errors, all in `tests/` files this set did not touch (stale mocks/handlers for
  orders/billing/inventory/statistics hooks predating this set — the same class of breakage S28's
  report already recorded for `getStock`). Confirmed pre-existing by stashing this set's changes
  and re-running against the clean `version-1-3` head: identical 58-line output. Per the programme
  rule, these were left alone and are reported here, not fixed.
- `npm run lint` (`eslint .`) project-wide: ~3,194 problems, all pre-existing prettier-quote/
  spacing noise across unrelated files (matches the ~10.2k-finding baseline recorded after
  Stage-03 Sub-01). Re-run scoped to only the 13 files this set touched (11 modified + 3 new):
  **zero errors**, two `react-refresh/only-export-components` warnings on the new
  `WorkspaceFocusProvider.tsx` — confirmed as an accepted, pre-existing pattern by checking that
  `LanguageProvider.tsx` (component + hook in one file, same shape) carries the identical warning.
- Grep gates from the plan's §14 — all passed:
  - `max-w-7xl` in `components/layout/`: no hits (both layouts converted).
  - `requestFullscreen` in `src/`: only the pre-existing, unrelated hit in
    `components/shared/image-preview.tsx` (a lightbox, not part of this set).
  - `lg:grid-cols-[2fr_3fr]`: no hits (old POS grid removed).
  - The IMEI input's id/`htmlFor`: no longer `intake-device-label` (renamed to
    `intake-device-imei`).
  - `formatRepairDeviceLabel`: 3 call sites (`RepairTicketDetail.tsx`, `RepairReceipt.tsx`,
    `RepairBoard.tsx`), as expected.
  - `min-w-0 flex-1`: present in both `AdminLayout.tsx` and `StaffLayout.tsx`.

## Files touched

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

Nothing under `Apps/api/`, `Apps/contract/`, `Apps/web/src/lib/print.ts`,
`Apps/web/src/index.css`, `intake-repair.schema.ts`, `PublicLayout.tsx`, or any test file was
touched, as the plan required.

---

## Manual verification checklist (owner, in a browser)

### POS layout
1. `/staff/pos` at 1366×768, then 1280×800, then a window narrowed to exactly 1024px (the `lg`
   breakpoint): **no horizontal scrollbar** at any of the three, and the cart/ticket panel is
   fully visible with its Confirm button reachable without sideways scrolling.
2. Add a product with a very long name. In **both** the search results and the ticket, the name
   is one line with an ellipsis and hovering it shows the full name. The card's height has not
   grown.
3. Hover the four-price line on a product card with all four prices: one ellipsised line, hover
   reveals the full breakdown.
4. The sidebar now starts at the left edge of the window (small gap only), not floating in a
   centred column. **Then spot-check** `/admin/inventory`, `/admin/statistics` and
   `/staff/repairs` — this change is global; confirm the wider content reads acceptably. If you
   want the old centred measure back, say so — it's a one-line revert that does not undo step 1.
5. Repeat step 1 at `/admin/pos`.

### Focus mode
6. Click **Focus mode** in the POS header: the app header and sidebar disappear, the workspace
   fills the window edge to edge, the exit button is pinned top-right.
7. Press **Esc** — focus mode exits. Re-enter it, click the pinned exit button — it exits.
8. Re-enter focus mode, **reload the page**: it comes back still in focus mode.
9. Still in focus mode, navigate to `/staff/repairs` (or any other page): the header and sidebar
   are back — focus mode applies only to the POS. Navigate back to `/staff/pos`: focus mode is
   active again.
10. In focus mode, open the quick-add client dialog and press Esc — the dialog closes, focus mode
    stays on. Open the My drafts drawer and press Esc — same.
11. In focus mode, complete a sale and press Print on the receipt. **Print to the actual thermal
    printer**: the 80mm receipt comes out exactly as it does outside focus mode.
12. Also confirm a barcode label print is unaffected: `/admin/products` → label dialog → print to
    the **actual label printer**.

### Repairs — device label
13. `/staff/repairs` → New intake. Pick brand `Samsung`: Device field reads `Samsung`. Pick model
    `S24 Ultra`: reads `Samsung S24 Ultra`.
14. Type over it (e.g. `Samsung S24 Ultra (dual SIM, blue)`). Change the model: your text is
    **not** overwritten.
15. Close and reopen the intake dialog with a fresh brand/model: the field auto-fills again (the
    edited flag resets per ticket).
16. Create a repair with no brand/model, only a free-text device (`Nokia 3310 — unlisted`). It
    saves.
17. Open each of those tickets: the board card, the detail sheet and the **printed claim slip**
    (print to the actual thermal printer) all show the label you typed.
18. Open an older repair created before this set (brand/model, no stored label): all three
    surfaces still show `brand model` as before — no regression for existing tickets.
