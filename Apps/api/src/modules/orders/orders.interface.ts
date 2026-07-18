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
  ReturnOrderCommand,
  UpdateOrderStatusCommand,
} from '@dragon-telecom/contract';

// No contract schema for CANCEL's body (plan §I.2 footnote — reusing UpdateOrderStatusSchema
// would accept fields CANCEL never uses); a minimal local type, validated in orders.routes.ts
// via an inline z.object, same "no new contract schema" resolution as §C-5 in set 06.
export type CancelOrderCommand = { reason?: string };

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
