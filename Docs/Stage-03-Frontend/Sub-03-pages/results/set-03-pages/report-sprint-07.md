# Set-03 — Sprint 7 Report: Wiring — POS & Repairs (Assembly & Wiring)

Status: ✅ Done

The two most interaction-heavy twins — POS (STF-02/ADM-05) and Repairs (STF-07/ADM-13) — are
fully wired. Both top-level pages were still Sprint-2 placeholder shells (skeleton grids only),
so this is first assembly, same as Sprint 6's clusters were.

## POS — `StaffPos.tsx` (STF-02 = ADM-05, unscoped for admin)

**Product search uses `useStaffProducts` for both scopes**, not `useAdminCatalogProducts` for
admin as the plan's shorthand parenthetical suggested. `PosProductSearch` (Sprint 4) is hard-typed
to `StaffProductDto[]`, which already carries exactly what a sales ticket needs
(`availableQuantity`, `defaultSalePrice`, `categoryPrices`); `AdminProductDto` has no equivalent
fields, and using it for admin would require a second component variant — directly contradicting
the twin pattern's "one component tree" design. Admin POS is genuinely just "staff acting
unscoped," not an admin-product-management surface, so this is a correction of the plan's
shorthand rather than a deviation from its intent.

**Ticket is client-side state** (`TicketLineState[]`) carrying enough of each selected product
(categoryPrices, defaultSalePrice, availableQuantity) to re-resolve prices locally without
re-fetching. Attaching/detaching a POS client re-resolves every **non-manually-overridden** line
to the client's category price (or `defaultSalePrice` with no client); a line the cashier has
already typed a custom price into (`manualPrice: true`) is left alone on attach/detach, matching
the spec's "per-line override edits unitPrice, resolvedPrice stays shown."

**Draft persistence (PATCH-on-change) + a flush-before-confirm.** The ticket is synced to the
backend via a debounced (600ms) `useEffect` that creates the draft on the first line and PATCHes
it thereafter — the same debounced-side-effect pattern already established in
`AdminProducts.tsx` (search→URL sync), not a fetch, so it doesn't violate the "no `useEffect` for
fetching" rule. **Confirm does not rely on that debounce having already fired** — clicking
Confirm (or hitting Enter in the paid-amount field) first fires a synchronous create/update with
the *current* in-memory ticket state, and only calls `useConfirmSale` in that mutation's
`onSuccess`. This closes a real race the plan flagged as a risk ("incremental draft PATCH races"):
without the flush, a rapid edit followed immediately by Confirm could beat the debounce and
confirm a stale server-side draft.

**Resuming a draft is a documented, deliberate approximation, not a full restore:**
- Line prices come back frozen (`manualPrice` forced `true`) with `categoryPrices: []` — a
  resumed `SaleDto` line has no product taxonomy/category-price data, only its own historic
  `resolvedPrice`/`unitPrice`, so attaching a client afterward won't re-resolve those lines
  (removing and re-adding the product from search will). `availableQuantity` floors at the
  resumed quantity so the stepper never blocks below what's already on the ticket.
- **The attached POS client is not restored at all.** `SaleDto` only carries
  `posClientId`/`posClientName` — not the full `PosClientDto` (credit, phone, category) the
  attach zone's "attached" view needs — and there is still no by-id POS-client read (confirmed
  in Sprint 6). Rather than fabricate a placeholder with a fake `credit: 0`, which could visibly
  mislead a cashier about a client's real balance, the attach zone is left in its unattached
  search state with the client's name prefilled; the cashier must re-attach for real before the
  credit preview is trustworthy again.

**Error handling found a real, pre-existing bug (see below) — fixed here and backported to
Sprint 6.** `CREDIT_REQUIRES_CLIENT` surfaces on the client attach zone; `INSUFFICIENT_STOCK`
surfaces on the payment panel (not per-line — `PosTicket` has no per-line error slot, and Sprint
1's own translation key naming, `staff.pos.payment.insufficientStock`, already settled this as a
payment-panel-level message).

**Keyboard shortcuts** use the existing `useKeyboardShortcuts` (from the Sub-01
`use-keyboard-navigation.ts` scaffolding — a generic document-level `keydown`→object-key matcher,
not the more specific `useKeyboardNavigation` used elsewhere for form fields). F2 focuses the
barcode/search input (ref-forwarded for exactly this in Sprint 4); F4 focuses the paid-amount
field by id; Enter only confirms when `document.activeElement` **is** that same field — a bare
global Enter listener would otherwise also fire while typing in the product or client search
boxes.

**Deliberately not wired:** `PosTicket`'s `onSerialNumbersChange` prop is wired through to state,
but nothing in that Sprint-4 component actually calls it (no serial-entry input exists in its
JSX, only a read-only join of whatever's already there) — a pre-existing Sprint-4 gap, left as-is
rather than expanding that component further this sprint.

## Repairs — `StaffRepairs.tsx` (STF-07 = ADM-13)

Wired `useRepairs(scope, {technicianId})` (status filtering is client-side inside `RepairBoard`,
which already groups all fetched repairs into its five lanes), `useTechnicians`, and the full
mutation set. `useCatalogBrands`/`useCatalogModels` (the same catalog taxonomy hooks ADM-03
already uses) populate `IntakeDialog`'s brand/model selects — `device.brand`/`device.model` are
plain catalog-brand/model refs, confirmed against the contract's own DTO comment ("no catalog
dependency" was about repairs *inventing* its own taxonomy, not about reusing catalog's).

**Board drag is intentionally "dumb" — it always fires the bare `{toStatus}` command and lets the
server decide,** rather than pre-routing PROCESSING/PICKED_UP/post-completion-CANCELLED drops to
a form first. Those three transitions need extra fields a drag gesture can't supply
(`technicianId`, `paidAmount`, per-part `consumedPartReturns`) — attempting them via drag will
`400`/`409` and show the `dragRejected` toast (translation key already existed for exactly this).
The other two transitions (INTAKE→CANCELLED, PROCESSING→COMPLETED/CANCELLED) need nothing extra
and succeed via drag directly. This matches the plan's own literal wording ("board drag = status
transition, snap-back + toast **on server reject**") rather than inventing a smarter client-side
router that would have to duplicate the server's own refine logic. Snap-back needs no extra code
at all: `RepairBoard` renders lanes purely from the `repairs` query result with no optimistic
local move, so a rejected mutation is a visual no-op once the toast fires. The three "form-only"
transitions remain fully reachable via the ticket detail's "Update status" button
(`RepairStatusDialog`, click-based, unaffected by any of this).

**`RepairStatusDialog`'s `technicianId` field** (present on the form but not on
`RepairStatusCommand`) fires its own `useUpdateRepair` PATCH before the status transition,
exactly as `repair-status.schema.ts`'s own header comment prescribes. `consumedPartIds` is
derived as `repair.parts.map(p => p.id)` only when the ticket's current status is `COMPLETED`
(parts are reserved at intake/processing but only *consumed* — permanently deducting stock — at
completion, per the plan's "COMPLETED consumes parts"), so the per-part restock refine only
engages for a COMPLETED→CANCELLED transition, matching `NEXT_STATUS`'s own reachability map.

**Real bug fixed: `useRepair(scope, id)` had no `enabled: !!id` gate**, unlike every sibling
by-id hook in the codebase (`useCatalogProduct`, `useSale`, `useMyInvoice`, …). Mounting
`RepairTicketDetail` before any ticket was selected would have fired a GET with an empty `id`
path segment. Added the gate directly to the hook (not as an opt-in option) since every caller
wants it.

**Two documented, deliberately-deferred gaps:**
- `IntakeDialog` has no cascading `onBrandChange` callback (unlike ADM-03's real cascading
  combobox), so the full, unfiltered model list is passed instead of one scoped to the selected
  brand — models from other brands remain selectable. A real fix needs a small prop addition to
  that Sprint-4 component, deferred rather than rushed here.
- `IntakeDialog` has no POS-client attach field at all, despite a `staff.repairs.intake.attachClient`
  translation key already anticipating one from Sprint 1 — `posClientId` is optional on
  `CreateRepairCommand`, so a repair can be created without it; the key stays unused until a
  future sprint adds the field.
- "Create & print claim slip" only creates the ticket (opens its detail sheet + a success toast).
  No `window.print()` call was added: there's no dedicated claim-slip template, and firing
  `print()` immediately after closing one dialog and opening another would print whatever
  happened to be painted at that exact moment (most likely still showing the closing intake
  dialog), which would be actively wrong rather than merely incomplete. Faking the timing with a
  `setTimeout` was considered and rejected — this project has already deliberately removed a
  fake-timing hook once (Sprint 5, `use-product-name-generation`) rather than keep something
  misleading, and the same judgment applies here.

## Real bug found and fixed — affects Sprint 6 too

**`INSUFFICIENT_STOCK`/`CREDIT_REQUIRES_CLIENT` travel as the backend error's `message`, not
`error.code`.** Checking `Apps/api/src/common/errors/index.ts`: `ConflictError`/`BadRequestError`
both take `(message, details?)` and hardcode `code` to the generic `ErrorCode.RESOURCE_CONFLICT`/
`ErrorCode.VALIDATION_ERROR` — confirmed against `inventory.service.ts`'s
`throw new ConflictError('INSUFFICIENT_STOCK', {...})` (the string is the *message* argument).
Sprint 6's order-confirm field-error check (`err.response?.data?.error?.code === "INSUFFICIENT_STOCK"`)
would therefore **never have matched** in production — the toast would still show something (the
generic mutation-cache handler falls back to the raw message anyway), but the intended inline
field error on the confirm dialog would silently never appear. Found while wiring POS's identical
`CREDIT_REQUIRES_CLIENT`/`INSUFFICIENT_STOCK` checks and cross-checking against the actual error
classes rather than assuming the translation-key names implied real `ErrorCode` enum members.
Fixed by adding `apiErrorMessage(err)` to `lib/query-client.ts` (next to the existing generic
`message()` toast helper) and updating both `StaffPos.tsx` and `StaffOrders.tsx` to compare
against it instead of the non-existent `error.code` value.

## Validation

- `tsc --noEmit` clean on the web package throughout, and again at the end.
- `eslint --fix` — a handful of prettier-only wrapping fixes plus one real
  `react-hooks/exhaustive-deps` warning (the debounced-snapshot `useMemo` deliberately excludes
  `buildDraftCommand`, a plain per-render function whose own inputs are already the listed deps)
  — resolved with a targeted, commented disable rather than papering over a real one.
- i18n audit: extracted every distinct `t()` call across the two new page files (`StaffPos.tsx`,
  `StaffRepairs.tsx`) and diffed against `translations.json` — **zero missing keys**. Grepped for
  hardcoded `placeholder="..."`/stray capitalized JSX text — none found.
- Full `vitest run` — **54/54 files, 400/400 tests**, no regressions from the `useRepair`/
  `useStaffProducts` signature changes or the `query-client.ts` addition.
- Contract and API packages untouched this sprint — no need to re-run those suites.

## Carried into later sprints

- Sprint 8 (Polish) tasks this sprint deliberately left alone per the sprint split: the
  staff-search beacon on POS/order searches, `useMemo`/`useCallback` hot-path tightening beyond
  what was already needed for correctness, and the full i18n sweep across the whole set.
- Known, documented gaps for a future sprint or explicit sign-off: `IntakeDialog`'s missing
  brand→model cascade and POS-client attach field; no real claim-slip print; POS draft-resume's
  frozen prices and client-reattach requirement; repairs board drag bouncing on three transitions
  that need extra fields.
