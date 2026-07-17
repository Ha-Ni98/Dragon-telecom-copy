export enum InvoiceStatus {
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// Never REPAIR (spec) — repair pickups are recorded as a repair-origin sale with no
// invoice, so this union has no third member.
export enum InvoiceSource {
  SALE = 'SALE',
  ORDER = 'ORDER',
}
