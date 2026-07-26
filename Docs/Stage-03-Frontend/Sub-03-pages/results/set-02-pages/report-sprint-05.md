# Sprint 5 Report — Wiring: commerce cluster (Assembly & Wiring)

**Set:** set-02-pages · **Status:** ✅ Done · **Branch:** `pages-set-02`

---

## Summary

Wired all four commerce-cluster pages onto their real hooks, replacing the Sprint 2 placeholder shells.
Found and fixed a real bug while wiring `Orders.tsx` (its cancel flow had a redundant, incorrect
confirmation layer). Retired the two now-fully-orphaned stub files (`orders-list-section.tsx`,
`use-orders.ts`). Added one routing decision the plan deliberately left open (`/invoices/:number` as a
route, not a dialog). `tsc --noEmit` clean, `vitest run` 353/353 (no regressions), 0 lint errors after
`--fix`.

## Files changed

**Rewritten (Sprint 2 placeholder → real page)**
- `pages/cart/Cart.tsx` — `useClientCart`/`useRemoveFromCart`/`usePlaceOrder`/`useWilayas`/
  `usePlatformDeliveryFee` + the shared `ProductOrderModal`, keyed on whichever row's Order was clicked.
- `pages/order-confirmation/OrderConfirmation.tsx` — reads `location.state.order`, redirects when absent.
- `pages/Orders.tsx` — full rewire off the Sub-01 stub onto `useMyOrders`/`useCancelMyOrder` (see bug note).
- `pages/my-invoices/MyInvoices.tsx` — `useMyInvoices({page,limit:20})` + `SimplePagination`.

**New**
- `pages/my-invoices/InvoiceDetail.tsx` — `useMyInvoice(number)` + `useMyInvoicePdf()` around `InvoiceView`.

**Modified**
- `App.tsx` — added the `/invoices/:number` route + its lazy import (see Routing decision below).

**Deleted (orphaned, grep-verified)**
- `components/sections/orders/orders-list-section.tsx`, `hooks/use-orders.ts`.

## Bug found while wiring: `Orders.tsx` almost got a duplicate confirmation layer

`OrderCard` (retyped in Sprint 3) already owns its own `isCancelDialogOpen` state and renders its own
`<CancelOrderDialog>` internally — its `onCancel` prop fires **only after** the user has already
confirmed inside that dialog, not on the initial "Cancel" button click. My first draft of `Orders.tsx`
gave the page its **own** `cancelTarget` state and would have opened `OrderCard`'s dialog, then treated
`onCancel` as "show a *second* confirmation" — a dead second dialog that would never render (nothing
in the page opens it) while genuinely losing the mutation call. Caught before running `tsc` by re-reading
`OrderCard.tsx`'s Sprint 3 body. Fixed: `Orders.tsx` now passes `onCancel={() => cancelMutation.mutate(order.id)}`
directly — the page owns only the mutation, `OrderCard` owns 100% of the confirm-then-cancel UI flow.

## Routing decision: `/invoices/:number` is a route, not a dialog

`plan.md`'s own PUB-10 UI line left this open ("Row → opens `InvoiceView` (dialog or `/invoices/:number`)"
— deliberately unresolved for this sprint to decide). Chose a route:
- `InvoiceView`'s content (header snapshot + a `lines[]` table that can run to several rows + a PDF
  button) doesn't fit a modal's height constraints as comfortably as a full page.
- Its own local-404 branch ("foreign invoice number") reads far more naturally as a page than as a modal
  that has to simultaneously show a 404 *and* stay overlaid on the list underneath it.
- A route also means the URL itself is shareable/bookmarkable for a specific invoice, consistent with
  every other detail surface in this app (`/products/:id`, `/admin/suppliers/:idSupplier`, …).

Added under the same CLIENT-only `RoleGuard` block as `/invoices`, `/cart`, `/orders`.

## Type note: `InvoiceListQuery.limit` isn't actually optional

`useMyInvoices({ page })` alone doesn't compile — `InvoiceListQuerySchema`'s `.default(20)` on `limit`
only makes the field optional on the schema's **input** side; the inferred TypeScript type (used directly
here, with no `.parse()` call to apply the default) still requires it. Fixed by passing
`{ page, limit: 20 }` explicitly, matching the schema's own default value.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs, `npm run check`) | ✅ clean |
| `vitest run` (`npm run test`) | ✅ 353/353 passed, 44/44 files, no regressions |
| `eslint` (6 touched/new page files, `--fix` applied) | ✅ 0 errors after fix; all 3 pre-fix findings were `prettier/prettier` line-wrapping |
| `useEffect` fetching | ✅ zero — grep-confirmed no `useEffect` at all in any of the 5 files (My-Orders/My-Invoices need no debounce, unlike Catalog's free-text search) |
| Inline strings | ✅ none introduced |
| Orphaned-file retirement | ✅ `orders-list-section.tsx`/`use-orders.ts` grep-verified zero remaining real consumers (two hits were comments mentioning the filename, not imports) before deletion |
| Layout preservation | ✅ every branch (loading/error/empty/success) renders inside the existing route layout; PUB-05's `<Navigate to="/">` is the one spec-required exception, not a generic content-error redirect |

## Deferred / flagged, not fixed

- `orders.service.ts`'s numeric-stub `getMyOrders`/`cancelOrder` functions are now orphaned too (their
  only caller, `use-orders.ts`, is deleted) but were **not** removed — that file also serves the
  admin-orders stub (`getAdminOrders`/`getAdminOrdersStats`/`updateAdminOrder`, out of this set's scope),
  and surgical removal of two functions from a shared file for marginal benefit wasn't worth the touch
  this sprint. Flagged for a future cleanup pass, same as Sprint 3's 4 orphaned dashboard hooks.

## Next

Sprint 6 — Wiring: staff & admin cluster (STF-01, STF-03, ADM-01), the sprint that finally gives
`AdminDashboard.tsx` its real `useAdminDashboard()` data (closing the Sprint 3 bridge note) and builds
the new `StaffDashboard`/`StaffProducts` pages around Sprint 4's widgets.
