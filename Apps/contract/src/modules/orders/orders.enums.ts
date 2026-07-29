export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PACKAGED = 'PACKAGED',
  IN_DELIVERY = 'IN_DELIVERY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  // D4 — client-initiated cancellation; terminal, releases the reservation exactly like admin
  // CANCELLED (S10).
  CANCELLED_BY_CLIENT = 'CANCELLED_BY_CLIENT',
  RETURNED = 'RETURNED',
}

export enum OrderType {
  PICKUP = 'PICKUP',
  DELIVERY_HOME = 'DELIVERY_HOME',
  DELIVERY_OFFICE = 'DELIVERY_OFFICE',
}
