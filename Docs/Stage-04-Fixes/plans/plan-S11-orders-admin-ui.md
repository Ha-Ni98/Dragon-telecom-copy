# Plan S11 — Orders: admin UI

*Pure frontend set with one small contract/backend ripple: the orders table needs two fields the
`OrderDto` does not carry yet (the account behind the order and that client's POS category).
Everything else consumes S10's contract constants — no new business rule is invented here.*

Covers `app-issues-01.md` §S11 in full:

- table: **user** + **client's category** (`-` when unregistered), products **per line**;
- stat cards: a **badge on each**, plus **completed** and **cancelled by client**;
- an **action column** offering only the legal transitions for that order's type and state;
- the price/payment prompts wired to the states that require them.

---

## 0. Before you start

### 0.1 Sets that must land first

- **S9** — `OrderLine`, `OrderDto.lines[]`, `CANCELLED_BY_CLIENT`. Executed (`results/report-S09.md`).
- **S10** — the per-type machine (`Apps/contract/src/modules/orders/orders.constants.ts`), the
  folded status endpoint, the money-at-`COMPLETED` semantics. Executed (`results/report-S10.md`).
  **S11 adds no backend behavior on top of it.**
- **S2** — the shared badge palette (`components/shared/StatusBadge.tsx`, RC-3 light-mode contrast).
  This set adds one more badge at its documented EXTENSION POINT; it must not touch `BadgeTone`.

### 0.2 Owner decisions taken this session — settled, do not re-open

| # | Question | Owner's answer |
|---|---|---|
| **R1** | What is "a badge on each stat card"? | A **status-colored pill**: a new `OrderStatusBadge` added at `StatusBadge.tsx`'s EXTENSION POINT, rendered in each card's `trend` slot. Not a percentage. |
| **R2** | What does clicking an action-column entry do? | **Always opens the matching dialog** with the target pre-selected and the status select locked. No transition is ever applied straight from the menu. |

### 0.3 Findings from reading the code — read before acting

**F1 — the price/payment prompts are already correct.** S10's `OrderStatusDialog.tsx` derives its
sections from the contract helpers (`orderTransitionAllowsPriceEdit(order.orderType, watchedStatus)`
→ price inputs; `orderTransitionRequiresPayment(watchedStatus)` → paid-amount input), and
`ORDER_PRICE_EDIT_STATUS` already reads `PICKUP → COMPLETED`, `DELIVERY_* → PACKAGED`. The last
bullet of §S11 ("wire the price and payment prompts to the states that require them") therefore
needs **no code change** — only the verification steps in §7. Do not rebuild it.

**F2 — `OrdersTable` is the shared staff/admin twin.** `AdminOrders.tsx` is a one-line wrapper
around `StaffOrders.tsx` with `scope="admin"`. `OrdersTable` currently takes **no `scope` prop**.
S11 is an *admin* set and S18 owns staff parity, so every new admin-only affordance must be gated
behind a new `scope` prop, exactly the way `SalesTable` gates its seller column and footer total.

**F3 — the action menu and the show-dialog Cancel button disagree unless you union them.**
`ORDER_STATUS_TRANSITIONS` does **not** list `CANCELLED` as a target of `IN_DELIVERY` (S10's
machine), but `OrdersMapper.canBeCancelled` is `!isOrderStatusTerminal(status)` — true at
`IN_DELIVERY` — and the backend's `cancelOrder` accepts it. `OrderShowDialog` already shows a Cancel
button there. The action menu must therefore offer `CANCELLED` on the **union** of "the machine
lists it" and "`order.canBeCancelled`", or the two surfaces will contradict each other on exactly
one status. See Action 8.

**F4 — `COMPLETED` has no machine transitions, but it does have the return action.**
`orderTransitionsFrom(type, COMPLETED)` returns `[]` (terminal). The admin `COMPLETED → RETURNED`
document action (S10/R1) is *not* a machine transition and must be added to the menu explicitly,
routed to `ReturnOrderDialog` — not to the status dialog. `IN_DELIVERY → RETURNED` **is** a machine
transition (a pure release, no refund) and routes to the status dialog. Same word, two different
dialogs; getting this backwards would refund money for goods that were never invoiced.

**F5 — `ORDER_INCLUDE` is shared by every order read.** `orders.service.ts:39` feeds `listMyOrders`
(the storefront) as well as the backoffice list. Adding the client join there widens the storefront
payload too — with the client's *own* username and category, which is their own data and which no
storefront component renders. That is acceptable; do not build a second include just for admin.

**F6 — `order-status-labels.ts` lives under `pages/staff/orders/`.** `StatusBadge.tsx` lives under
`components/shared/`. A shared component importing from a page folder inverts the layering, so
Action 3 moves the label map to `@/lib/` first. There are exactly **three** importers today
(`OrderStatusDialog.tsx`, `OrderStatusTabs.tsx`, `OrdersTable.tsx`).

---

## 1. Contract — two new `OrderDto` fields

### Action 1 — `Apps/contract/src/modules/orders/orders.dtos.ts`

Add two optional fields to `OrderResponseSchema`, immediately after `trackingNumber` and before
`lines`:

```ts
  // S11 — the registered account behind the order and that client's POS category. Both absent for
  // a guest placement (Order.clientId is null) and `clientCategoryName` is additionally absent for
  // a registered-but-never-approved client (no PosClient row yet, so no category). The admin table
  // renders "-" for either absence.
  clientUsername: z.string().optional(),
  clientCategoryName: z.string().optional(),
```

Nothing else in this file changes. `OrderStatsResponseSchema` already carries `completed` and
`cancelledByClient` (added in S9) — **do not touch it**.

---

## 2. Backend — resolve the two fields

### Action 2 — `Apps/api/src/modules/orders/orders.service.ts`

Extend `ORDER_INCLUDE` (line 39) with the client join:

```ts
const ORDER_INCLUDE = {
  wilaya: { select: { id: true, frName: true, arName: true } },
  commune: { select: { id: true, frName: true, arName: true } },
  // D1 (S9) — stable order so the DTO's lines never reshuffle between reads.
  lines: { orderBy: { id: 'asc' } },
  // S11 — the admin orders table shows the account behind the order and that client's POS
  // category. Null for a guest (clientId is null); category null until the client is approved
  // (Client.posClientId is set at approval). Shared by every order read including listMyOrders,
  // where it only ever exposes the caller's own username/category.
  client: {
    select: {
      user: { select: { username: true } },
      posClient: { select: { category: { select: { name: true } } } },
    },
  },
} satisfies Prisma.OrderInclude;
```

No other change in this file.

### Action 3 — `Apps/api/src/modules/orders/orders.mapper.ts`

1. Widen `OrderRow` (line 19) to carry the join:

```ts
export type OrderRow = Order & {
  wilaya: Pick<Wilaya, 'id' | 'frName' | 'arName'> | null;
  commune: Pick<Commune, 'id' | 'frName' | 'arName'> | null;
  lines: OrderLine[];
  // S11 — see orders.service.ts's ORDER_INCLUDE. Every level is nullable: guest order (client),
  // never-approved client (posClient), uncategorised POS client (category).
  client?: {
    user: { username: string } | null;
    posClient: { category: { name: string } | null } | null;
  } | null;
};
```

2. In `toOrderDto`, add both fields directly after the `trackingNumber` spread (line 58), using the
   same conditional-spread convention every optional field in this mapper uses:

```ts
      ...(order.client?.user?.username != null ? { clientUsername: order.client.user.username } : {}),
      ...(order.client?.posClient?.category?.name != null
        ? { clientCategoryName: order.client.posClient.category.name }
        : {}),
```

`client` is declared optional on `OrderRow` so any future read that omits the join still compiles.

---

## 3. Frontend — shared label map + the order status badge

### Action 4 — move `ORDER_STATUS_LABEL_KEY` out of the page folder

1. **Create** `Apps/web/src/lib/order-status-labels.ts` with the exact current contents of
   `Apps/web/src/pages/staff/orders/order-status-labels.ts`, updating the header comment's importer
   list to mention `StatusBadge.tsx`:

```ts
import { OrderStatus } from "@dragon-telecom/contract";

// Single source of truth for OrderStatus -> translation key, shared by every component that
// renders a status label (OrderStatusTabs, OrdersTable, OrderStatusDialog, OrderActionsMenu) and
// by the shared OrderStatusBadge. Moved here from pages/staff/orders/ in S11: a component under
// components/shared/ must not import from a page folder.
export const ORDER_STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "orders.pending",
  [OrderStatus.CONFIRMED]: "orders.confirmed",
  [OrderStatus.PACKAGED]: "orders.packaged",
  [OrderStatus.IN_DELIVERY]: "staff.orders.stats.inDelivery",
  [OrderStatus.COMPLETED]: "orders.completed",
  [OrderStatus.CANCELLED]: "orders.cancelled",
  [OrderStatus.CANCELLED_BY_CLIENT]: "orders.cancelledByClient",
  [OrderStatus.RETURNED]: "orders.returned",
};
```

2. **Delete** `Apps/web/src/pages/staff/orders/order-status-labels.ts`.
3. Update the import in all three consumers from
   `"@/pages/staff/orders/order-status-labels"` → `"@/lib/order-status-labels"`:
   `pages/staff/orders/components/OrderStatusDialog.tsx:33`,
   `pages/staff/orders/components/OrderStatusTabs.tsx:6`,
   `pages/staff/orders/components/OrdersTable.tsx:13`.

### Action 5 — `Apps/web/src/components/shared/StatusBadge.tsx`

Append a fourth enum-backed badge at the file's EXTENSION POINT, after `ClientStatusBadge`:

```ts
// S11 — orders (admin stat cards + the orders table's status column), same EXTENSION POINT
// pattern. BadgeTone has four tones and S2 owns that palette (RC-3), so CONFIRMED and PACKAGED
// both map to `neutral`: they are "in progress, nothing has moved yet" states and the table's own
// status text already distinguishes them. Do not widen BadgeTone here.
const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  [OrderStatus.PENDING]: "warning",
  [OrderStatus.CONFIRMED]: "neutral",
  [OrderStatus.PACKAGED]: "neutral",
  [OrderStatus.IN_DELIVERY]: "warning",
  [OrderStatus.COMPLETED]: "success",
  [OrderStatus.CANCELLED]: "destructive",
  [OrderStatus.CANCELLED_BY_CLIENT]: "destructive",
  [OrderStatus.RETURNED]: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ORDER_STATUS_TONE[status]} label={t(ORDER_STATUS_LABEL_KEY[status])} />;
}
```

Add `OrderStatus` to the existing `@dragon-telecom/contract` import and a new
`import { ORDER_STATUS_LABEL_KEY } from "@/lib/order-status-labels";`.

Unlike the other badges in this file, this one takes its labels from the shared map rather than
declaring its own — the map already exists and four other components read it.

---

## 4. Frontend — stat cards

### Action 6 — `Apps/web/src/pages/staff/orders/components/OrderStatsRow.tsx`

Rewrite the card list. Five cards, each with an `OrderStatusBadge` in the `trend` slot (R1):

| Card | `OrderStatsDto` field | Icon (`lucide-react`) | Badge status | Label key |
|---|---|---|---|---|
| Pending | `pending` | `Clock` | `PENDING` | `staff.orders.stats.pending` *(exists)* |
| Confirmed | `confirmed` | `CheckCircle` | `CONFIRMED` | `staff.orders.stats.confirmed` *(exists)* |
| In delivery | `inDelivery` | `Truck` | `IN_DELIVERY` | `staff.orders.stats.inDelivery` *(exists)* |
| Completed | `completed` | `BadgeCheck` | `COMPLETED` | `staff.orders.stats.completed` **(new)** |
| Cancelled by client | `cancelledByClient` | `XCircle` | `CANCELLED_BY_CLIENT` | `staff.orders.stats.cancelledByClient` **(new)** |

- Grid: `grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5`.
- The loading branch renders **five** `StatCardSkeleton`s (`Array.from({ length: 5 })`), not three.
- Drive the five cards from a module-level `const CARDS = [...]` array of
  `{ key, icon, labelKey, status }` and `.map()` over it, rather than five copy-pasted JSX blocks —
  the copy-paste shape is what produced the aria bug recorded in `stage-03-sprint3-complete`.
- Update the file's header comment: it still says "Dumb, props-only (Sprint 4) — Sprint 6 wires
  useOrderStats(scope) around this"; keep that and append the S11 note about the badge.

### Action 7 — `Apps/web/src/pages/staff/orders/components/OrderStatusTabs.tsx`

Extend `TAB_STATUSES` so every status a stat card counts is reachable as a filter — today the array
stops at `COMPLETED`, so the new "cancelled by client" card would have no drill-down:

```ts
const TAB_STATUSES = [
  undefined,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKAGED,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
  // S11 — the terminal statuses were unreachable from the tab bar, so the new cancelled-by-client
  // stat card had nowhere to drill down to. The status filter already accepts all eight values
  // (BackofficeOrdersQuerySchema.status is the full enum) — only this list was short.
  OrderStatus.CANCELLED,
  OrderStatus.CANCELLED_BY_CLIENT,
  OrderStatus.RETURNED,
] as const;
```

No new translation keys — the tabs render `t(ORDER_STATUS_LABEL_KEY[s])`, which covers all eight.
No backend change — `BackofficeOrdersQuerySchema.status` is already `z.enum(OrderStatus)`.

> This action goes slightly beyond the literal text of §S11, which names only the stat card. It is
> included because a count with no way to see the rows behind it is not a usable stat card. Record
> it as such in the report.

---

## 5. Frontend — the orders table

### Action 8 — new `Apps/web/src/pages/staff/orders/components/OrderActionsMenu.tsx`

A dumb, props-only dropdown. **The one place the legal-action list is computed for the table.**

```tsx
interface OrderActionsMenuProps {
  order: OrderDto;
  /** target === RETURNED on a COMPLETED order means the admin return document (S10/R1), not a
   * machine transition — the caller routes it to ReturnOrderDialog. */
  onAction: (order: OrderDto, target: OrderStatus) => void;
}
```

Behavior:

1. `const targets = orderTransitionsFrom(order.orderType, order.status);` — from
   `@dragon-telecom/contract`, never a hand-written list (§S11: "using S10's contract constants").
2. Build the rendered list as:
   - every entry of `targets`;
   - **plus** `OrderStatus.CANCELLED` when `order.canBeCancelled` and `targets` does not already
     contain it (F3 — keeps the menu consistent with `OrderShowDialog`'s Cancel button and with
     what `cancelOrder` actually accepts at `IN_DELIVERY`);
   - **plus** `OrderStatus.RETURNED` when `order.status === OrderStatus.COMPLETED` (F4 — the return
     document action; `orderTransitionsFrom` returns `[]` there).
   De-duplicate, preserving that order.
3. Return `null` when the list is empty (a `CANCELLED`/`CANCELLED_BY_CLIENT`/`RETURNED` order has no
   actions at all) — the cell renders nothing rather than a dead trigger.
4. Wrap the whole menu in `<div onClick={(e) => e.stopPropagation()}>` so opening it never triggers
   the row's `onRowClick` (§S11: "while keeping row-click to open the order"). Precedent:
   `pages/admin/pos-clients/components/pos-clients-table.tsx:79`.
5. Trigger: `<Button variant="ghost" size="sm" aria-label={t("admin.orders.table.actionsAria")}>`
   with `<MoreHorizontal className="h-4 w-4" />` from `lucide-react`.
6. Items: `<DropdownMenuItem key={target} onSelect={() => onAction(order, target)}>` from
   `@/components/ui/dropdown-menu`. Label:
   - `RETURNED` on a `COMPLETED` order → `t("admin.orders.returnDialog.title")` *(exists)* — it opens
     the return document dialog, not a status change, and must not read like a status;
   - every other target → `t(ORDER_STATUS_LABEL_KEY[target])`.
   Give the `CANCELLED` item `className="text-destructive"`, matching the destructive Cancel button
   in `OrderShowDialog`.

### Action 9 — `Apps/web/src/pages/staff/orders/components/OrdersTable.tsx`

1. Add two props, both admin-only in effect (F2):

```ts
  /** ADM-09 §S11 — the user/category columns and the action column are admin-only; S18 carries
   * staff parity. Mirrors SalesTable's own `scope` gate. */
  scope?: "staff" | "admin";
  onAction?: (order: OrderDto, target: OrderStatus) => void;
```

2. Rebuild `columns` the way `SalesTable` does — a `base` array plus conditional `push`es — rather
   than one flat literal, so the admin-only columns are visibly gated:
   - keep `reference`, `contact`, `productName`, `quantity` (already per-line since S9), `orderType`,
     `totalAmount`, `status`, `placedAt`, `age` in their current order;
   - **after the `contact` column**, when `scope === "admin"`, insert:

     ```tsx
     {
       id: "user",
       header: t("staff.orders.table.user"),
       cell: ({ row }) => row.original.clientUsername ?? "-",
     },
     {
       id: "clientCategory",
       header: t("staff.orders.table.category"),
       cell: ({ row }) => row.original.clientCategoryName ?? "-",
     },
     ```

     `-` (a plain hyphen), per §S11's "`-` when unregistered". Note that the rest of this table
     uses an em dash `—` for empty cells; the issue text is explicit here, so use `-` for these two
     and leave the existing cells alone.
   - change the `status` cell to render the new badge:
     `cell: ({ row }) => <OrderStatusBadge status={row.original.status} />` (import from
     `@/components/shared/StatusBadge`). The mobile row keeps the plain text label — badges inside
     the compact mobile row would wrap.
   - **last**, when `scope === "admin" && onAction`, push:

     ```tsx
     {
       id: "actions",
       header: t("admin.orders.table.actions"),
       cell: ({ row }) => <OrderActionsMenu order={row.original} onAction={onAction} />,
     },
     ```

3. `columns`' `useMemo` dependency array becomes `[t, language, scope, onAction]`.
4. `TableSkeleton` column count becomes `scope === "admin" ? 12 : 9`.
5. The products cell (`row.original.lines.map(...).join(", ")`) is already per-line from S9 — §S11's
   "render products per line now that orders are multi-line" needs **no change** here. Say so in the
   report rather than editing it.

### Action 10 — `Apps/web/src/pages/staff/orders/components/OrderStatusDialog.tsx`

Add a pre-selected, locked target (R2):

1. New optional prop:

```ts
  /** S11 — when the admin launches a specific transition from the action column, that target is
   * pre-selected and the select is locked: the menu already expressed the choice, and re-opening
   * it inside the dialog would let the operator silently switch to a different transition than the
   * one they clicked. Absent when the dialog is opened from OrderShowDialog's generic
   * "Update status" button, where the select stays free. */
  presetStatus?: OrderStatus;
```

2. `defaultValues.status` becomes `presetStatus ?? targets[0]`.
3. The status `<Select>` gets `disabled={presetStatus != null}`.
4. When `presetStatus != null`, render only that one `<SelectItem>` instead of the whole `targets`
   list, so a disabled select can still display its value.
5. `targets.length === 0` still renders the `noTransitions` message — but note the dialog is now
   also reachable with `presetStatus === RETURNED` from `IN_DELIVERY`, where `targets` is non-empty,
   and is **never** reachable with `presetStatus === CANCELLED` or with a `COMPLETED` order (the
   caller routes both elsewhere, Action 11).

Update the component's header comment to describe the two entry points.

### Action 11 — `Apps/web/src/pages/staff/orders/StaffOrders.tsx`

1. New state: `const [presetStatus, setPresetStatus] = useState<OrderStatus | undefined>();`
2. New handler, the single router for every action-column click:

```tsx
  // S11/R2 — the action column never applies a transition directly; each target opens the dialog
  // that owns it. CANCELLED goes to the admin cancel dialog (it needs a reason and hits the
  // dedicated cancel endpoint); RETURNED on a COMPLETED order is the return *document*
  // (S10/R1 — FIFO restock + refund), while RETURNED from IN_DELIVERY is a plain machine
  // transition that only releases the reservation, so it goes through the status dialog.
  const handleRowAction = useCallback((order: OrderDto, target: OrderStatus) => {
    if (target === OrderStatus.CANCELLED) {
      setCancelOrderTarget(order);
    } else if (target === OrderStatus.RETURNED && order.status === OrderStatus.COMPLETED) {
      setReturnOrderTarget(order);
    } else {
      setPresetStatus(target);
      setStatusOrder(order);
    }
  }, []);
```

3. Pass `scope={scope}` and `onAction={scope === "admin" ? handleRowAction : undefined}` to
   `<OrdersTable>`.
4. `<OrderStatusDialog>`: pass `presetStatus={presetStatus}`, and extend the remount key so a second
   action on the *same* order still recomputes `defaultValues`:
   `key={statusOrder ? `${statusOrder.id}-${presetStatus ?? "any"}` : "none"}`
   (the existing comment above that key explains why the key is needed at all — extend it, don't
   replace it).
5. Clear the preset whenever the status dialog closes and whenever the generic "Update status"
   button in `OrderShowDialog` opens it:
   - `onOpenChange={(open) => { if (!open) { setStatusOrder(null); setPresetStatus(undefined); } }}`
   - `onSuccess: () => { setStatusOrder(null); setPresetStatus(undefined); }` inside
     `handleStatusSubmit`
   - the `onUpdateStatus` callback passed to `OrderShowDialog` calls `setPresetStatus(undefined)`
     before `setStatusOrder(showOrder)`.
6. `OrderStatus` is already imported in this file. Nothing else changes — no new hook, no new
   mutation, no query-key change (`useUpdateOrderStatus`, `useAdminCancelOrder` and `useReturnOrder`
   all already fan out through `invalidateOrderSideEffects`).

---

## 6. Translation keys

Add to `Apps/web/src/config/translations.json`. Follow the file's convention exactly: one flat
dotted key per entry, `{ "en": …, "fr": …, "ar": "" }` — **`ar` is an empty string** for every key
in this file today; do not invent Arabic copy.

| Key | en | fr |
|---|---|---|
| `staff.orders.stats.completed` | `Completed` | `Terminées` |
| `staff.orders.stats.cancelledByClient` | `Cancelled by client` | `Annulées par le client` |
| `staff.orders.table.user` | `User` | `Utilisateur` |
| `staff.orders.table.category` | `Category` | `Catégorie` |
| `admin.orders.table.actionsAria` | `Order actions` | `Actions de la commande` |

**Reused, already present — do not re-add:** `staff.orders.stats.pending`,
`staff.orders.stats.confirmed`, `staff.orders.stats.inDelivery`, `admin.orders.table.actions`,
`admin.orders.returnDialog.title`, `admin.orders.cancelDialog.title`, every `orders.*` status label,
and every `staff.orders.statusDialog.*` key added by S10.

---

## 7. Validation gate

No test file is read, edited or run (D12). In order:

```bash
(cd Apps/contract && npx tsc --noEmit && npm run lint)
(cd Apps/api     && npx tsc --noEmit 2>&1 | grep -E "^src/" ; npm run lint)
(cd Apps/web     && npx tsc --noEmit)
```

- `Apps/api`'s lint has a **6-error pre-existing baseline** (`prisma/seed.ts` ×3,
  `validate-request.middleware.ts` ×3, `report-S03.md`). Unchanged count = pass.
- `Apps/web`'s repo-wide lint carries ~10.2k pre-existing prettier findings (set-04 plan). Do **not**
  run `npm run lint` there. If `tsc` is clean, run `npx eslint --fix` **scoped to the files this set
  touched**, then re-run `tsc`.
- Rebuild the contract package before the api/web passes if the local workflow requires it.

Grep sweeps, all of which must come back empty (or comment-only):

```bash
# no hand-written transition list anywhere in the frontend
grep -rn "PENDING.*CONFIRMED.*PACKAGED" Apps/web/src --include=*.tsx --include=*.ts
# the old label-map path is gone
grep -rn "pages/staff/orders/order-status-labels" Apps/web/src
# no raw user-facing string added by this set
grep -rnE '>(Actions|User|Category|Completed)<' Apps/web/src/pages/staff/orders
```

---

## 8. Manual verification checklist

The owner runs these in the browser. Sign in as **admin** unless stated.

**Stat cards (R1)**
1. `/admin/orders` — **five** cards: Pending, Confirmed, In delivery, Completed, Cancelled by
   client. Each carries a colored pill under its number; Completed's is green, Cancelled by
   client's is red, Pending's is amber.
2. Switch the app to light mode. Every pill's text is legible against its fill (RC-3 — no white on
   pale).
3. The counts match reality: place an order, and Pending rises by one on reload.

**Tabs**
4. The tab bar now ends with **Cancelled**, **Cancelled by client** and **Returned**. Click
   "Cancelled by client" — the table lists exactly the orders a client cancelled from `/orders`, and
   the count matches the card.

**Table columns**
5. Place an order as a **registered, approved** client. The row shows their **username** and their
   **category** name.
6. Place an order as a **guest** (signed out). That row shows `-` in both columns.
7. Register a client, do **not** approve them, and place an order. Username shows; category shows
   `-`.
8. A multi-line order (order two different products from the cart) shows both product names in the
   Product cell and their **summed** quantity.
9. The Status cell renders the same colored pill as the stat cards.

**Action column (R2)**
10. A **PENDING pickup** order's action menu offers exactly *Confirmed* and *Cancelled* — nothing
    else. A **PENDING delivery** order offers the same two.
11. A **PACKAGED pickup** order offers *Completed* and *Cancelled*; a **PACKAGED delivery** order
    offers *In delivery* and *Cancelled*. (The machine differs by type — this is the point of the
    column.)
12. An **IN_DELIVERY** order offers *Completed*, *Returned* **and** *Cancelled* (F3).
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
18. On an **IN_DELIVERY** order, *Returned* opens the **status** dialog and, on submit, releases the
    reservation with **no refund and no credit movement** (S10 behavior, unchanged here).

**Price and payment prompts (F1 — verification only, no code changed)**
19. **Pickup → Completed**: the dialog shows the per-line **price** inputs *and* the **amount paid**
    input.
20. **Delivery → Packaged**: price inputs, **no** payment input.
21. **Delivery → In delivery**: delivery company + tracking number, no price, no payment.
22. **Delivery → Completed**: **amount paid** only — no price inputs (they belonged at Packaged).
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
