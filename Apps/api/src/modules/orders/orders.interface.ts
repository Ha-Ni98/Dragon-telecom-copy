import type { Prisma } from '@prisma/client';
import type {
  BackofficeOrdersQuery,
  BillingEvents,
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
import type { InvoiceIssueRequest } from '../billing/billing.interface';

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

// Injected port (dependency inversion, credit-serialization fix, plan §C2/§C4; the shared
// applyDocumentCharge primitive, plan S5) — real implementation is clients' own
// composition-root singleton (`clientsService`, exported from clients.routes.ts), assembled
// directly in `orders.routes.ts` (one-directional dependency, no adapter — the same shape as
// ICatalogViewerPricingPort above). PosClient belongs to the clients module; orders must write it
// only through this port, always inside its own transaction (`tx`), never via a post-commit
// listener. S10 — orders now apply `creditDelta: totalAmount` at COMPLETED (D2/D3), with the
// captured payment applied separately through billing's captureClientPaymentInTx (D5's split,
// S5 §R1); orders never call this at confirm any more.
export interface IOrderCreditPort {
  applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}

// Injected port (dependency inversion, S5's primitives) — real implementation is billing's own
// composition-root singleton (`billingService`, exported from billing.routes.ts), assembled
// directly in orders.routes.ts. An order's invoice and its captured payment are created INSIDE
// the completion transaction (D3/D5), never by a post-commit listener — the same shape sales'
// confirm has used since S5.
export interface IBillingIssuePort {
  issueInvoiceInTx(tx: Prisma.TransactionClient, input: InvoiceIssueRequest): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
}

export interface IOrdersService {
  // public|client — actor absent for a guest placement (plan §I.2/§D-2).
  placeOrder(cmd: PlaceOrderCommand, actor?: JWTPayload): Promise<OrderDto>;

  // client — scoped clientId=me.
  listMyOrders(query: MyOrdersQuery, clientId: string): Promise<OrderDto[]>;
  // client — any non-terminal status except COMPLETED (D4/R4, S10) — writes CANCELLED_BY_CLIENT.
  cancelMyOrder(id: string, clientId: string): Promise<OrderDto>;

  // staff(STAFF_ORDERS)|admin — same data; margins gated per actor.type (plan §D-3).
  listBackoffice(query: BackofficeOrdersQuery, actor: JWTPayload): Promise<PaginatedResult<OrderDto>>;
  // staff(STAFF_ORDERS)|admin — the single forward-transition driver (S10/R3 — confirm folded
  // in). Drives the per-type machine (ORDER_STATUS_TRANSITIONS); COMPLETED is the money moment.
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
