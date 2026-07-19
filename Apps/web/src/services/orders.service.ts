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
