import { ReportedIssue, type RepairDto } from "@dragon-telecom/contract";
import { REPORTED_ISSUE_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";
import { formatRepairDeviceLabel } from "@/pages/staff/repairs/repair-device-label";
import { formatDateTime } from "@/lib/utils";
import type { Language } from "@/lib/i18n";

// S27.1 — the raw-text lines printed on the repair client label, in order. One source of truth
// because three renderers consume it: the on-screen <BarcodeLabel> preview, the printed HTML
// <BarcodeLabelSheet>, and the ZPL builder for the thermal path. If they ever disagreed, the
// label the counter previews would not be the label the bench gets.
//
// Hard rule, inherited from RepairReceipt.tsx: this takes NO `scope` argument and reads NO money
// field. `repair.totalCost` / `totalProfit` and each part's `costOfGoods` / `profit` genuinely ARE
// populated for an ADMIN (repairs.mapper.ts gates them on includeMargins), and this label is stuck
// on a customer's device. Scope-independence by construction makes the leak impossible rather than
// merely discouraged — do not add a scope parameter here.
//
// The label no longer carries a barcode (removed so the sticker only needs to be human-readable
// at the bench, not scanned), so `repair.reference` and the intake date/time are now spelled out
// as plain text lines instead of riding along in the symbol's human-readable line.
export function buildRepairLabelLines(
  repair: RepairDto,
  t: (key: string) => string,
  language: Language,
): string[] {
  const issues =
    repair.reportedIssues.length > 0
      ? repair.reportedIssues.map((issue) => t(REPORTED_ISSUE_LABEL_KEY[issue])).join(" · ") +
        // Same rule RepairReceipt.tsx uses: the free-text detail only appears alongside OTHER.
        (repair.reportedIssues.includes(ReportedIssue.OTHER) && repair.reportedIssueOther
          ? ` (${repair.reportedIssueOther})`
          : "")
      : "";

  return [
    repair.customerName,
    repair.customerPhone,
    // S29's helper: the stored free-text label wins over brand+model, and it returns "" when
    // label, brand and model are all absent — which the filter below drops rather than printing
    // an empty line.
    formatRepairDeviceLabel(repair.device),
    issues,
    repair.reference,
    formatDateTime(repair.intakeAt, language),
  ].filter((line) => line.trim() !== "");
}
