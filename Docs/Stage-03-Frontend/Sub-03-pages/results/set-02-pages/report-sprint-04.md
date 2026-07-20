# Sprint 4 Report — Page-local primitives, Skeletons & local fallbacks (Primitives & States)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Built 16 new dumb, props-only primitive components across all 7 pages (none call a hook — Sprint 5/6
wire real data around them), extended two shared components (`StatusBadge` gained `InvoiceStatusBadge`,
`DataTable` gained `onRowClick`), and added 8 more translation keys found while building real markup
against the DTOs. `tsc --noEmit` clean, `vitest run` 353/353 (no regressions), 0 lint errors after
`--fix` (all 28 findings were line-wrap `prettier/prettier`, no logic issues).

## Files created (16)

| Page | File | Purpose |
|---|---|---|
| PUB-04 | `pages/cart/components/CartItemRow.tsx` | Row + `CartItemRowSkeleton` |
| PUB-05 | `pages/order-confirmation/components/OrderConfirmationBody.tsx` | Success body |
| PUB-09 | `pages/my-orders/components/OrderCardSkeleton.tsx` | Shape-matched to `OrderCard` |
| PUB-09 | `pages/my-orders/components/OrderStatusFilters.tsx` | Combined filter + count chips |
| PUB-10 | `pages/my-invoices/components/InvoicesTable.tsx` | List (DataTable) |
| PUB-10 | `pages/my-invoices/components/InvoiceView.tsx` | Detail + `InvoiceViewSkeleton` + 404 |
| STF-01 | `pages/staff/dashboard/components/MySalesTodayCard.tsx` | 2 `StatCard`s |
| STF-01 | `pages/staff/dashboard/components/MyDraftsList.tsx` | Drafts list |
| STF-01 | `pages/staff/dashboard/components/PendingOrdersWidget.tsx` | Count-only (staff variant) |
| STF-03 | `pages/staff/products/components/StaffProductFilters.tsx` | Search + cascading selects |
| STF-03 | `pages/staff/products/components/StaffProductsTable.tsx` | Data-driven category columns |
| ADM-01 | `pages/admin/dashboard/components/SectionRetryChip.tsx` | Shared compact retry affordance |
| ADM-01 | `pages/admin/dashboard/components/PendingOrdersWidget.tsx` | List (admin variant, actionable) |
| ADM-01 | `pages/admin/dashboard/components/PendingRegistrationsWidget.tsx` | List, actionable |
| ADM-01 | `pages/admin/dashboard/components/RepairsByStatusWidget.tsx` | Fixed 5-row status breakdown |
| ADM-01 | `pages/admin/dashboard/components/DraftSalesByStaffWidget.tsx` | Per-staff draft counts |

## Files modified

- `components/shared/StatusBadge.tsx` — added `InvoiceStatusBadge` (`InvoiceStatus` → tone/label map),
  following the file's own established `EXTENSION POINT` pattern (`EnabledBadge`'s precedent).
- `components/shared/DataTable.tsx` — added an optional `onRowClick?: (row: TData) => void`, wired onto
  both the desktop `<TableRow>` and the mobile row wrapper. `DataTable` had **no** click-handling at all;
  PUB-10 needs "row → invoice view" and had nothing to hook into. Backward-compatible (optional prop),
  matching the established precedent for extending a shared primitive on real need (e.g. Sub-02 adding an
  `enabled` option to hooks that lacked one).
- `config/translations.json` — +8 keys: `staff.dashboard.draftsEmptyBody`, `staff.products.copyBarcode`/
  `jumpToPos` (pre-provisioned for Sprint 6's row-interaction wiring), plus the 5 `repairs.status.*`
  labels the `RepairsByStatusWidget` needs (no `repairs.*` namespace existed at all before this sprint —
  confirmed by grep).

## Design notes

- **STF-01's `LowStockList` isn't a new component — it's `LowStockAlert` reused directly.**
  `StaffDashboardDto.lowStock` and `AdminDashboardDto.lowStockProducts` are the **same**
  `DashboardLowStockItemSchema[]` type in the contract. Building a second, near-identical widget would
  duplicate Sprint 3's `LowStockAlert` (shared shape, skeleton, empty state, and all) for no reason —
  Sprint 6 wires `<LowStockAlert products={...} showRefresh={false} />` directly into `StaffDashboard.tsx`
  instead. Flagged here since the task list named a distinct `LowStockList` component that turned out not
  to be needed.
- **"Silent-hide on error" (STF-01) has no `isError` prop on any of its 3 widgets.** The requirement means
  the *page* simply doesn't render a widget on error (`{!isError && <MySalesTodayCard .../>}`, Sprint 6),
  not that the widget itself renders an invisible error state — so none of `MySalesTodayCard`/
  `MyDraftsList`/`PendingOrdersWidget` (staff) has error-branch logic. Distinct from ADM-01's 4 new
  widgets, which *do* take `isError`/`onRetry` and render `SectionRetryChip` inline (a visible failure,
  not a hidden one).
- **ADM-01's `PendingOrdersWidget`/`PendingRegistrationsWidget` don't reuse `RecentOrdersTable`/
  `RecentClientsTable`** despite sharing the exact same thin DTO shape (`DashboardOrderSummarySchema`/
  `DashboardClientSummarySchema`) — the two pairs have genuinely different interaction models (pending =
  whole-row `<Link>`, actionable; recent = read-only `DataTable`, no row action), so forcing one shared
  component to serve both would mean threading conditional click-behavior through a table built for a
  different job. Built as their own compact list components instead.
- **STF-03's "row click copies barcode / jumps to POS (when granted)" is only half-built this sprint.**
  The copy action is wired now (`CopyButton` next to the barcode cell — it needs no data hook, matching
  "primitives before wiring"). The permission-gated "jump to POS" branch needs `usePermissions()`, a real
  hook, so it stays a translation key (`staff.products.jumpToPos`, pre-provisioned) for Sprint 6 to wire
  once the row-click behavior can actually check `STAFF_POS`.
- **`CartItemRow` disables Order on out-of-stock too, not just price-hidden.** PUB-04's requirement text
  only explicitly calls out disabling Order when price resolution fails; extending the same disable to
  `!product.inStock` is a small, deliberate addition (you can't sensibly place an order for something the
  availability chip already says is unavailable) rather than scope creep — flagged here for visibility.
- **`InvoicesTable`'s status/paid/total column headers reuse `orders.paid`/`orders.orderStatus`** rather
  than new `invoices.*` duplicates, since the words are identical and Sprint 1 already established
  reuse-over-duplication for genuinely shared copy.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs, `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 353/353 passed, 44/44 files, no regressions |
| `eslint` (18 new/touched files, `--fix` applied) | ✅ 0 errors after fix; all 28 pre-fix findings were `prettier/prettier` line-wrapping, 0 logic/correctness issues |
| Inline strings | ✅ none (grep-swept all new files for un-translated JSX text) |
| Hooks in primitives | ✅ none — every new component takes data as props; only `useTranslation` is called anywhere |
| Skeleton shape fidelity | ✅ `OrderCardSkeleton` mirrors `OrderCard`'s real header/summary/actions layout; `CartItemRowSkeleton`/`InvoiceViewSkeleton` sized to their real counterparts |

## Next

Sprint 5 — Wiring: commerce cluster (PUB-04/05/09/10 onto their real hooks, replacing the Sprint 2
placeholder pages with these primitives + `useClientCart`/`usePlaceOrder`/`useMyOrders`/
`useCancelMyOrder`/`useMyInvoices`/`useMyInvoice`/`useMyInvoicePdf`).
