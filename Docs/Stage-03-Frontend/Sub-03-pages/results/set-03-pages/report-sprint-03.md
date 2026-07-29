# Set-03 — Sprint 3 Report: Shared / DTO-Typed Primitives (Primitives & States)

Status: ✅ Done

## Reuse-first audit

Confirmed all 14 listed shared components already exist in `components/shared/` with the
expected shape (`DataTable`, `PageHeader`, `StatCard`, `StatCardSkeleton`, `TableSkeleton`,
`StatusBadge`'s `StatusPill`/`EnabledBadge`/`InvoiceStatusBadge`, `MoneyStatusCard`,
`SimplePagination`, `EmptyState`, `NotFoundState`, `CancelOrderDialog`, `autocomplete-input`,
`image-management`, `drag-drop-area`) — no rebuilding needed; later sprints import these directly.

## New shared primitives (3)

### `CreditMovementPreview` (`components/shared/CreditMovementPreview.tsx`)
Props: `{ previousCredit: number; newCredit: number }`. Renders the prev→new pair with an
arrow, tinting the new amount red (increase — worse for the payer) or green (decrease). Used by:
POS payment panel + receipt (STF-02), `RecordPaymentDialog` (STF-06/ADM-14), the supplier payment
dialog (ADM-14), and the admin sale-detail credit snapshot (ADM-10) — the one component the spec
describes as "previews... before submit and echoes... after" in four different places. Reuses the
existing `invoices.detail.previousCredit`/`newCredit` translation keys rather than inventing a new
namespace (same meaning, no new copy needed).

### `ResolvedVsChargedPrice` (`components/shared/ResolvedVsChargedPrice.tsx`)
Props: `{ resolvedPrice: number; unitPrice: number }`. Shows the charged price plain when it
matches the system-resolved price; shows it amber + a struck-through resolved-price line when
overridden.

**Correction from plan.md:** the plan named this component's third caller as "invoice snapshot,"
but `InvoiceResponseSchema`'s `lines` (billing.dtos.ts) carry **no `resolvedPrice` field** — only
`unitPrice`, `costSnapshot`, `profit`, `currentAverageCost`. Invoices are frozen at the charged
price only; there's no "resolved vs charged" concept once a document is invoiced. Checked where
the pair actually exists in the contract: `SaleDto.lines[]` (sales.dtos.ts) and `OrderDto`
(orders.dtos.ts, single-line) both carry it. The real third caller is the **order show/confirm
dialogs** (STF-04/ADM-09), not invoices — `plan.md`'s "cluster 4" wiring note should read this
component out of the Invoices cluster and the ADM-14 "current avg cost joined beside each product
row" column stays a separate, unrelated field (`currentAverageCost`), not this component.

### `AgeFlag` (`components/shared/AgeFlag.tsx`)
Props: `{ since: string; thresholdHours?: number }`. Two distinct behaviors picked up by whether
a threshold is passed: with `thresholdHours` (orders, `placedAt`), renders **nothing** until
elapsed time exceeds it, then a warning-toned badge — the ">24h" flag. Without a threshold
(repairs, `intakeAt`), always renders a neutral elapsed-time badge — the plain "age" column on
repair cards, no warning implied. One component instead of two, since both are fundamentally
"elapsed time since X" with an optional gate.

## New translation keys (3)
`common.pricing.resolvedPrice`, `common.age.hours` (`{count}h ago`), `common.age.days`
(`{count}d ago`) — all with real `en`/`fr`, `ar: ""`. Noted, not fixed: `staff.pos.ticket.
resolvedPrice` and `staff.sales.detail.resolvedPrice` (added in Sprint 1) carry identical English/
French copy to the new `common.pricing.resolvedPrice` — near-duplicates left in place since
Sprint 1's page-local keys may still back different UI (e.g. a table column header) than this
component's inline label; worth a dedupe pass once Sprint 6/7 wire the real pages and it's clear
whether the page-local keys are still load-bearing.

## Tests
`tests/unit/components/shared/{CreditMovementPreview,ResolvedVsChargedPrice,AgeFlag}.test.tsx` —
7 tests total, mocking `useTranslation`/`useLanguage` via the existing `fixtures/wrappers/
mockTranslation` module (no new test infra needed). Assert the actual branching logic: credit
increase vs decrease tinting, resolved-price line shown only when overridden, age badge suppressed
under threshold / shown over it / always shown with no threshold.

## Validation
- `tsc --noEmit` clean.
- `eslint` clean (one prettier auto-fix on a test file's line-wrap).
- `vitest run` — **54/54 files, 400/400 tests** (393 baseline + 7 new), no regressions.
- All three primitives take flat, DTO-field-named props (not local view-models); zero hooks
  beyond `useTranslation`; zero data fetching.

## Carried into later sprints
- Sprint 4+ import all three directly; `ResolvedVsChargedPrice` is used by POS ticket lines, sale
  detail rows, and order dialogs — **not** invoice snapshot rows (see correction above).
- Flagged: `staff.pos.ticket.resolvedPrice`/`staff.sales.detail.resolvedPrice` vs `common.pricing.
  resolvedPrice` duplication, revisit once real pages are wired.
