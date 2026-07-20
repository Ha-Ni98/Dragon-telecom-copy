// Orders domain (client-facing + admin order management) — Sub-01 scaffolding. See
// catalog.service.ts's header comment for the numeric-id/view-model scope decision this follows.
import type { OrderWithDetails, AdminOrderWithDetails, AdminOrdersStats } from "@/types/draft-types/order.types";
import type { OrderStatusCode } from "@/types/draft-types/enums.types";

export async function getMyOrders(): Promise<OrderWithDetails[]> {
  return [];
}

export async function cancelOrder(_orderId: number): Promise<void> {}

export interface AdminOrdersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: OrderStatusCode;
}

export interface AdminOrdersPage {
  orders: AdminOrderWithDetails[];
  total: number;
  totalPages: number;
}

export async function getAdminOrders(_query: AdminOrdersQuery): Promise<AdminOrdersPage> {
  return { orders: [], total: 0, totalPages: 0 };
}

export async function getAdminOrdersStats(): Promise<AdminOrdersStats> {
  return { totalOrdersThisMonth: 0, pendingOrders: 0, confirmedOrders: 0, deliveryOrders: 0 };
}

export async function updateAdminOrder(_orderId: number, _updates: Partial<AdminOrderWithDetails>): Promise<void> {}

// ============================================================================
// Sub-02 real orders service — contract-typed, HTTP-wired (integration
// plan.md §2.6). Consumed by the new hooks (useOrdersPortal.ts,
// useOrdersDirectory.ts), NOT by the Sub-01 stub hooks above — those still
// call the stub functions above and stay wired to the pre-existing pages
// until Sub-03 rewires them (integration sprints.md Sprint 5 handoff note,
// same pattern as Sprints 3/4). `cancelOrder` above (Sub-01 stub) is why the
// real admin-cancel function below is named `adminCancelOrder` instead.
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
  type ConfirmOrderCommand,
  type UpdateOrderStatusCommand,
  type ReturnOrderCommand,
  type OrderStatsDto,
} from "@dragon-telecom/contract";

export type OrderScope = "staff" | "admin";

// No contract schema for the admin CANCEL body (orders.interface.ts's own comment: reusing
// UpdateOrderStatusSchema would accept fields CANCEL never uses) — declared locally, matching
// the backend's local (non-contract) CancelOrderCommand exactly.
export type AdminCancelOrderCommand = { reason?: string };

export async function placeOrder(command: PlaceOrderCommand): Promise<OrderDto> {
  const res = await api.post<ApiResponse<OrderDto>>(apiPath(ORDER_ROUTES.PLACE), command);
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

export async function confirmOrder(
  scope: OrderScope,
  id: string,
  command: ConfirmOrderCommand,
): Promise<OrderDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_CONFIRM : ORDER_ROUTES.STAFF_CONFIRM;
  const res = await api.post<ApiResponse<OrderDto>>(withParams(apiPath(route), { id }), command);
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

export async function adminCancelOrder(
  id: string,
  command: AdminCancelOrderCommand,
): Promise<OrderDto> {
  const res = await api.post<ApiResponse<OrderDto>>(
    withParams(apiPath(ORDER_ROUTES.CANCEL), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function returnOrder(id: string, command: ReturnOrderCommand): Promise<OrderDto> {
  const res = await api.post<ApiResponse<OrderDto>>(
    withParams(apiPath(ORDER_ROUTES.RETURN), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function orderStats(scope: OrderScope): Promise<OrderStatsDto> {
  const route = scope === "admin" ? ORDER_ROUTES.ADMIN_STATS : ORDER_ROUTES.STAFF_STATS;
  const res = await api.get<ApiResponse<OrderStatsDto>>(apiPath(route));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
