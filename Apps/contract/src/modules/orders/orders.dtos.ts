import { z } from 'zod';
import { OrderStatus, OrderType } from './orders.enums';

// wilaya/commune are inlined (not imported from platform.WilayaDto) to keep orders from
// depending on platform — avoids a cross-module edge the plan doesn't call for (plan G).
// costOfGoods/profit are mapping-gated (admin-only), modelled .optional().
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
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  resolvedPrice: z.number(),
  unitPrice: z.number(),
  serialNumbers: z.array(z.string()).optional(),
  subtotal: z.number(),
  deliveryFee: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  costOfGoods: z.number().optional(),
  profit: z.number().optional(),
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
  returned: z.number().int().min(0),
});
export type OrderStatsDto = z.infer<typeof OrderStatsResponseSchema>;
