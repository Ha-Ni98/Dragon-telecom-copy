import { RepairStatus } from './repairs.enums';

// D8 — the forward machine. INTAKE → PROCESSING → COMPLETED → PICKED_UP, with CANCELLED
// reachable from every non-terminal state. Shared by the backend guard (repairs.service.ts's
// changeStatus) and the ticket dialog's status select (S13), so a legal move is defined once.
export const REPAIR_STATUS_TRANSITIONS: Readonly<Partial<Record<RepairStatus, readonly RepairStatus[]>>> = {
  [RepairStatus.INTAKE]: [RepairStatus.PROCESSING, RepairStatus.CANCELLED],
  [RepairStatus.PROCESSING]: [RepairStatus.COMPLETED, RepairStatus.CANCELLED],
  [RepairStatus.COMPLETED]: [RepairStatus.PICKED_UP, RepairStatus.CANCELLED],
};

// Nothing leaves these. PICKED_UP is terminal because its invoice is immutable — reversing a
// pickup needs a return document, not a cancel (D8/D9).
export const REPAIR_TERMINAL_STATUSES: readonly RepairStatus[] = [
  RepairStatus.PICKED_UP,
  RepairStatus.CANCELLED,
];

export function repairTransitionsFrom(from: RepairStatus): readonly RepairStatus[] {
  return REPAIR_STATUS_TRANSITIONS[from] ?? [];
}

export function isRepairTransitionAllowed(from: RepairStatus, to: RepairStatus): boolean {
  return repairTransitionsFrom(from).includes(to);
}

export function isRepairStatusTerminal(status: RepairStatus): boolean {
  return REPAIR_TERMINAL_STATUSES.includes(status);
}

// D8 — the single money moment: parts consumed, invoice issued, revenue recognised.
export function repairTransitionRequiresPayment(to: RepairStatus): boolean {
  return to === RepairStatus.PICKED_UP;
}
