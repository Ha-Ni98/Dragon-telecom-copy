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
