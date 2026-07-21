# Set-03 — Sprint 4 Report: Page-Local Primitives, Skeletons & Local Fallbacks

Status: ✅ Done

The largest sprint in this set — 24 new dumb, props-only components across 5 clusters, plus 2
shared label-key modules extracted mid-sprint. Every component follows the established
`InvoicesTable.tsx` (set-02 PUB-10) convention: `useTranslation` only, data/loading/error state
passed in as props, the component itself renders its own `Skeleton`/`EmptyState`/`NotFoundState`
branch. Forms own local RHF state (`useForm`/`zodResolver` against the Sprint 1 schemas) but take
`onSubmit`/`isSubmitting` as props — no mutation hooks yet (mirrors `ProductOrderModal`'s
established `onSubmit`/`isSubmitting` convention).

## POS (`pages/staff/pos/components/`) — 8 files
`PosProductSearch` (ref-forwarded for Sprint 7's F2 shortcut), `FamilyQuickPickGrid`,
`PosTicket` (a new page-local `PosTicketLine` view-model — draft lines aren't a persisted DTO
yet), `PosClientAttachZone`, `PosPaymentPanel`, `MyDraftsDrawer` (groups by staff when
`groupByStaff`, for ADM-05's unscoped mount), `PosReceiptView` (a fixed 5-row layout, not built
on `CreditMovementPreview` — the receipt shows total/paid/grandTotal too, not just prev→new
credit), `QuickAddPosClientDialog`.

## Orders (`pages/staff/orders/components/` + `pages/admin/orders/components/`) — 8 files
`OrderStatsRow`, `OrderStatusTabs`, `OrdersTable`, `OrderShowDialog`, `OrderConfirmDialog`
(properly wires the array-typed `serialNumbers` field via `Controller` + comma-split, not left
as a decorative unregistered input), `OrderStatusDialog`. Admin-only: `return-order-dialog.tsx`,
and a **new** `cancel-order-dialog.tsx`.

**Real finding:** the plan assumed ADM-09's cancel dialog could reuse the existing shared
`components/shared/CancelOrderDialog.tsx`. Reading it showed it's the **client's own**
`CLIENT_MY_CANCEL` confirm dialog — no reason field, hardcoded "pending" badge, hardcoded
destructive-button copy, built for a route that "takes no request body" (its own header
comment). ADM-09 needs a real reason field aligned to the admin-only `AdminCancelOrderCommand`.
Built a new, separate `AdminCancelOrderDialog` instead of forcing a reuse that didn't fit.

## Sales (`pages/staff/sales/components/` + `pages/admin/sales/components/`) — 4 files
`SalesFilters` (status only for staff; admin adds date range/seller/POS client via `scope`),
`SalesTable` (admin adds a seller column + a filtered-set footer total), `SaleDetailDrawer`
(admin adds cost/profit per line, credit snapshot, invoice link, Issue-return button — all gated
on `scope`). Admin-only `ReturnDialog`.

**Bug caught before it shipped:** the return dialog's per-line quantity is schema-bound to
`min(1)`. My first draft pre-populated the RHF field array with **every** sold line at
`quantity: 0` (so the user could edit whichever ones they wanted) — that would have made the
form permanently invalid, since every un-touched line fails its own `min(1)` check and blocks
submission entirely. Rewrote it as a checkbox-driven `append`/`remove` pattern — unchecked lines
never enter the validated array at all, only checked ones (default `quantity: 1`) do.

## Invoices (`pages/staff/invoices/components/` + `pages/admin/invoices/components/`) — 6 files
`InvoicesTable` (staff back-office table, reused unscoped by ADM-14's Outgoing tab — distinct
from the pre-existing client-facing `pages/my-invoices/components/InvoicesTable.tsx`, which has
no client column), `InvoiceSnapshotView`, `RecordPaymentDialog`. Admin-only:
`IncomingInvoicesTable` (read-only, computes an overdue badge from `dueDate` + unpaid balance),
`PaymentsLedger` (two `Tabs`-switched ledgers), `SupplierPaymentDialog`.

## Repairs (`pages/staff/repairs/components/`) — 5 files
`RepairBoard` — **native HTML5 drag-and-drop** (`draggable`/`onDragStart`/`onDragOver`/`onDrop`),
not a DnD library: none is on the approved-libraries list (`front-end-rules.md` §6A: "Do not
install new libraries — ASK"), and native events cover the "drag between columns = status
transition" requirement without a new dependency. `IntakeDialog` (checkbox multi-select +
conditional "other" free-text, gated on `watch("reportedIssues")`). `RepairTicketDetail` (device/
customer block, diagnosis textarea gated on `isDiagnosisEditable`, an inline add-part mini-form,
labour price, totals, timeline). Added a **new** `RepairStatusDialog` (not explicitly named in
the sprint task list, but the natural home for Sprint 1's `repair-status.schema.ts` — the
PROCESSING/PICKED_UP/CANCELLED conditional fields it validates need a UI somewhere).

## Products — audit only, no new files
Checked `admin-products-table.tsx`, `admin-products-stats-cards.tsx`, and
`AdminProductInformation.tsx` against the Sprint 4 requirement ("ensure each card/tab has a
Skeleton + NotFoundState/EmptyState"). All three **already** have it — `TableSkeleton`/
`StatCardSkeleton`/`EmptyState` gated on a `loading` prop, plus an inline not-found block in the
product-info page. `AdminProductsAdd.tsx` has no hook-driven loading state at all, but that's
because it has **zero** data-fetching hooks wired yet (confirmed: no hook imports) — a taxonomy-
dropdown loading skeleton can't be added ahead of the hooks Sprint 5 wires in. Deliberately did
**not** touch these Sub-01-stub-wired files now — Sprint 5 rewires their hooks *and* necessarily
touches this same rendering logic together (DTO shape changes from numeric id to uuid); patching
it twice would be wasted work.

## Cleanup: consolidated 5 duplicated status-label maps
While building the Orders and Repairs dialogs, found `Record<OrderStatus, string>` duplicated
verbatim (with one accidental variant) across `OrderStatusTabs`, `OrdersTable`, and
`OrderStatusDialog`, and `Record<RepairStatus, string>` duplicated across `RepairBoard` and
`RepairStatusDialog`. Extracted both into single-source-of-truth modules —
`pages/staff/orders/order-status-labels.ts` (`ORDER_STATUS_LABEL_KEY`) and
`pages/staff/repairs/repair-status-labels.ts` (`REPAIR_STATUS_LABEL_KEY`) — and repointed all 5
call sites. This also fixed a second, real bug found in the process:
`RepairTicketDetail`'s status-history timeline was rendering **raw enum values**
(`{entry.fromStatus} → {entry.toStatus}`, e.g. literally "INTAKE → PROCESSING") instead of
translated labels — an inline-string violation caught by re-auditing after the extraction, not
by the original write.

## Validation
- `tsc --noEmit` clean (checked after each cluster, not just once at the end).
- Systematic key audit: extracted every `t("...")` call across all 30 new/touched files via
  `grep`, diffed against `translations.json` — found exactly 3 real gaps
  (`common.actions.decrease/increase`, `common.units.inStock`), added them; everything else
  already existed. Also caught one genuine inline string (a hardcoded `"SN-001, SN-002"`
  placeholder) this way and fixed it with a new `common.placeholders.serialNumbers` key.
- `eslint --fix` — 25 files had prettier-only formatting fixes; re-linted clean after.
- `vitest run` — **54/54 files, 400/400 tests**, no regressions (Sprint 4 adds no new tests
  itself — these are unwired dumb components; Sprint 9 is where they get DOM-tested against
  mocked hooks once Sprints 5–7 wire them).
- Grep-verified zero `useQuery`/`useMutation`/`@tanstack/react-query` imports across every new
  file — confirms the "no hooks yet" Sprint 4 constraint held.

## Carried into later sprints
- Sprint 5 rewires the Products trio's hooks (and, per the audit above, will touch the same
  loading/skeleton logic that already exists there).
- Sprint 6 wires Orders/Sales/Invoices; Sprint 7 wires POS/Repairs. Both sprints consume the
  `onSubmit`/`isSubmitting` props these dialogs already expose.
- `AdminCancelOrderDialog` and `RepairStatusDialog` are new components not literally named in the
  original sprint task list — flagged here so later sprints' wiring work doesn't overlook them.
