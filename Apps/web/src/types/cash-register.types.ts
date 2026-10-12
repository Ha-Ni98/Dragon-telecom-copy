import type { CashRegisterDrill } from "@dragon-telecom/contract";

// S33 — one figure on the Caisse page; clickable when it has a drill-through target.
export interface CashRegisterFigure {
  labelKey: string;
  /** Already formatted (money or count). */
  value: string;
  /** Absent = not clickable. */
  drill?: CashRegisterDrill;
}

// S33 — which optional columns a drill-through list shows.
export interface CashRegisterDrillColumns {
  paid: boolean;
  sourceReference: boolean;
}

// S33 — the drill dialog's current target.
export interface CashRegisterDrillTarget {
  drill: CashRegisterDrill;
  titleKey: string;
}
