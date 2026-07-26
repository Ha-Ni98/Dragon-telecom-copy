import { RepairStatus } from "@dragon-telecom/contract";

// Single source of truth for RepairStatus -> translation key, shared by every component in
// this cluster that renders a status label (RepairBoard's lanes, RepairStatusDialog,
// RepairTicketDetail's timeline) — was duplicated across files before this extraction.
export const REPAIR_STATUS_LABEL_KEY: Record<RepairStatus, string> = {
  [RepairStatus.INTAKE]: "staff.repairs.board.intake",
  [RepairStatus.PROCESSING]: "staff.repairs.board.processing",
  [RepairStatus.COMPLETED]: "staff.repairs.board.completed",
  [RepairStatus.PICKED_UP]: "staff.repairs.board.pickedUp",
  [RepairStatus.CANCELLED]: "staff.repairs.board.cancelled",
};
