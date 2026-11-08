export enum ClientStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Validate-phone result — spec gives these lowercase, distinct from ClientStatus (uppercase).
export enum PhoneAvailability {
  AVAILABLE = 'available',
  REGISTERED = 'registered',
  PENDING = 'pending',
}

// S36 — the kind of a row in a client's purchase-history documents list ("Products bought" tab).
export enum PurchaseDocumentKind {
  SALE = 'SALE',
  ORDER = 'ORDER',
  RETURN = 'RETURN',
}
