import { z } from 'zod';
import { OrderStatus, OrderType } from './orders.enums';

// D1 — orders are multi-line. Mirrors SaleLineResponseSchema's shape (sales.dtos.ts): a snapshot
// of what was ordered, plus the two margin-gated FIFO figures which stay absent until the order
// completes (S10) and are stripped entirely for a non-admin viewer.
export const OrderLineResponseSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  resolvedPrice: z.number(),
  unitPrice: z.number(),
  serialNumbers: z.array(z.string()).optional(),
  costOfGoods: z.number().optional(),
  profit: z.number().optional(),
  lineTotal: z.number(),
});
export type OrderLineDto = z.infer<typeof OrderLineResponseSchema>;

// wilaya/commune are inlined (not imported from platform.WilayaDto) to keep orders from
// depending on platform — avoids a cross-module edge the plan doesn't call for (plan G).
// totalCost/totalProfit (order-level) and each line's own costOfGoods/profit are mapping-gated
// (admin-only), modelled .optional().
export const OrderResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(OrderStatus),
  orderType: z.enum(OrderType),
  contactName: z.string(),
  contactPhone: z.string(),
  wilaya: z.object({ id: z.uuid(), frName: z.string(), arName: z.string() }).optional(),
  commune: z.object({ id: z.uuid(), frName: z.string(), arName: z.string() }).optional(),
  address: z.string().optional(),
  deliveryCompany: z.string().optional(),
  trackingNumber: z.string().optional(),
  lines: z.array(OrderLineResponseSchema),
  subtotal: z.number(),
  deliveryFee: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  totalCost: z.number().optional(), // margin-gated, set at COMPLETED (S10)
  totalProfit: z.number().optional(),
  placedAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().optional(),
  deliveredAt: z.iso.datetime().optional(),
  cancelledAt: z.iso.datetime().optional(),
  canBeCancelled: z.boolean(),
  ageHours: z.number(),
});
export type OrderDto = z.infer<typeof OrderResponseSchema>;

// No field list given for STATS; modelled as a per-status count roll-up (mirrors
// OrderStatus's own values), flagged for confirmation once dashboard needs are known.
export const OrderStatsResponseSchema = z.object({
  pending: z.number().int().min(0),
  confirmed: z.number().int().min(0),
  packaged: z.number().int().min(0),
  inDelivery: z.number().int().min(0),
  completed: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  cancelledByClient: z.number().int().min(0),
  returned: z.number().int().min(0),
});
export type OrderStatsDto = z.infer<typeof OrderStatsResponseSchema>;
