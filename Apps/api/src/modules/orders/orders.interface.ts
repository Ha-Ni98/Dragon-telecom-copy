import type { Prisma } from '@prisma/client';
import type {
  BackofficeOrdersQuery,
  BillingEvents,
  ConfirmOrderCommand,
  JWTPayload,
  MyOrdersQuery,
  OrderDto,
  OrderStatsDto,
  PaginatedResult,
  PlaceOrderCommand,
  ProductWithPricingDto,
  ReturnOrderCommand,
  UpdateOrderStatusCommand,
} from '@dragon-telecom/contract';

// No contract schema for CANCEL's body (plan §I.2 footnote — reusing UpdateOrderStatusSchema
// would accept fields CANCEL never uses); a minimal local type, validated in orders.routes.ts
// via an inline z.object, same "no new contract schema" resolution as §C-5 in set 06.
export type CancelOrderCommand = { reason?: string };

// `undefined` = guest — mirrors catalog's own Viewer alias (getCartProducts' resolution
// branches on this exact shape).
export type Viewer = JWTPayload | undefined;

// Injected port (dependency inversion, Sprint 2 discovery — the plan's §I.2 "direct
// Product/ProductPrice read" undersold what's actually needed): catalog's own
// `resolvePricing` — tier price via the client's linked PosClient category, else
// `guestPrice`, else hidden — is *already* the exact viewer-price rule orders.md BL#1
// describes for guests, and catalog's own `getCartProducts` doc comment explicitly names
// "storefront/POS/orders" as its three consumers. Reusing it (rather than re-deriving
// guestPrice-only logic here) avoids duplicating a business rule catalog already owns and
// keeps a registered client's order-time price consistent with what they saw browsing the
// storefront. Real implementation: `CatalogProductService.getCartProducts` (already public,
// already consumed this same way by clients' `ICatalogCartPort`) — assembled directly in
// orders.routes.ts (Sprint 3), no adapter (one-directional DI, set-05/06 precedent).
export interface ICatalogViewerPricingPort {
  getCartProducts(productIds: string[], viewer: Viewer): Promise<ProductWithPricingDto[]>;
}

// Injected port (dependency inversion, credit-serialization fix, plan §C2/§C4) — real
// implementation is clients' own composition-root singleton (`clientsService`, exported from
// clients.routes.ts), assembled directly in `orders.routes.ts` (one-directional dependency, no
// adapter — the same shape as ICatalogViewerPricingPort above). PosClient belongs to the
// clients module; orders must write it only through this port, always inside its own
// transaction (`tx`), never via a post-commit listener. Orders never touch credit (spec:
// "totalSold += totalAmount" only) — narrower than sales' own IClientCreditPort.
export interface IOrderCreditPort {
  applyOrderSold(tx: Prisma.TransactionClient, posClientId: string, payload: { totalAmount: number }): Promise<void>;
}

export interface IOrdersService {
  // public|client — actor absent for a guest placement (plan §I.2/§D-2).
  placeOrder(cmd: PlaceOrderCommand, actor?: JWTPayload): Promise<OrderDto>;

  // client — scoped clientId=me.
  listMyOrders(query: MyOrdersQuery, clientId: string): Promise<OrderDto[]>;
  // client — own + PENDING only.
  cancelMyOrder(id: string, clientId: string): Promise<OrderDto>;

  // staff(STAFF_ORDERS)|admin — same data; margins gated per actor.type (plan §D-3).
  listBackoffice(query: BackofficeOrdersQuery, actor: JWTPayload): Promise<PaginatedResult<OrderDto>>;
  // staff(STAFF_ORDERS)|admin — the confirm transaction.
  confirmOrder(id: string, cmd: ConfirmOrderCommand, actor: JWTPayload): Promise<OrderDto>;
  // staff(STAFF_ORDERS)|admin — forward-only ≤ COMPLETED.
  updateStatus(id: string, cmd: UpdateOrderStatusCommand, actor: JWTPayload): Promise<OrderDto>;

  // admin-only.
  cancelOrder(id: string, cmd: CancelOrderCommand, actor: JWTPayload): Promise<OrderDto>;
  // admin-only — from COMPLETED only.
  returnOrder(id: string, cmd: ReturnOrderCommand, actor: JWTPayload): Promise<OrderDto>;

  // staff(STAFF_ORDERS)|admin — same data (per-status counts).
  getStats(): Promise<OrderStatsDto>;

  // Internal — invoked only by this module's own listener (post-commit), never by HTTP routes.
  applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void>;
}
