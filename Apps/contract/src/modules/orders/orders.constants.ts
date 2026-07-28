import { OrderStatus, OrderType } from './orders.enums';

// D2/D4/D11 — the per-type forward machine (S10). Shared by the backend guard
// (orders.service.ts's updateStatus) and the admin action column (S11), so a legal move is
// defined exactly once.
//
// A target of CANCELLED is listed here because it is offered from the same action menu, but it is
// ADMIN-ONLY and routed to the cancel path, not the forward path. CANCELLED_BY_CLIENT is absent
// on purpose: it is reachable only through the client's own MY_CANCEL endpoint.
const DELIVERY_TRANSITIONS: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKAGED, OrderStatus.CANCELLED],
  [OrderStatus.PACKAGED]: [OrderStatus.IN_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.IN_DELIVERY]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
};

const PICKUP_TRANSITIONS: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKAGED, OrderStatus.CANCELLED],
  [OrderStatus.PACKAGED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
};

export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderType, Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>>>
> = {
  [OrderType.PICKUP]: PICKUP_TRANSITIONS,
  [OrderType.DELIVERY_HOME]: DELIVERY_TRANSITIONS,
  [OrderType.DELIVERY_OFFICE]: DELIVERY_TRANSITIONS,
};

// Nothing leaves these. COMPLETED is terminal *for the machine*: the only way out is the admin
// RETURN document action (R1), which is not a machine transition.
export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.CANCELLED_BY_CLIENT,
  OrderStatus.RETURNED,
];

// D11 — the status at which staff may still set each line's charged price. Pickup orders are
// priced at the moment they complete; delivery orders at packaging, before they leave the store.
export const ORDER_PRICE_EDIT_STATUS: Readonly<Record<OrderType, OrderStatus>> = {
  [OrderType.PICKUP]: OrderStatus.COMPLETED,
  [OrderType.DELIVERY_HOME]: OrderStatus.PACKAGED,
  [OrderType.DELIVERY_OFFICE]: OrderStatus.PACKAGED,
};

export function orderTransitionsFrom(type: OrderType, from: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[type][from] ?? [];
}

export function isOrderTransitionAllowed(type: OrderType, from: OrderStatus, to: OrderStatus): boolean {
  return orderTransitionsFrom(type, from).includes(to);
}

export function isOrderStatusTerminal(status: OrderStatus): boolean {
  return ORDER_TERMINAL_STATUSES.includes(status);
}

// The money moment (D2/D3/D5): payment is captured, the invoice is issued and cost/profit are
// recognised only here, for every order type.
export function orderTransitionRequiresPayment(to: OrderStatus): boolean {
  return to === OrderStatus.COMPLETED;
}

export function orderTransitionAllowsPriceEdit(type: OrderType, to: OrderStatus): boolean {
  return ORDER_PRICE_EDIT_STATUS[type] === to;
}
