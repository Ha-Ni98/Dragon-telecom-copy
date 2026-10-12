// S32 — sales business-rule sentinels. They travel as the error *message*, not error.code (same
// convention as CATALOG_ERROR / REPAIR_ERROR — see web lib/query-client.ts). CREDIT_REQUIRES_CLIENT
// keeps its historic literal value: orders and repairs still throw the same string.
export const SALE_ERROR = {
  CREDIT_REQUIRES_CLIENT: 'CREDIT_REQUIRES_CLIENT',
  WALK_IN_OVERPAYMENT: 'SALE_WALK_IN_OVERPAYMENT',
  WALK_IN_REFUND_MISMATCH: 'SALE_WALK_IN_REFUND_MISMATCH',
  WHOLE_RETURN_LINES_MISMATCH: 'SALE_WHOLE_RETURN_LINES_MISMATCH',
  NOTHING_TO_RETURN: 'SALE_NOTHING_TO_RETURN',
} as const;
export type SaleErrorSentinel = (typeof SALE_ERROR)[keyof typeof SALE_ERROR];
