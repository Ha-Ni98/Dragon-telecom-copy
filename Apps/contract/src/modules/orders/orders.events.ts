import type { OrderStatus } from './orders.enums';

// D1 (S9) — orders are multi-line. D2/D3/D5 (S10) — nothing accrues at confirmation any more, so
// order.confirmed is now PENDING->CONFIRMED only, with no money/line payload: no consumption, no
// invoice, no credit happen there. Completion is narrated through order.statusChanged, and its
// money through invoice.issued / payment.clientRecorded, exactly like a POS sale since S5.
export type OrdersEvents = {
  'order.confirmed': { orderId: string; clientId?: string; posClientId?: string; confirmedByStaffId: string };
  'order.placed': { orderId: string; clientId?: string };
  'order.statusChanged': { orderId: string; fromStatus: OrderStatus; toStatus: OrderStatus };
  // byClient distinguishes CANCELLED (admin) from CANCELLED_BY_CLIENT (D4) for observability.
  'order.cancelled': { orderId: string; reason?: string; byClient?: boolean };
  'order.returned': { orderId: string; refundAmount: number };
};
