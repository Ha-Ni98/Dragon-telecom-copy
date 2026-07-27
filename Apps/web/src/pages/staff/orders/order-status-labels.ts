import { OrderStatus } from "@dragon-telecom/contract";

// Single source of truth for OrderStatus -> translation key, shared by every component in
// this cluster that renders a status label (OrderStatusTabs, OrdersTable, OrderStatusDialog,
// OrderShowDialog's timeline) — was duplicated 3x before this extraction.
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
