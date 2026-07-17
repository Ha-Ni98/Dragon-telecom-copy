export enum SaleStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  RETURNED = 'RETURNED',
  PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum SaleOrigin {
  POS = 'POS',
  REPAIR = 'REPAIR',
}

export enum ReturnType {
  REFUND = 'REFUND',
  EXCHANGE = 'EXCHANGE',
}
