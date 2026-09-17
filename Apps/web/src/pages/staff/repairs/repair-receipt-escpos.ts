import { ReportedIssue, type PublicSettingsDto, type RepairDto } from "@dragon-telecom/contract";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { finishReceipt, startReceipt, twoColumns, wrap } from "@/lib/escpos";
import type { Language } from "@/lib/i18n";
import {
  REPAIR_STATUS_LABEL_KEY,
  REPORTED_ISSUE_LABEL_KEY,
} from "@/pages/staff/repairs/repair-status-labels";
import { formatRepairDeviceLabel } from "@/pages/staff/repairs/repair-device-label";

// S27.1 — the ESC/POS rendering of the repair receipt.
//
// This is a SECOND RENDERER of the artefact RepairReceipt.tsx already draws in HTML, and the two
// must be kept in step — same standing cost the codebase already accepts for
// barcode-label.tsx <-> barcode-label-sheet.tsx. It is not a translation of the DOM: ESC/POS has
// no layout engine, so the HTML's flex rows become a fixed 48-column character grid
// (lib/escpos.ts's `twoColumns`), and its dashed rules become a row of hyphens.
//
// Section order deliberately mirrors RepairReceipt.tsx exactly: store block, rule, title,
// reference/intake/status, rule, customer, device/IMEI, issues, diagnosis, technician, parts,
// labour, rule, totals, paid-status stamp, invoice number, footer.
//
// HARD RULE, inherited from RepairReceipt.tsx: no `scope` parameter and NO money-cost field.
// repairs.mapper.ts genuinely populates `totalCost`, `totalProfit` and each part's `costOfGoods`
// and `profit` for an ADMIN, and this receipt goes to the customer. Scope-independence by
// construction makes the leak impossible rather than merely discouraged — do not add a scope
// argument here.
//
// NO LOGO (owner decision D6): ESC/POS raster printing would need the R2-hosted printLogoUrl
// fetched, canvased, thresholded and bit-packed — and `getImageData` throws on a cross-origin
// image unless the bucket sends CORS headers, which cannot be verified from this repo. The store
// name prints bold and double-height instead. The browser fallback still prints the real logo.
export function buildRepairReceiptEscPos(args: {
  repair: RepairDto;
  store?: PublicSettingsDto["store"];
  t: (key: string) => string;
  language: Language;
}): Uint8Array {
  const { repair, store, t, language } = args;
  const money = (value: number): string => formatDZD(value, language);

  const b = startReceipt();

  // --- Store block (name stands in for the logo) ---
  b.align("center");
  if (store?.name) {
    b.bold(true).size("doubleHeight").line(store.name).size("normal").bold(false);
  }
  if (store?.activityLine) for (const l of wrap(store.activityLine)) b.line(l);
  if (store?.address) for (const l of wrap(store.address)) b.line(l);
  if (store?.phone) b.line(store.phone);
  b.align("left").divider();

  // --- Title ---
  b.align("center").bold(true).line(t("staff.repairs.receipt.title")).bold(false).align("left");

  b.line(`${t("staff.repairs.receipt.reference")}: ${repair.reference}`);
  b.line(`${t("staff.repairs.receipt.intakeAt")}: ${formatDateTime(repair.intakeAt, language)}`);
  b.line(`${t("staff.repairs.receipt.status")}: ${t(REPAIR_STATUS_LABEL_KEY[repair.status])}`);
  b.divider();

  // --- Customer / device / issues ---
  b.line(t("staff.repairs.receipt.customer"));
  b.line(repair.customerName);
  b.line(repair.customerPhone);

  const deviceLabel = formatRepairDeviceLabel(repair.device);
  if (deviceLabel) {
    b.line(`${t("staff.repairs.receipt.device")}: ${deviceLabel}`);
    if (repair.device.imei) b.line(`${t("staff.repairs.receipt.imei")}: ${repair.device.imei}`);
  }

  if (repair.reportedIssues.length > 0) {
    const issues =
      repair.reportedIssues.map((issue) => t(REPORTED_ISSUE_LABEL_KEY[issue])).join(" - ") +
      (repair.reportedIssues.includes(ReportedIssue.OTHER) && repair.reportedIssueOther
        ? ` (${repair.reportedIssueOther})`
        : "");
    for (const l of wrap(`${t("staff.repairs.receipt.issues")}: ${issues}`)) b.line(l);
  }

  if (repair.diagnosis) {
    for (const l of wrap(`${t("staff.repairs.receipt.diagnosis")}: ${repair.diagnosis}`)) b.line(l);
  }
  if (repair.technician) {
    b.line(`${t("staff.repairs.receipt.technician")}: ${repair.technician.name}`);
  }

  // --- Parts ---
  if (repair.parts.length > 0) {
    b.divider();
    b.bold(true).line(t("staff.repairs.receipt.parts")).bold(false);
    for (const part of repair.parts) {
      for (const l of wrap(part.productName)) b.line(l);
      b.line(twoColumns(`  ${part.quantity} x ${money(part.unitPrice)}`, money(part.lineTotal)));
      if (part.serialNumbers) {
        for (const l of wrap(`  ${t("staff.repairs.receipt.serials")}: ${part.serialNumbers}`)) {
          b.line(l);
        }
      }
    }
  }

  if (repair.labourPrice > 0) {
    b.line(twoColumns(t("staff.repairs.receipt.labour"), money(repair.labourPrice)));
  }

  b.divider();

  // --- Totals ---
  if (repair.parts.length > 0) {
    b.line(twoColumns(t("staff.repairs.receipt.partsTotal"), money(repair.partsTotal)));
  }
  b.bold(true).line(twoColumns(t("staff.repairs.receipt.total"), money(repair.totalAmount)));
  b.bold(false);
  b.line(twoColumns(t("staff.repairs.receipt.paid"), money(repair.paidAmount)));

  const amountDue = repair.totalAmount - repair.paidAmount;
  if (amountDue > 0) {
    b.line(twoColumns(t("staff.repairs.receipt.due"), money(amountDue)));
  }

  // --- Paid-status stamp. A fresh INTAKE ticket has total=0 and paid=0; stamping that "PAID"
  //     would be wrong, so it stays UNPAID until there is something to pay (same rule as the
  //     HTML receipt). The HTML draws a 1px box; ESC/POS has no box, so it is centred + bold. ---
  const paidStatusKey =
    repair.paidAmount >= repair.totalAmount && repair.totalAmount > 0
      ? "staff.repairs.receipt.statusPaid"
      : repair.paidAmount > 0
        ? "staff.repairs.receipt.statusPartial"
        : "staff.repairs.receipt.statusUnpaid";
  b.line();
  b.align("center").bold(true).line(t(paidStatusKey)).bold(false).align("left");

  if (repair.invoiceNumber) {
    b.line(`${t("staff.repairs.receipt.invoiceNumber")}: ${repair.invoiceNumber}`);
  }

  b.line();
  b.align("center").line(t("staff.repairs.receipt.footer")).align("left");

  return finishReceipt(b);
}
