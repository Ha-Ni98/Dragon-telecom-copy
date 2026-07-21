# Set-03 — Sprint 6 Report: Wiring — Orders, Sales, Invoices Twins (Assembly & Wiring)

Status: ✅ Done

The three table-centric twins — Orders (STF-04/ADM-09), Sales (STF-05/ADM-10), Invoices
(STF-06/ADM-14) — are fully wired onto real Sub-02 hooks. All three top-level pages were still
Sprint-2 placeholder shells (`<TableSkeleton>`/`<StatCardSkeleton>` only, no hooks, no text) —
this sprint is the first real assembly of the full page trees, not just a hook-swap.

## Orders — `StaffOrders.tsx` (STF-04 = ADM-09 with `scope`)

Wired `useOrdersList(scope, query)`, `useOrderStats(scope)`, `useConfirmOrder`,
`useUpdateOrderStatus`, and admin-gated `useAdminCancelOrder`/`useReturnOrder`. Default tab is
PENDING (local `useState(OrderStatus.PENDING)`, not URL-backed — unlike ADM-02's products list,
nothing in this cluster's spec calls for a shareable filtered-view URL). Search is debounced;
date range (A2) is wired straight through since `OrderStatusTabs` already had the inputs.

**Real gap found and fixed: `OrdersTable` has no action column.** The only interactive affordance
on a row is `onRowClick`, which the Sprint-4 `OrderShowDialog` used purely as a read view — no
button anywhere could launch Confirm/Update-status/Cancel/Return. Added an action footer to
`OrderShowDialog` (new optional props: `onConfirm`/`onUpdateStatus`/`onCancel`/`onReturn`, each
gated by `order.status`/`scope` and rendered only when the corresponding callback is passed) —
this mirrors `SaleDetailDrawer`'s own action-footer pattern, built the same sprint by the same
component author, so the two clusters were simply inconsistent rather than genuinely different
by design. Clicking an action closes the Show dialog and opens the relevant mutation dialog for
the same order.

**Real bug found and fixed: `qk.orders.admin.list(query)` collided staff/admin caches.**
`useOrdersList(scope, query)` used a query key that always embedded the literal string `"admin"`
regardless of the `scope` argument — so a staff mount and an admin mount of the same shared tree,
with equivalent filter objects (e.g. both defaulting to `{status: 'PENDING', page:1, limit:20}`
on first load), would read and write the *same* cache entry. Fixed by adding `scope` to the key
shape (`qk.orders.list(scope, query)`, mirroring `qk.sales.list`/`qk.billing.list`'s already-
correct pattern) and updating `useOrdersDirectory.ts` to use it. Also retired the now-orphaned
`qk.orders.admin.detail` key shape (never had a consumer) and the two `qkLegacy.ordersAdmin*`
shims.

**Live availability re-check (STF-04 §UI) — admin scope only.** There is no single-product,
numeric-quantity read for staff scope (`useStaffProducts` is list-only, no by-id query); admin
scope gets it via `useAdminCatalogProduct(order.productId).quantityOnHand`. Staff sees no live
count — a genuine, documented gap (would need a new staff-facing by-id endpoint or an
`availableQuantity` field added to the public product-by-id read).

**`AdminOrders.tsx` rewired** from the full Sub-01 stub page (its own stats/table/dialog
components, `useAdminOrders`/`useAdminOrdersStats`/`useUpdateAdminOrder`, numeric
`AdminOrderWithDetails`) to a one-line `<StaffOrders scope="admin" />` wrapper, matching the
`AdminSales.tsx`/`AdminInvoices.tsx` precedent already in place from Sprint 2. Deleted (zero
remaining consumers, grep-verified): `use-admin-orders.ts`, `admin-order-actions.tsx`,
`admin-order-edit-dialog.tsx`, `admin-order-show-dialog.tsx`, `admin-orders-stats-cards.tsx`,
`admin-orders-table.tsx`, the `AdminOrderWithDetails`/`AdminOrdersStats`/
`AdminOrderShowDialogProps`/`AdminOrderEditDialogProps` interfaces from `order.types.ts`, and the
`getAdminOrders`/`getAdminOrdersStats`/`updateAdminOrder`/`AdminOrdersQuery`/`AdminOrdersPage`
Sub-01 stub functions from `orders.service.ts` (the client-facing `getMyOrders`/`cancelOrder`
stubs stay — still consumed by `OrderCard`/`CancelOrderDialog`, unrelated to this rewire).

## Sales — `StaffSales.tsx` (STF-05 = ADM-10 with `scope`)

Wired `useSales(scope, query)`, `useSale(scope, reference)` (drawer content), admin-gated
`useCreateReturn`. Row click sets a `selectedReference` and re-fetches via `useSale` rather than
reusing the list row's own data, so the drawer always shows fresh detail (matches the plan's
explicit `useSale(scope, reference)` hook mapping). `forbidden` is derived from a 403 on that
fetch (defense in depth — the staff route already self-scopes server-side, so this should not be
reachable through the UI, but the drawer honors it if it ever is).

**Seller/POS-client filters (A3) — resolved conservatively.** `SalesFilters` (Sprint 4) exposes
`sellerName`/`onSellerSearch` and `posClientName`/`onPosClientSearch` as plain free-text inputs —
no dropdown/picker was built. Since `SaleListQuery.sellerId`/`posClientId` need real uuids,
wiring resolves the debounced text against `useUsers({search})` / `usePosClientSearch({q})` and
only sets the filter id on an **exact, case-insensitive name match** — never the first/best
partial match, which could silently filter to the wrong seller with no visible warning. If no
exact match, the filter is simply not applied yet (server sees no `sellerId`/`posClientId`). A
follow-up sprint could replace the free-text inputs with a real autocomplete if this proves too
limiting in practice.

**`useUsers` gained an `enabled` option** (mirrors `useCatalogModels`'s existing
`options?: { enabled? }` precedent) so the seller-name lookup only fires for `scope="admin"` —
calling it unconditionally would have fired a background `GET /identity/users` (and a possible
403 toast) on every staff visit to their own Sales page, since staff may not hold
`identity:list-users`.

**Reprint has no receipt-fetch to wire to.** There is no `GET` endpoint that returns a stored
`ReceiptDto` — `confirmSale` is the only place one is produced, and it's a one-shot mutation
response, not a re-fetchable read. `onReprint` is wired to `window.print()` over the already-
rendered drawer content instead (same approach `InvoiceSnapshotView`'s print button uses).
`onResumeDraft` navigates to `/{scope}/pos?draftId={sale.id}` — POS itself isn't built until
Sprint 7, so today this lands on that page's Sprint-2 placeholder shell; the query param will be
picked up once Sprint 7 wires the real POS page.

**`invoiceNumber` (admin "View invoice" button) intentionally left unwired.** `SaleDto` carries no
invoice-number field, and `InvoiceListQuery` has no `sourceReference` filter to look one up by —
resolving a sale to its invoice would need a new contract filter or DTO field. Documented as a
known gap; the button simply doesn't render (its own prop is optional).

**`ReturnDialog`'s `alreadyReturnedByLine` left at its default `{}`** (no prior-returns read
exists to populate it) — the schema already treats an unknown line as unbounded, so this degrades
to "bound = full sold quantity," and the backend re-validates the real remaining-quantity bound
server-side regardless.

## Invoices — `StaffInvoices.tsx` (STF-06 = ADM-14 with `scope` + tabs)

Staff: single outgoing table via `useMyInvoices(query)`. Admin: three tabs (Outgoing/Incoming/
Payments), each genuinely lazy — `useInvoices`/`usePurchasingInvoices`/`useClientPayments`/
`usePurchasingPayments` all gained an `enabled` option (same precedent as `useUsers` above) so
Incoming/Payments don't fire until their tab is actually opened, matching the plan's "lazy per
tab" optimization note.

**Two real Sprint-4 gaps found and filled, both required by ADM-14's own acceptance criteria:**
- `InvoiceSnapshotView` had download/print buttons only — no cancel, no record-payment. Added
  `onCancel` (admin-only, hidden once `status === CANCELLED`) and `onRecordPayment` (shown
  whenever `invoice.posClientId` exists and the invoice isn't already `PAID`/`CANCELLED` —
  `CreateClientPaymentCommand` requires a `posClientId`, which an ORDER-sourced invoice tied to a
  clients-module client rather than a POS client won't have).
- `IncomingInvoicesTable` had no `onRowClick` at all, unlike every sibling table in this set
  (Orders/Sales/Outgoing-invoices all have one). Since "record supplier payment" needs a specific
  `supplierId`+`supplierInvoiceReference` and no other picker exists on this page, added an
  optional `onRowClick` (still "read-only" in the sense that matters — no edit/delete affordance
  on the invoice itself, just an entry point to record a payment against it).
- Built a new `CancelInvoiceDialog` + `cancel-invoice.schema.ts` — Sprint 4 built
  `RecordPaymentDialog`/`SupplierPaymentDialog`/`IncomingInvoicesTable`/`PaymentsLedger` for this
  cluster but missed the cancel dialog entirely, even though the translation keys
  (`admin.invoices.outgoing.cancelDialog.*`) and the `CancelInvoiceCommand` contract type already
  existed. Modeled directly on `AdminCancelOrderDialog` (same shape: reason-optional textarea).

**"Current credit" for both payment previews uses the invoice's own `newCredit` snapshot**, not a
live re-read — there is no single-entity `GET` for a POS client or a supplier (`usePosClients.ts`
has list/search/create/update only; `SupplierResponseSchema` has a `credit` field but only via the
suppliers list/detail routes, not reachable from an invoice number). If other payments or sales
have landed between this invoice's issuance and the moment the dialog opens, the preview may be
stale by that amount — the backend recomputes and is authoritative on submit regardless. Flagged
as the closest available approximation, not a silent guess.

## Validation

- `tsc --noEmit` clean on the web package after every meaningful edit, and again at the end.
- `eslint --fix` — 2 files had prettier-only formatting fixes (multi-line wrapping); re-linted
  clean, zero warnings.
- Systematic key audit: extracted all 44 distinct `t()` calls across the 8 touched/new files,
  diffed against `translations.json` — **zero missing keys** (Sprint 1 had already anticipated
  every one, including the cancel-invoice keys this sprint finally consumes). Grepped for
  hardcoded `placeholder="..."` / stray capitalized JSX text — none found.
- Full `vitest run` — **54/54 files, 400/400 tests**, no regressions from the two cache-key/hook-
  signature changes (`qk.orders.*`, the four hooks that gained `enabled` options).
- Contract and API packages untouched this sprint (A2/A3/B1 were already resolved in Sprint 2) —
  no need to re-run those suites.
- Grep-verified zero remaining references to `use-admin-orders`/`admin-order-*`/
  `AdminOrderWithDetails`/`qkLegacy.ordersAdmin*` anywhere in `src/`.

## Carried into later sprints

- Sprint 7 (POS/Repairs) will reuse the same twin pattern; POS's own route already receives the
  `?draftId=` query param this sprint's "resume in POS" button sends.
- Known, documented gaps for a future sprint or explicit sign-off: no live single-entity credit
  read for POS clients/suppliers; no sale→invoice-number lookup; no staff-facing numeric stock
  read for order live-availability; `ReturnDialog`'s already-returned-by-line bound is
  client-side-unenforced (server-side still correct); seller/POS-client filters need a real
  picker UI to be fully reliable rather than exact-name-match resolution.
