import type { CashRegisterDrill } from "@dragon-telecom/contract";

// S33 — one figure on the Caisse page; clickable when it has a drill-through target.
export interface CashRegisterFigure {
  labelKey: string;
  /** Already formatted (money or count). */
  value: string;
  /** Absent = not clickable. */
  drill?: CashRegisterDrill;
  /** S35 — already-formatted sub-line under the value (e.g. a breakdown); replaces the drill hint. */
  detail?: string;
}

// S33 — which optional columns a drill-through list shows.
export interface CashRegisterDrillColumns {
  paid: boolean;
  sourceReference: boolean;
  /** S35 — admin-only documents endpoint, so the margin can be shown for cross-checking. */
  profit: boolean;
}

// S33 — the drill dialog's current target.
export interface CashRegisterDrillTarget {
  drill: CashRegisterDrill;
  titleKey: string;
}

// S35 — one line of the net cash movement card.
export interface CashMovementLine {
  labelKey: string;
  amount: number;
  /** The total line (bold, separated). */
  isTotal?: boolean;
}
