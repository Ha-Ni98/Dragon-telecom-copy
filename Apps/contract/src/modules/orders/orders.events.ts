import type { OrderStatus } from './orders.enums';

// Only order.confirmed has a partial payload in the spec (snapshotLine/totals aren't
// fielded); the other four events are named without any payload. Modelled minimally,
// mirroring OrderDto's own money/line fields where a shape is clearly implied.
export type OrdersEvents = {
  'order.confirmed': {
    orderId: string;
    clientId?: string;
    posClientId?: string;
    snapshotLine: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    };
    totals: { subtotal: number; deliveryFee: number; totalAmount: number; paidAmount: number };
    confirmedByStaffId: string;
  };
  'order.placed': { orderId: string; clientId?: string };
  'order.statusChanged': { orderId: string; fromStatus: OrderStatus; toStatus: OrderStatus };
  'order.cancelled': { orderId: string; reason?: string };
  'order.returned': { orderId: string; refundAmount: number };
};
