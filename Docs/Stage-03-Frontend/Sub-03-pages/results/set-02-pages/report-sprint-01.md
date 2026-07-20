# Sprint 1 Report — Schemas & i18n (Foundation)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Confirmed the set needs **zero new Zod schema files** (verified, not created) and added **95 translation
keys** across seven namespaces (`cart.*`, `orderConfirmation.*`, `orders.*`, `invoices.*`, `staff.nav.*`,
`staff.dashboard.*`, `staff.products.*`, `admin.dashboard.*`), reusing existing keys wherever the copy
already matched instead of duplicating. `tsc --noEmit` clean on both configs, full test suite green
(356/356, no regressions) — no `.ts`/`.tsx` file was touched this sprint, only `translations.json`.

## Files changed

**Modified**
- `src/config/translations.json` — +95 keys (see inventory below), 0 keys removed or altered.
- `Docs/Stage-03-Frontend/Sub-03-pages/results/set-02-pages/sprints.md` — Sprint 1 marked ✅ Done.

**Verified, not modified**
- `src/pages/product-detail/order.schema.ts` — confirmed still aligned to `PlaceOrderCommand` with its
  `AssertAssignable` guard; PUB-04 will import it unchanged (`orderSchema(t)`) inside `ProductOrderModal`
  — no cart-specific schema needed since PUB-04's order flow *is* PUB-03's flow, just triggered from a
  different row.
- `src/components/shared/CancelOrderDialog.tsx` — confirmed its current props (`onConfirm: () => void`,
  no `reason` field) already match the corrected PUB-09 behavior (see Deviation below) — no schema, no
  prop change needed in this sprint; Sprint 3 will only retype its `order`/order-summary prop to `OrderDto`.

## Schema & contract notes

- **No new schema files.** Three requirement lines implied schemas that turn out not to exist on wiring:
  1. PUB-04's order form *is* `order.schema.ts` (PUB-03's), reused verbatim — the plan (D8) already
     called this out; this sprint just confirms the schema itself needs no change, only the modal's
     `product` prop type (Sprint 3, D8).
  2. PUB-09's "cancel dialog, optional reason textarea" — **dropped**. Traced
     `ORDER_ROUTES.MY_CANCEL` (`orders.routes.ts`) and `orders.service.ts::cancelMyOrder(id)`: the client
     cancel endpoint takes **no request body** — only `OrderIdParamsSchema` validates it server-side. The
     contract's `reason?: string` field (`orders.command.ts`) belongs to the **admin** cancel command, a
     different route (`/admin/orders/:id/cancel`) this set doesn't touch. `CancelOrderDialog` stays the
     plain confirm it already is.
  3. PUB-09/STF-03 URL-param filters validate against the contract's own `MyOrdersQuerySchema` /
     `ProductListQuerySchema` directly (`.safeParse` on the parsed `URLSearchParams`) — no page-local
     schema file, per rules §2 ("Types come from `@app-template/contract`").
- **Net effect:** this whole 7-page set ships with the same Zod-schema footprint it started with. The
  only form-adjacent code Sprint 3 will touch is a prop-type widening (D8), not a new schema.

## i18n — key inventory (95 new keys, all `{en, fr, ar:""}`)

**Reuse-first pass (no duplicate keys) — confirmed via `grep` before adding anything:**

| Existing key | Reused for |
|---|---|
| `orders.pending/confirmed/delivery/completed/cancelled` | 5 of the 7 `OrderStatus` badge labels (only `PACKAGED`/`RETURNED` were genuinely missing) |
| `orders.cancelOrder`, `orders.cancelOrderConfirm`, `orders.orderCancelled`, `orders.cancelFailed` | Cancel-dialog copy — unchanged now that the reason field is dropped |
| `orders.allOrders`, `orders.errorLoading`, `orders.title`, `orders.subtotal`, `orders.deliveryFee`, `orders.grandTotal`, `orders.orderType`, `orders.viewDetails`, `orders.totalOrders` | Filter "All" tab, error banner title, page title, order-form/summary fields |
| `cart.empty`, `cart.outOfStock`, `cart.removeSuccess` | PUB-04 empty-state title, availability chip (unavailable), remove toast |
| `product.inStock`, `product.signInToSeePrice`, `product.wilaya`, `product.commune` | PUB-04 availability chip (available), PUB-09/PUB-04 detail-field labels |
| `product.orderNow` *(exists, unread — not reused blind)* — instead added dedicated `cart.order` | Per-row Order button (kept distinct: PUB-03's is a full CTA, PUB-04's is a compact per-row action) |
| `account.seeMyOrders` | Reused directly (not duplicated) for PUB-05's client "My Orders" link |
| `admin.dashboard.totalClients/totalProducts/ordersThisWeek/revenueThisMonth/recentOrders/recentClients/lowStockAlert/lastOrders/lastRegistered/productsRunningLow/fromLastMonth/wilaya/commune/orderCode/orderDate/orderType/status/productName/clientName/fullName/phoneNumber/currentStock/left/loading/error/welcome/overview` | The **existing** 4 stat cards + recent-orders/recent-clients/low-stock widgets — all copy already fits `AdminDashboardDto`'s shape, confirmed by content before reuse (not just key-name pattern-matching) |
| `admin.dashboard.sectionError`/`sectionErrorBody` | Confirmed **already shaped** for the D10 per-section retry chip (was dead code — zero consumers today, grep-verified) — will be wired live in Sprint 6 |
| `admin.dashboard.lowStock.allWellStocked` | STF-01's low-stock empty state (shared copy, already exists) |
| `common.actions.tryAgain` | Retry-chip button label (ADM-01), no dedicated "retry" key added |
| `admin.dashboard.brand` | STF-03's brand filter label |
| `admin.clients.table.name`, `admin.clients.clearFilters` | STF-03 product-name column header, clear-filters button |

**New keys added (95), by namespace:**

| Namespace | Count | Covers |
|---|---|---|
| `cart.*` | 9 | Page title/subtitle, empty body, error title/body, "Price on request", remove aria-label, per-row Order button |
| `orderConfirmation.*` | 6 | Title, subtitle, the exact "pending confirmation — store will call" message, reference/product labels, back-to-catalog CTA (fee/total/mode/My-Orders-link reuse `orders.*`/`account.seeMyOrders`, see above) |
| `orders.*` (extend) | 11 | `packaged`/`returned` status labels (closing the 5→7 `OrderStatus` gap), per-filter empty copy, error body, tracking number, delivery company, status timeline, invoice link, plus 3 shared with the dashboards: `pendingOrders`/`noPendingOrders`/`viewAll` |
| `invoices.*` | 31 | Entirely new domain (Tier-5 billing, first client-facing invoice UI): page chrome, table headers, `InvoiceSource`/`InvoiceStatus` labels, view/PDF actions, empty/error/404 states, and the full detail-view field set (issuedAt, dueDate, billedTo, lines, qty, unitPrice, lineTotal, previousCredit, newCredit) |
| `staff.nav.*` | 8 | All 7 `STAFF_PAGE_ORDER` entries (dashboard + the 6 `PageKey`-backed sidebar items) — 2 ship this set (dashboard, products), 5 are pre-provisioned for future sets so the sidebar config doesn't need a second i18n pass later |
| `staff.dashboard.*` | 7 | Title/subtitle, sales/revenue card labels, drafts list (title, empty, reference, age), "Finish in POS" link (client/total/lowStock reuse `admin.dashboard.clientName`/`cart.total`/`admin.dashboard.lowStockAlert`, see above) |
| `staff.products.*` | 15 | Title/subtitle, search placeholder, family/model filter labels + their "All …" options, barcode/qty/price column headers, empty + error states (brand filter and name/qty column labels reuse existing keys, see above) |
| `admin.dashboard.*` (extend) | 7 | The 4 genuinely new ADM-01 widgets: `pendingRegistrations`/`noPendingRegistrations`, `repairsByStatus`, `draftSalesByStaff` + its `staffName`/`draftCount` column headers, and `vsPreviousPeriod` (the %-change trend suffix) |

**One naming decision worth flagging:** `orders.pendingOrders` / `orders.noPendingOrders` / `orders.viewAll`
are deliberately **shared** between STF-01's pending-orders widget and ADM-01's pending-orders widget
(both literally say "Pending Orders" / "No pending orders" / "View all") rather than duplicated as
`staff.dashboard.pendingOrders` + `admin.dashboard.pendingOrders`. Keeps the two dashboards visually
consistent and halves the keys needed for that one concept.

**Simplification from the sprint task wording:** PUB-09's per-filter empty state is generic —
`orders.emptyFiltered` = "No orders match this filter" — rather than interpolating the translated status
name into the sentence (`"No {status} orders"`). Avoids passing an already-translated string back through
`t(key, vars)` as a variable, which the i18n system isn't designed for (`t(key, vars)` interpolates raw
values, not other translation lookups). Functionally equivalent from the user's perspective.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both `tsconfig.json` and `tsconfig.test.json` via `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 356/356 passed, 44/44 files, no regressions |
| `translations.json` parses as valid JSON | ✅ (`node -e "require(...)"`, 2042 total keys) |
| Inline strings | ✅ none introduced (no `.tsx` touched this sprint) |
| `useEffect` fetching | ✅ none introduced |
| Test files in `/src` | ✅ none added |
| New Zod schema files | ✅ none added (by design — see Schema notes above) |

## Next

Sprint 2 — Routing, Guards, StaffLayout, Lazy & Engine-gap prep: the two missing billing hooks
(`useMyInvoice`/`useMyInvoicePdf`), the new `StaffLayout`/`StaffSidebarNav` shell, the `/staff` +
`/staff/products` + `/cart` + `/invoices` + `/order-confirmation` routes, moving `/orders` to the
CLIENT-scoped guard, and correcting PUB-03's order-success navigation target.
