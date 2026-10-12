import { SETTLEMENT_CHECK, type SettlementCheck } from "@/types/settlement.types";

// Cents comparison (S32/P1) — mirrors the API's own rule so a total like 0.1 + 0.2 still matches.
export const sameMoney = (a: number, b: number): boolean =>
  Math.round(a * 100) === Math.round(b * 100);

// S32 — the one rule shared by the POS paid amount and both sale-return refund fields: empty
// blocks; a walk-in must match exactly; an attached client may differ once the credit change is
// confirmed.
export function checkSettlement(
  entered: number | null | undefined,
  due: number,
  hasClient: boolean,
): SettlementCheck {
  if (entered == null || Number.isNaN(entered)) return SETTLEMENT_CHECK.EMPTY;
  if (sameMoney(entered, due)) return SETTLEMENT_CHECK.MATCH;
  return hasClient ? SETTLEMENT_CHECK.NEEDS_CREDIT_CONFIRM : SETTLEMENT_CHECK.WALK_IN_MISMATCH;
}
