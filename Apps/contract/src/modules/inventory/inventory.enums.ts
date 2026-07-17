export enum MovementDirection {
  IN = 'IN',
  OUT = 'OUT',
  PENDING = 'PENDING',
}

export enum MovementType {
  SUPPLIER_INVOICE = 'SUPPLIER_INVOICE',
  INITIAL_STOCK = 'INITIAL_STOCK',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  RETURN_IN = 'RETURN_IN',
  SALE = 'SALE',
  ORDER_OUT = 'ORDER_OUT',
  REPAIR_CONSUMPTION = 'REPAIR_CONSUMPTION',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  PENDING_ORDER = 'PENDING_ORDER',
  PENDING_REPAIR = 'PENDING_REPAIR',
  PENDING_RELEASE = 'PENDING_RELEASE',
}

export enum AdjustmentReason {
  COUNT = 'COUNT',
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  CORRECTION = 'CORRECTION',
}

// Local to ReservationDto.holderType — a 2-value literal union in the spec, given an enum
// per rules §3.4 (no magic strings) rather than an inline z.enum([...]) array.
export enum ReservationHolderType {
  ORDER = 'ORDER',
  REPAIR = 'REPAIR',
}
