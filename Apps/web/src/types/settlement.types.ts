// S32 — outcome of checking an entered amount (POS paid amount, return refund) against what is
// due. Walk-ins must match exactly; an attached client may differ, after confirming the credit
// change.
export const SETTLEMENT_CHECK = {
  EMPTY: "empty",
  MATCH: "match",
  WALK_IN_MISMATCH: "walkInMismatch",
  NEEDS_CREDIT_CONFIRM: "needsCreditConfirm",
} as const;
export type SettlementCheck = (typeof SETTLEMENT_CHECK)[keyof typeof SETTLEMENT_CHECK];
