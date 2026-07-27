import { z } from 'zod';
import { OrderStatus, OrderType } from './orders.enums';

// delivery block required unless PICKUP, forbidden when PICKUP (Test Scenarios: "pickup +
// delivery block -> 400"). "PICKUP requires a client token" is an auth-context check
// (depends on the request, not the body) — left to the backend guard.
// D1 — a single-product placement (ProductDetails.tsx/Cart.tsx today) is simply a one-element
// `lines` array; the cart's true multi-line placement is S16.
export const PlaceOrderSchema = z
  .object({
    clientId: z.uuid().nullable().optional(),
    lines: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1),
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

// The single forward-transition command (S10/R3 — the separate confirm endpoint is gone).
// `lines` carries the per-line price edit legal at ORDER_PRICE_EDIT_STATUS (D11) and the serial
// numbers previously collected at confirmation; `paidAmount` is the payment captured at
// COMPLETED (D5 — it becomes a ClientPayment row when the client is known).
// deliveryCompany/trackingNumber stay required for IN_DELIVERY, enforced server-side.
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus),
  deliveryCompany: z.string().optional(),
  trackingNumber: z.string().optional(),
  reason: z.string().optional(),
  lines: z
    .array(
      z.object({
        orderLineId: z.uuid(),
        unitPrice: z.number().min(0).optional(),
        serialNumbers: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  paidAmount: z.number().min(0).optional(),
});
export type UpdateOrderStatusCommand = z.infer<typeof UpdateOrderStatusSchema>;

// Admin return of a COMPLETED order (S9/R1 — the admin COMPLETED->RETURNED action survives
// alongside S10's per-type machine). One return per order — the order flips to RETURNED — so
// quantities are absolute, not cumulative across several return documents the way sales' are.
export const ReturnOrderSchema = z.object({
  lines: z
    .array(
      z.object({
        orderLineId: z.uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  restock: z.boolean(),
  refundAmount: z.number().min(0),
});
export type ReturnOrderCommand = z.infer<typeof ReturnOrderSchema>;
