import { z } from 'zod';
import { OrderStatus, OrderType } from './orders.enums';

// delivery block required unless PICKUP, forbidden when PICKUP (Test Scenarios: "pickup +
// delivery block -> 400"). "PICKUP requires a client token" is an auth-context check
// (depends on the request, not the body) — left to the backend guard.
export const PlaceOrderSchema = z
  .object({
    clientId: z.uuid().nullable().optional(),
    productId: z.uuid(),
    quantity: z.number().int().min(1),
    orderType: z.enum(OrderType),
    contact: z.object({
      fullName: z.string(),
      phone: z.string(),
    }),
    delivery: z
      .object({
        wilayaId: z.uuid(),
        communeId: z.uuid(),
        address: z.string().optional(),
      })
      .optional(),
  })
  .refine((d) => d.orderType === OrderType.PICKUP || d.delivery !== undefined, {
    message: 'delivery is required unless orderType is PICKUP',
    path: ['delivery'],
  })
  .refine((d) => d.orderType !== OrderType.PICKUP || d.delivery === undefined, {
    message: 'delivery must be absent when orderType is PICKUP',
    path: ['delivery'],
  });
export type PlaceOrderCommand = z.infer<typeof PlaceOrderSchema>;

export const ConfirmOrderSchema = z.object({
  unitPrice: z.number().min(0).optional(),
  serialNumbers: z.array(z.string()).optional(),
  paidAmount: z.number().min(0).optional(),
});
export type ConfirmOrderCommand = z.infer<typeof ConfirmOrderSchema>;

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus),
  deliveryCompany: z.string().optional(),
  trackingNumber: z.string().optional(),
  reason: z.string().optional(),
});
export type UpdateOrderStatusCommand = z.infer<typeof UpdateOrderStatusSchema>;

export const ReturnOrderSchema = z.object({
  quantity: z.number().int().min(1),
  restock: z.boolean(),
  refundAmount: z.number().min(0),
});
export type ReturnOrderCommand = z.infer<typeof ReturnOrderSchema>;
