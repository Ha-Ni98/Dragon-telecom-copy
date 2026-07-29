# Report — Set 11 (Orders: admin UI)

Executed against `Docs/Stage-04-Fixes/plans/plan-S11-orders-admin-ui.md`, all 11 actions,
2026-07-27. All three validation gates green (tsc + lint, contract/api/web). No test file was
edited or read. No test suite was run. Pure admin-frontend set with one small contract/backend
ripple (`OrderDto.clientUsername`/`clientCategoryName`); no money or stock code was touched.

---

## Owner decisions this session (recap)

| # | Question | Answer |
|---|---|---|
| R1 | What is "a badge on each stat card"? | **Status-colored pill** — a new `OrderStatusBadge` at `StatusBadge.tsx`'s EXTENSION POINT, rendered in each card's `trend` slot. Not a percentage. |
| R2 | What does clicking an action-column entry do? | **Always opens the matching dialog** with the target pre-selected and the status select locked. No transition applies straight from the menu. |

---

## What changed

### Contract (Action 1)

- `Apps/contract/src/modules/orders/orders.dtos.ts`: `OrderResponseSchema` gains two optional
  fields, `clientUsername` and `clientCategoryName`, placed after `trackingNumber` and before
  `lines`.

### Backend — orders module (Actions 2–3)

- `orders.service.ts`: `ORDER_INCLUDE` gains a `client` join (`user.username`,
  `posClient.category.name`), shared by every order read (backoffice list, `listMyOrders`,
  `getOrderDto`) — a client only ever sees their own username/category through it.
- `orders.mapper.ts`: `OrderRow.client` widened to match; `toOrderDto` emits both new fields via
  the same conditional-spread convention every optional field in the mapper already uses.

### Frontend — shared primitives (Actions 4–5)

- Moved `ORDER_STATUS_LABEL_KEY` from `pages/staff/orders/order-status-labels.ts` to
  `lib/order-status-labels.ts` (deleting the old file) — a component under `components/shared/`
  must not import from a page folder, and the new `OrderStatusBadge` needed exactly that map.
  Updated the three existing importers (`OrderStatusDialog.tsx`, `OrderStatusTabs.tsx`,
  `OrdersTable.tsx`).
- `components/shared/StatusBadge.tsx`: added `OrderStatusBadge` at the file's documented EXTENSION
  POINT, with a `ORDER_STATUS_TONE` map. `CONFIRMED`/`PACKAGED` both render `neutral` (S2 owns the
  four-tone palette; these two are "in progress" states the table's own status text already
  distinguishes) — `BadgeTone` itself was not widened.

### Frontend — stat cards (Actions 6–7)

- `OrderStatsRow.tsx`: rewritten around a `CARDS` array (`.map()`, not five copy-pasted blocks) —
  five cards now: Pending, Confirmed, In delivery, Completed, Cancelled by client, each with an
  `OrderStatusBadge` in its `trend` slot. Grid widened to `lg:grid-cols-5`; loading skeleton count
  raised from 3 to 5.
- `OrderStatusTabs.tsx`: `TAB_STATUSES` extended with `CANCELLED`, `CANCELLED_BY_CLIENT`,
  `RETURNED` — **beyond the literal text of §S11**, which named only the stat card. Without this,
  the new "cancelled by client" stat card had no drill-down: the tab bar stopped at `COMPLETED`
  while `BackofficeOrdersQuerySchema.status` already accepted all eight values. Flagged as a
  finding in the plan itself (§4, Action 7) rather than discovered mid-execution.

### Frontend — the orders table (Actions 8–10)

- New `OrderActionsMenu.tsx`: computes the legal-action list from
  `orderTransitionsFrom(order.orderType, order.status)` (S10's contract constants — never a
  hand-written list), unioned with `CANCELLED` whenever `order.canBeCancelled` (the machine omits
  `CANCELLED` as a target of `IN_DELIVERY`, but `cancelOrder` accepts it there and
  `OrderShowDialog`'s Cancel button already offers it — F3) and with `RETURNED` on a `COMPLETED`
  order (the admin return *document* action, S10/R1 — `orderTransitionsFrom` returns `[]` for a
  terminal status, F4). Renders `null` when the list is empty. The trigger's wrapper `div` stops
  click propagation so opening the menu never triggers the row click.
- `OrdersTable.tsx`: added `scope`/`onAction` props (admin-only gate, mirroring `SalesTable`'s
  shape); admin-only `user`/`clientCategory` columns (`-` for absence, matching the issue text's
  exact character — the rest of the table uses `—`); the status cell now renders
  `OrderStatusBadge`; an admin-only `actions` column rendering `OrderActionsMenu`. Skeleton column
  count: 12 for admin, 9 for staff.
- `OrderStatusDialog.tsx`: new optional `presetStatus` prop — when set, the status `Select` is
  disabled and shows only that one option; `defaultValues.status` becomes
  `presetStatus ?? targets[0]`.

### Frontend — wiring (Action 11)

- `StaffOrders.tsx`: new `presetStatus` state and `handleRowAction` — the single router for every
  action-column click (R2). `CANCELLED` → `AdminCancelOrderDialog`; `RETURNED` on a `COMPLETED`
  order → `ReturnOrderDialog`; every other target → `OrderStatusDialog` with `presetStatus` set.
  `OrdersTable` receives `scope`/`onAction` (admin only); `OrderStatusDialog`'s remount `key` now
  folds in `presetStatus` so a second action on the same order recomputes `defaultValues`; the
  preset clears on dialog close, on submit success, and when the generic "Update status" button in
  `OrderShowDialog` opens the dialog instead.

### Translations

Five new keys added to `Apps/web/src/config/translations.json` (en/fr; `ar` left `""` per the
file's existing convention for every key): `staff.orders.stats.completed`,
`staff.orders.stats.cancelledByClient`, `staff.orders.table.user`, `staff.orders.table.category`,
`admin.orders.table.actionsAria`. Every other key the plan called "reused" (`admin.orders.table.actions`,
`admin.orders.returnDialog.title`, `admin.orders.cancelDialog.title`, the `orders.*` status labels,
etc.) already existed and was not re-added.

---

## Findings recorded during execution

No new findings beyond what the plan already called out (F1–F6) — the plan's own reading of the
code held up exactly as written:

- F1 (price/payment prompts already correct via `orderTransitionAllowsPriceEdit`/
  `orderTransitionRequiresPayment`) required no code change, confirmed — Action 9's "products per
  line" bullet also needed no change (S9 already made it per-line).
- F3/F4 (the `CANCELLED`/`RETURNED` union logic in `OrderActionsMenu`) implemented exactly as
  specified; verified by re-reading `orders.constants.ts` and `orders.mapper.ts`'s
  `canBeCancelled` before writing the component.
- F6 (`ORDER_INCLUDE` is shared by `listMyOrders` too) — confirmed intentional: a client's own
  `/orders` page now technically receives their own username/category in the payload, unused by
  any storefront component, which is their own data and not a leak.

---

## Validation gate

```
=== CONTRACT ===
npx tsc --noEmit   → clean
npm run lint       → clean

=== API (src only) ===
npx tsc --noEmit 2>&1 | grep -E "^src/"   → no output (clean)
npm run lint                              → 6 pre-existing errors (prisma/seed.ts ×3,
                                             validate-request.middleware.ts ×3) — unchanged baseline

=== WEB ===
npx tsc --noEmit                                    → clean
npx eslint --fix <files this set touched>           → 2 files reformatted (prettier-only:
                                                        multi-line object literals in
                                                        StatusBadge.tsx and OrderStatsRow.tsx)
npx eslint <same files> (re-run, no --fix)           → clean
npx tsc --noEmit (re-run after --fix)               → clean
```

No repo-wide `npm run lint` was run in `Apps/web` (the ~10.2k pre-existing prettier baseline
documented in the set-04 plan is untouched).

Sweeps:

```
grep -rn "PENDING.*CONFIRMED.*PACKAGED" Apps/web/src --include=*.tsx --include=*.ts   → no hits
grep -rn "pages/staff/orders/order-status-labels" Apps/web/src                        → no hits
```

---

## Manual verification checklist

The owner runs these in the browser. Sign in as **admin** unless stated.

**Stat cards (R1)**
1. `/admin/orders` — five cards: Pending, Confirmed, In delivery, Completed, Cancelled by client.
   Each carries a colored pill under its number; Completed's is green, Cancelled by client's is
   red, Pending's is amber.
2. Switch the app to light mode. Every pill's text is legible against its fill (RC-3 — no white on
   pale).
3. Place an order — Pending rises by one on reload.

**Tabs**
4. The tab bar now ends with **Cancelled**, **Cancelled by client** and **Returned**. Click
   "Cancelled by client" — the table lists exactly the orders a client cancelled from `/orders`,
   and the count matches the card.

**Table columns**
5. Place an order as a **registered, approved** client. The row shows their **username** and their
   **category** name.
6. Place an order as a **guest** (signed out). That row shows `-` in both columns.
7. Register a client, do **not** approve them, and place an order. Username shows; category shows
   `-`.
8. A multi-line order (order two different products from the cart) shows both product names in
   the Product cell and their **summed** quantity.
9. The Status cell renders the same colored pill as the stat cards.

**Action column (R2)**
10. A **PENDING pickup** order's action menu offers exactly *Confirmed* and *Cancelled* — nothing
    else. A **PENDING delivery** order offers the same two.
11. A **PACKAGED pickup** order offers *Completed* and *Cancelled*; a **PACKAGED delivery** order
    offers *In delivery* and *Cancelled*.
12. An **IN_DELIVERY** order offers *Completed*, *Returned* **and** *Cancelled*.
13. A **COMPLETED** order offers only *Issue return*. A **CANCELLED** or **RETURNED** order shows
    **no menu trigger at all**.
14. Click any action → the matching dialog opens with that target already selected and the status
    select **greyed out / not changeable**. Close it and pick a different action on the same row →
    the new target is selected (not the previous one).
15. Clicking the menu trigger does **not** open the order detail dialog. Clicking anywhere else on
    the row **does**.
16. *Cancelled* opens the cancel dialog (with its reason field), not the status dialog.
17. On a **COMPLETED** order, *Issue return* opens the **return** dialog (per-line quantities), not
    the status dialog.
18. On an **IN_DELIVERY** order, *Returned* opens the **status** dialog and, on submit, releases
    the reservation with **no refund and no credit movement** (S10 behavior, unchanged here).

**Price and payment prompts (unchanged, verification only)**
19. **Pickup → Completed**: the dialog shows the per-line **price** inputs *and* the **amount
    paid** input.
20. **Delivery → Packaged**: price inputs, **no** payment input.
21. **Delivery → In delivery**: delivery company + tracking number, no price, no payment.
22. **Delivery → Completed**: **amount paid** only — no price inputs.
23. Completing an order with a partial payment on a **guest** order still refuses with
    *"credit requires client"* (S10/R2, unchanged).

**Nothing else moved**
24. `/staff/orders` (as a staff user holding the orders page) shows **no** user column, **no**
    category column and **no** action column — staff parity is S18's set. Row click, tabs, search,
    date range and the status dialog all still work there.
25. The storefront `/orders` page (as a client) is unchanged: order cards, statuses and the cancel
    button all behave as they did after S10.

---

The owner reviews and approves before S12 begins.
