import { ReportedIssue, type RepairDto } from "@dragon-telecom/contract";
import { REPORTED_ISSUE_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";
import { formatRepairDeviceLabel } from "@/pages/staff/repairs/repair-device-label";

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
// The barcode itself carries `repair.reference`, and `renderBarcodeSvg` is configured with
// `displayValue: true`, so the reference prints readable inside the symbol. Deliberately NOT
// repeated as a text line — that would waste ~2.4 mm of a 23 mm budget on a duplicate.
export function buildRepairLabelLines(repair: RepairDto, t: (key: string) => string): string[] {
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
  ].filter((line) => line.trim() !== "");
}
