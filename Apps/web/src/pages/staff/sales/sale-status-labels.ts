import { SaleStatus } from "@dragon-telecom/contract";

// S34 — one label map shared by the sales table and the filter bar. Each used to keep its own
// copy, and both mislabelled PARTIALLY_RETURNED as "Returned".
export const SALE_STATUS_LABEL_KEY: Record<SaleStatus, string> = {
  [SaleStatus.DRAFT]: "staff.sales.status.draft",
  [SaleStatus.COMPLETED]: "staff.sales.status.completed",
  [SaleStatus.RETURNED]: "orders.returned",
  [SaleStatus.PARTIALLY_RETURNED]: "staff.sales.status.partiallyReturned",
  [SaleStatus.CANCELLED]: "orders.cancelled",
};
