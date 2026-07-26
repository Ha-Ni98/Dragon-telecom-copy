# Set-03 — Sprint 9 Report: Unit Tests

Status: ✅ Done

The final sprint of set-03. 8 new spec files (one per physical page component — the "13 pages"
in the sprint goal are 5 scope-driven twins + the 3 Products pages, sharing files the same way
the pages themselves do), 51 new tests, all mocking hooks directly per the project's own
test-rules (`vi.mock()` the hook module, no MSW, no network). Two genuinely important,
pre-existing bugs surfaced while writing these — this sprint's real value wasn't just coverage,
it was exercising real component behavior for the first time and catching what that revealed.

## Files

- `tests/unit/pages/staff-orders/orders.test.tsx` (7 tests)
- `tests/unit/pages/staff-sales/sales.test.tsx` (7 tests)
- `tests/unit/pages/staff-invoices/invoices.test.tsx` (7 tests)
- `tests/unit/pages/staff-repairs/repairs.test.tsx` (8 tests)
- `tests/unit/pages/staff-pos/pos.test.tsx` (9 tests)
- `tests/unit/pages/admin-products/products-list.test.tsx` (5 tests)
- `tests/unit/pages/admin-products/products-add.test.tsx` (3 tests)
- `tests/unit/pages/admin-products/product-information.test.tsx` (5 tests)

Each covers: loading skeleton, error→local fallback (retry re-fetches), empty state, success
render, at least one form/validation assertion, and — where the plan named it — twin-gating
(admin-only content present/absent by `scope`) and scope-confinement (`<Link>` asserted, never
clicked-through).

## Real bug #1: RHF `defaultValues` frozen at first render

**Found while writing the Orders confirm-dialog test.** `OrderConfirmDialog`'s `useForm` derives
`defaultValues` from its `order` prop (`unitPrice: order?.unitPrice, paidAmount: order?.totalAmount`).
The component also does `if (!order) return null`. The critical fact this obscures: **`if (!x)
return null` does not unmount the component.** React keeps the same Fiber/hooks-state alive across
renders as long as the element stays in the same tree position — the component just renders
nothing that pass. Since every one of these dialogs is mounted unconditionally in its page
(`<OrderConfirmDialog order={confirmOrder} .../>`, always present, gated only by `open`/`order`),
`useForm` captures its defaultValues **once**, on the very first render — when `order` was still
`null`. The very first real order a user ever opens gets correctly-defaulted fields; every
dialog after that (in the same page session) would show **permanently blank fields**, because
the `useForm` instance backing it never re-initializes.

This is invisible in casual manual testing (the very first click of a fresh page load looks
fine) and would only surface as "the form is blank" after using the page for more than one
action — exactly the kind of bug a scripted test catches and a demo doesn't. Confirmed by
instrumenting the component directly: `getValues()` returned real data, but the rendered
`<input>` elements had no `value` attribute at all.

**Same shape, same fix, found in 4 more places** once I knew what to look for:
`ReturnOrderDialog` (admin orders), `ReturnDialog` (sales), `SupplierPaymentDialog` (invoices),
`RepairStatusDialog` (repairs) — all derive `defaultValues` from a nullable target prop, all
mounted unconditionally by their page. Fixed identically: a `key={target?.id ?? "none"}` prop at
each of the 5 call sites (`StaffOrders.tsx` ×2, `StaffSales.tsx`, `StaffInvoices.tsx`,
`StaffRepairs.tsx`), forcing React to actually unmount+remount the dialog — and therefore its
`useForm` instance — every time the target changes to a different (or from/to no) entity.
`OrderStatusDialog`, `AdminCancelOrderDialog`, `CancelInvoiceDialog`, `IntakeDialog`, and the
parts-editor's inline form were all checked and are **not** affected — their `defaultValues` are
either static literals or (for `RecordPaymentDialog`) the parent conditionally unmounts the whole
component already, which is inherently safe against this class of bug.

## Real bug #2: `valueAsNumber` sends `NaN`, not `undefined`, for a blank optional field

**Found while writing the ADM-03 "requires unit cost" test.** `register(field, { valueAsNumber:
true })` reads the input's raw string value and coerces it — for an empty input, that's
`Number("")`-equivalent, which produces `NaN`. For `initialUnitCost`/`guestPrice`/
`defaultSalePrice`/`reorderThreshold` — all `.optional()` in `products-add.schema.ts` — the
schema's base `z.number()` check rejects `NaN` outright (it fails the number-type check, `NaN`
is not treated as "absent"), producing a generic **"Invalid input: expected number, received
NaN"** instead of the schema's own translated `initialUnitCostRequired` message. Worse: in the
live component, this ALSO appeared to suppress the sibling `familyRequired`/`brandRequired`
refine messages that a standalone `schema.safeParse()` call (with `initialUnitCost: undefined`)
correctly produced side-by-side — submitting via the real form only ever showed the one raw NaN
message. Confirmed by comparing a direct `schema.safeParse()` call (three clean, correctly
worded issues) against the actual rendered form after submit (one confusing generic one).

Fixed with a `setValueAs` helper (`(raw) => raw === "" ? undefined : Number(raw)`) replacing
`valueAsNumber: true` on all four optional numeric fields in `AdminProductsAdd.tsx`. Left
`initialQuantity` (required, always has a real default of `0`) unchanged — lower risk, not
exhibited by any test, and out of scope to touch without a concrete failure driving it.

**Not fixed, flagged as a wider gap:** this `register(..., { valueAsNumber: true })` pattern
almost certainly repeats on other optional numeric fields elsewhere in the app (any schema with
an `.optional()` number whose input has no populated default). Auditing and fixing every
occurrence across the whole codebase is a real, separate piece of work — out of scope for this
sprint, which only fixed the four fields its own test suite actually exercises.

## jsdom/RTL gotchas worth recording (not bugs — testing-environment quirks)

- **A controlled Radix `Switch`/`Checkbbox` flip remounts the underlying DOM node rather than
  updating it in place** in this component tree (confirmed via `isConnected`/reference-identity
  checks on the toggle test) — holding an element reference across a state-changing interaction
  and re-asserting on it silently reports stale (pre-click) attributes forever. Fix: re-query
  (`screen.getAllByRole(...)[0]`) after every interaction rather than caching the element.
- **A native HTML `max` attribute on a `type="number"` input blocks `user-event`'s realistic
  submit-button click before the "submit" event ever reaches React**, when the current value
  violates it (`ReturnDialog`'s per-line quantity input mirrors the same bound as its Zod
  refine via a real `max` attribute). `fireEvent.submit(form)` bypasses the native constraint-
  validation step and reliably reaches `handleSubmit`; used for the two tests that specifically
  need to observe an over-max Zod message (sales `ReturnDialog`, ADM-03's unit-cost refine —
  the latter for unrelated reasons, see bug #2 above, but the same submit mechanism applies).
- Text embedded inline with other text in one node (e.g. RepairTicketDetail's
  `"1 × 4,500 DZD · {profit label}: 1,800 DZD"`) isn't matchable via `getByText` at all — asserted
  against `document.body.textContent` instead.
- vaul's `Drawer` (`SaleDetailDrawer`) throws an unhandled `TypeError` from a stale pointer-up
  handler during/after unmount in jsdom (`style.transform` is `undefined` where a real browser
  always returns a string) — logged as an "Unhandled Error" by Vitest but does **not** fail any
  assertion; a known jsdom+vaul interaction, not something introduced this sprint. Added a
  `window.matchMedia` polyfill to the shared test setup (vaul's mount effect needs it) following
  the same precedent as the existing `hasPointerCapture`/`ResizeObserver` shims in that file; the
  pointer-up quirk itself was left as documented, harmless noise rather than patched further.

## Validation

- `tsc --noEmit` clean.
- `eslint --fix` — prettier-only wrapping fixes across the new spec files; re-linted clean.
- Full `vitest run` — **62/62 files, 451/451 tests** (400 carried over + 51 new), zero
  regressions from the 5 `key` additions or the `setValueAs` change.
- Contract and API packages untouched this sprint.

## Set-03 is now complete

All 9 sprints done: Schemas & i18n → Routes/guards/A1-A4/B1 → Shared primitives → Page-local
primitives → Products wiring → Orders/Sales/Invoices wiring → POS/Repairs wiring → Polish → Tests.
13 back-office pages (5 twins + 3 products) fully wired onto real Sub-02 hooks, tested, and
polished. Known, deliberately-deferred gaps are listed in each sprint's own report rather than
repeated here; the two bugs this sprint found and fixed were both real, both would have affected
actual users, and neither was visible without writing a script that drives the same component
more than once.
