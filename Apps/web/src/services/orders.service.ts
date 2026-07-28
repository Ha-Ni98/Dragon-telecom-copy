// Orders domain (client-facing + admin order management) — Sub-01 scaffolding. See
// catalog.service.ts's header comment for the numeric-id/view-model scope decision this follows.
import type { OrderWithDetails } from "@/types/draft-types/order.types";

export async function getMyOrders(): Promise<OrderWithDetails[]> {
  return [];
}

export async function cancelOrder(_orderId: number): Promise<void> {}

// ============================================================================
// Sub-02 real orders service — contract-typed, HTTP-wired (integration
// plan.md §2.6). Consumed by the new hooks (useOrdersPortal.ts,
// useOrdersDirectory.ts). set-03 Sprint 6 rewired AdminOrders.tsx onto this
// (and useOrdersDirectory.ts) directly, retiring the Sub-01 admin stub
// (getAdminOrders/getAdminOrdersStats/updateAdminOrder, use-admin-orders.ts) —
// `cancelOrder` above (still Sub-01, client-facing MY_CANCEL) is why the real
// admin-cancel function below is named `adminCancelOrder` instead.
// ============================================================================
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  ORDER_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type PlaceOrderCommand,
  type OrderDto,
  type MyOrdersQuery,
  type BackofficeOrdersQuery,
  type UpdateOrderStatusCommand,
  type ReturnOrderCommand,
  type OrderStatsDto,
} from "@dragon-telecom/contract";

export type OrderScope = "staff" | "admin";

// No contract schema for the admin CANCEL body (orders.interface.ts's own comment: reusing
// UpdateOrderStatusSchema would accept fields CANCEL never uses) — declared locally, matching
// the backend's local (non-contract) CancelOrderCommand exactly.
export type AdminCancelOrderCommand = { reason?: string };

// One key per call — usePlaceOrder() has no retry (TanStack v5 mutations default to 0), so each
// invocation already corresponds 1:1 with one user-initiated submit attempt (PUB-03: "POST
// /api/orders with an idempotency key"). NOTE (engine gap, pub-pages plan.md D6): Apps/api's
// ORDER_ROUTES.PLACE handler (orders.controller.ts/orders.routes.ts) does not read or validate
// this header today — no dedup middleware exists yet on the backend. Sending it is harmless and
// forward-compatible, but it does not yet prevent a duplicate submission server-side; flagged
// for a backend follow-up, out of scope for this frontend service.
export async function placeOrder(command: PlaceOrderCommand): Promise<OrderDto> {
  const res = await api.post<ApiResponse<OrderDto>>(apiPath(ORDER_ROUTES.PLACE), command, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bare array — MyOrdersQuery carries no page/limit (integration plan.md §0.2 pagination rule).
export async function listMyOrders(query: MyOrdersQuery): Promise<OrderDto[]> {
  const res = await api.get<ApiResponse<OrderDto[]>>(apiPath(ORDER_ROUTES.MY_LIST), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// No command body — confirmed against orders.routes.ts (MY_CANCEL validates only
// OrderIdParamsSchema, no body schema).
export async function cancelMyOrder(id: string): Promise<OrderDto> {
  const res = await api.post<ApiResponse<OrderDto>>(
    withParams(apiPath(ORDER_ROUTES.MY_CANCEL), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listOrders(
  scope: OrderScope,
  query: BackofficeOrdersQuery,
): Promise<PaginatedResult<OrderDto>> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_LIST : ORDER_ROUTES.STAFF_LIST;
  const res = await api.get<ApiResponse<PaginatedResult<OrderDto>>>(apiPath(route), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateOrderStatus(
  scope: OrderScope,
  id: string,
  command: UpdateOrderStatusCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_STATUS : ORDER_ROUTES.STAFF_STATUS;
  const res = await api.patch<ApiResponse<OrderDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S18/D-1 — renamed from `adminCancelOrder`: staff holding the orders page may cancel/return an
// order too, so the old name would lie. `AdminCancelOrderCommand` keeps its name — the command
// shape is genuinely the same document regardless of who submits it.
export async function cancelBackofficeOrder(
  scope: OrderScope,
  id: string,
  command: AdminCancelOrderCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_CANCEL : ORDER_ROUTES.STAFF_CANCEL;
  const res = await api.post<ApiResponse<OrderDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function returnOrder(
  scope: OrderScope,
  id: string,
  command: ReturnOrderCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_RETURN : ORDER_ROUTES.STAFF_RETURN;
  const res = await api.post<ApiResponse<OrderDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function orderStats(scope: OrderScope): Promise<OrderStatsDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_STATS : ORDER_ROUTES.STAFF_STATS;
  const res = await api.get<ApiResponse<OrderStatsDto>>(apiPath(route));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
