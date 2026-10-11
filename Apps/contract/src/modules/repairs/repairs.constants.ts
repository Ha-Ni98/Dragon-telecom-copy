import { RepairStatus } from './repairs.enums';

// D8 — the forward machine. INTAKE → PROCESSING → COMPLETED → PICKED_UP, with CANCELLED
// reachable from INTAKE/PROCESSING/COMPLETED (never from PICKED_UP — its invoice is immutable).
// S30 — PICKED_UP → RETURNED is the only way out of a pickup (the return document). Shared by the
// backend guard (repairs.service.ts) and the ticket dialog's status select (S13), so a legal move
// is defined once.
export const REPAIR_STATUS_TRANSITIONS: Readonly<Partial<Record<RepairStatus, readonly RepairStatus[]>>> = {
  [RepairStatus.INTAKE]: [RepairStatus.PROCESSING, RepairStatus.CANCELLED],
  [RepairStatus.PROCESSING]: [RepairStatus.COMPLETED, RepairStatus.CANCELLED],
  [RepairStatus.COMPLETED]: [RepairStatus.PICKED_UP, RepairStatus.CANCELLED],
  [RepairStatus.PICKED_UP]: [RepairStatus.RETURNED],
};

// Nothing leaves these. S30 — PICKED_UP is no longer terminal (it can move to RETURNED), but it
// is still read-only: see REPAIR_READ_ONLY_STATUSES below.
export const REPAIR_TERMINAL_STATUSES: readonly RepairStatus[] = [
  RepairStatus.CANCELLED,
  RepairStatus.RETURNED,
];

// S30 — once a repair reaches one of these, its parts, labour, diagnosis and pre-pickup payments
// are frozen. A picked-up repair's invoice is immutable; reversing it is a return, not an edit.
export const REPAIR_READ_ONLY_STATUSES: readonly RepairStatus[] = [
  RepairStatus.PICKED_UP,
  RepairStatus.CANCELLED,
  RepairStatus.RETURNED,
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

export function isRepairReadOnly(status: RepairStatus): boolean {
  return REPAIR_READ_ONLY_STATUSES.includes(status);
}

// D8 — the single money moment: parts consumed, invoice issued, revenue recognised.
export function repairTransitionRequiresPayment(to: RepairStatus): boolean {
  return to === RepairStatus.PICKED_UP;
}

// S30 — business-rule sentinels the repairs service throws as the error *message* (same shape as
// CATALOG_ERROR); the web client maps each to a translated toast (query-client.ts).
// READ_ONLY keeps the exact string assertEditable already threw before S30.
export const REPAIR_ERROR = {
  READ_ONLY: 'REPAIR_READ_ONLY',
  STATUS_CHANGED: 'REPAIR_STATUS_CHANGED',
  RETURN_REQUIRES_PICKED_UP: 'REPAIR_RETURN_REQUIRES_PICKED_UP',
  RETURN_VIA_RETURN_ACTION: 'REPAIR_RETURN_VIA_RETURN_ACTION',
  UNKNOWN_PART: 'REPAIR_UNKNOWN_PART',
  CONSUMPTION_NOT_FOUND: 'REPAIR_CONSUMPTION_NOT_FOUND',
} as const;
export type RepairErrorSentinel = (typeof REPAIR_ERROR)[keyof typeof REPAIR_ERROR];
