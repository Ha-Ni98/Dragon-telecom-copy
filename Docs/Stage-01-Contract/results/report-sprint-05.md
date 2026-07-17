# Sprint 5 — Sales & Orders

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/sales/`** — new module, 6 content files + barrel (plan F / spec `sales.md`):
  - `sales.enums.ts` — `SaleStatus`, `SaleOrigin`, `ReturnType`.
  - `sales.routes.ts` — `SALE_ROUTES` (8 constants; `STAFF_DETAIL`/`ADMIN_DETAIL` split from the spec's `(staff|admin)` shared-path notation).
  - `sales.command.ts` — `SaleDraftCommand` (`lines.min(1)`), `UpdateSaleDraftCommand`, `ConfirmSaleCommand`, `CreateReturnCommand` (`lines.min(1)`).
  - `sales.query.ts` — `SaleListQuery`, `SaleReferenceParams`, `SaleIdParams`.
  - `sales.dtos.ts` — `SaleDto` (cost/profit `.optional()`, mapping-gated), `ReceiptDto` (customer-facing — no cost/profit at all, not even optional).
  - `sales.events.ts` — `SalesEvents` map: `sale.confirmed`, `return.created`.
  - `index.ts` barrel.
- **`Apps/contract/src/modules/orders/`** — new module, 6 content files + barrel (plan G / spec `orders.md`):
  - `orders.enums.ts` — `OrderStatus` (7 values), `OrderType`.
  - `orders.routes.ts` — `ORDER_ROUTES` (13 constants; `BACKOFFICE_LIST`/`CONFIRM`/`STATUS`/`STATS` each split into `STAFF_*`/`ADMIN_*` pairs from the spec's `(staff|admin)` notation).
  - `orders.command.ts` — `PlaceOrderCommand` (two `.refine()`s: delivery required unless PICKUP, delivery forbidden when PICKUP — both directly verified by the spec's own Test Scenarios), `ConfirmOrderCommand`, `UpdateOrderStatusCommand`, `ReturnOrderCommand`.
  - `orders.query.ts` — `MyOrdersQuery`, `BackofficeOrdersQuery`, `OrderIdParams`. **No `OrderStatsQuery`** (see deviation below).
  - `orders.dtos.ts` — `OrderDto` (wilaya/commune inlined, cost/profit `.optional()`), `OrderStatsDto`.
  - `orders.events.ts` — `OrdersEvents` map: `order.confirmed`, `order.placed`, `order.statusChanged`, `order.cancelled`, `order.returned`.
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/sales'` and `export * from './modules/orders'`.

## Route-splitting decision (applies to both modules this sprint)

Both `sales.md` and `orders.md` use `(staff|admin)` path notation for several routes (`GET /api/(staff|admin)/orders`, etc.) — the same resource mounted under two role-prefixed paths. Consistent with how Sprints 2–4 already split every genuinely dual-mount or multi-resource path (`CATEGORIES`/`CATEGORIES_CUD`, `SUPPLIER_BY_ID`/`SUPPLIER_DETAIL`, `ADMIN_BRANDS`/`ADMIN_FAMILIES`/`ADMIN_MODELS`), each `(staff|admin)` route became a `STAFF_*`/`ADMIN_*` constant pair — a route constant can only hold one literal string, and the frontend needs to know which concrete path to call based on the current user's role.

## Plan deviation: `OrderStatsQuery` dropped

The plan sketched an `OrderStatsQuery`, but `orders.md`'s `STATS` route (`GET /api/(staff|admin)/orders/stats`) shows no query string in its path, and no query schema is given anywhere in the type block — consistent with how `PRODUCT_STATS` (Sprint 2) and `SUPPLIER_STATS` (Sprint 4) also had no accompanying query schema. Dropped for consistency rather than inventing filter params; flagged as a plan deviation, same category as Sprint 2's `ProductSort` drop.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`ReceiptDto.lines` modelled narrower than `SaleDto.lines`.** The spec gives `ReceiptDto { reference; lines; total; ... }` without a field list for `lines`. Since a receipt is a printed customer-facing document (unlike `SaleDto`, which is an internal read model gated by role), its lines carry no `productId`/`costOfGoods`/`profit`/`resolvedPrice` — only what a customer sees on paper (`productName; quantity; unitPrice; lineTotal; serialNumbers?`).
2. **`PlaceOrderCommand`'s "PICKUP requires a client token" is *not* encoded as a refine** — it's an auth-context check (does the request carry a valid JWT), not a body-shape constraint Zod can express; left as a backend guard. The two body-shape rules the spec's own Test Scenarios verify (`delivery` required/forbidden by `orderType`) *are* encoded as refines.
3. **`SaleDto`/`OrderDto`/event payloads with unlisted fields are minimally inferred** — same pattern as every prior sprint (`UpdateSaleDraftCommand`, `OrderStatsDto`, 4 of 5 `orders.*` events beyond `order.confirmed`'s partial payload, `return.created.creditEffect`). All flagged inline with code comments for backend-stage confirmation.
4. **`orders.dtos.ts` inlines `wilaya`/`commune`** rather than importing `platform.WilayaDto` — matches the plan's explicit call-out (plan G Deps) to avoid a cross-module edge not otherwise needed.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (61 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged — no new tests added, out of scope) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `soldAt`/`placedAt`/`confirmedAt`/`deliveredAt`/`cancelledAt` all `z.iso.datetime()`; `SaleListQuery.from/to` use `z.iso.date()` |
| No sensitive field in any DTO | ✅ — grep for `password`/`passwordHash`/`tokenHash` across both modules' DTOs returns no matches |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — both modules: 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 5 — sales & orders`.
