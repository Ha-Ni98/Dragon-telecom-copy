import { RepairStatus, ReportedIssue } from "@dragon-telecom/contract";

// Single source of truth for RepairStatus -> translation key, shared by every component in
// this cluster that renders a status label (RepairBoard's lanes, RepairStatusDialog,
// RepairTicketDetail's timeline, the receipts, TechniciansTab) — was duplicated across files before
// this extraction.
export const REPAIR_STATUS_LABEL_KEY: Record<RepairStatus, string> = {
  [RepairStatus.INTAKE]: "staff.repairs.board.intake",
  [RepairStatus.PROCESSING]: "staff.repairs.board.processing",
  [RepairStatus.COMPLETED]: "staff.repairs.board.completed",
  [RepairStatus.PICKED_UP]: "staff.repairs.board.pickedUp",
  [RepairStatus.CANCELLED]: "staff.repairs.board.cancelled",
  [RepairStatus.RETURNED]: "staff.repairs.board.returned", // S30
};

// S25 — moved out of IntakeDialog.tsx (where it was module-private) so RepairReceipt.tsx can
// render the same translated labels the intake form used to capture the issue. Same single-
// source-of-truth reasoning as REPAIR_STATUS_LABEL_KEY above.
export const REPORTED_ISSUE_LABEL_KEY: Record<ReportedIssue, string> = {
  [ReportedIssue.CHARGING]: "staff.repairs.intake.issue.charging",
  [ReportedIssue.DISPLAY]: "staff.repairs.intake.issue.display",
  [ReportedIssue.BATTERY]: "staff.repairs.intake.issue.battery",
  [ReportedIssue.CAMERA]: "staff.repairs.intake.issue.camera",
  [ReportedIssue.SPEAKER]: "staff.repairs.intake.issue.speaker",
  [ReportedIssue.MICROPHONE]: "staff.repairs.intake.issue.microphone",
  [ReportedIssue.WATER_DAMAGE]: "staff.repairs.intake.issue.waterDamage",
  [ReportedIssue.SOFTWARE]: "staff.repairs.intake.issue.software",
  [ReportedIssue.OTHER]: "staff.repairs.intake.issue.other",
};
