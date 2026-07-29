export enum InvoiceStatus {
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

// A repair issues an invoice and no sale record (D9) — its invoice is issued at PICKED_UP,
// carrying source REPAIR.
export enum InvoiceSource {
  SALE = 'SALE',
  ORDER = 'ORDER',
  REPAIR = 'REPAIR',
}
