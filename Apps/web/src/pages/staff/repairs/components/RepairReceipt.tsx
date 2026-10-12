import { ReportedIssue, type RepairDto, type PublicSettingsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { RECEIPT_ROOT_CLASS } from "@/lib/print";
import {
  REPAIR_STATUS_LABEL_KEY,
  REPORTED_ISSUE_LABEL_KEY,
} from "@/pages/staff/repairs/repair-status-labels";
import { formatRepairDeviceLabel } from "@/pages/staff/repairs/repair-device-label";

interface RepairReceiptProps {
  repair: RepairDto;
  /** Optional — the settings query backing this may still be in flight. */
  store?: PublicSettingsDto["store"];
}

// S25 — print-only, mirrors PosReceiptView's print subtree. No on-screen markup of its own: the
// repair detail sheet already shows all of this; this component exists only to be printed.
//
// S30/Q3 — the receipt never prices the breakdown, at any stage: no per-part price, no labour
// line, no parts total. It prints one Total plus the settlement (Paid, Amount due, the
// PAID/UNPAID stamp) and, on a cancelled or returned ticket, what was Refunded. While nothing is
// priced (total 0) no money figure prints at all — not even a zero — except Paid when something
// was prepaid. Owner request (2026-10-12, after S31): the parts used ARE listed again, by name
// only (with "x N" when more than one was fitted) — never with a price.
//
// Hard rule — NEVER print margins. repairs.mapper.ts gates `totalProfit` and per-part
// `costOfGoods`/`profit` behind `includeMargins`, so an ADMIN viewing the sheet genuinely
// receives them on `repair`. This receipt is handed to the customer and must render none of
// totalCost/totalProfit/part.costOfGoods/part.profit, in either scope. There is deliberately no
// `scope` prop here to branch on — the receipt is scope-independent by design, which makes the
// leak impossible rather than merely discouraged.
export function RepairReceipt({ repair, store }: RepairReceiptProps) {
  const { t, language } = useTranslation();

  // S29 — the stored free-text label now wins over brand+model (formatRepairDeviceLabel); a
  // technician-edited label must never be overruled by a derived brand/model string.
  const deviceLabel = formatRepairDeviceLabel(repair.device);

  const amountDue = repair.totalAmount - repair.paidAmount;
  // S30/Q3 — an unpriced ticket prints no money figure at all (and therefore no stamp either).
  const priced = repair.totalAmount > 0;
  const paidStatus =
    repair.paidAmount >= repair.totalAmount && repair.totalAmount > 0
      ? "paid"
      : repair.paidAmount > 0
        ? "partial"
        : "unpaid";
  const paidStatusKey =
    paidStatus === "paid"
      ? "staff.repairs.receipt.statusPaid"
      : paidStatus === "partial"
        ? "staff.repairs.receipt.statusPartial"
        : "staff.repairs.receipt.statusUnpaid";

  return (
    <div className={RECEIPT_ROOT_CLASS}>
      {/* S27 — logo swap only (owner decision D4): the print logo (S26.1) replaces the colour
          store logo here, since this prints to the same thermal head as the POS receipt. Nothing
          else about this receipt was restructured — the set's structure list is "The POS
          receipt"; this still prints only the single general `store.phone`, no activity line. */}
      {(store?.printLogoUrl ?? store?.logoUrl) && (
        <img
          src={store?.printLogoUrl ?? store?.logoUrl}
          alt=""
          style={{ maxWidth: "40mm", margin: "0 auto" }}
        />
      )}
      {store?.name && <div style={{ textAlign: "center", fontWeight: "bold" }}>{store.name}</div>}
      {store?.address && <div style={{ textAlign: "center" }}>{store.address}</div>}
      {store?.phone && <div style={{ textAlign: "center" }}>{store.phone}</div>}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      <div style={{ textAlign: "center", fontWeight: "bold" }}>
        {t("staff.repairs.receipt.title")}
      </div>

      <div>
        {t("staff.repairs.receipt.reference")}: {repair.reference}
      </div>
      <div>
        {t("staff.repairs.receipt.intakeAt")}: {formatDateTime(repair.intakeAt, language)}
      </div>
      <div>
        {t("staff.repairs.receipt.status")}: {t(REPAIR_STATUS_LABEL_KEY[repair.status])}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      <div>{t("staff.repairs.receipt.customer")}</div>
      <div>{repair.customerName}</div>
      <div>{repair.customerPhone}</div>

      {deviceLabel && (
        <>
          <div>
            {t("staff.repairs.receipt.device")}: {deviceLabel}
          </div>
          {repair.device.imei && (
            <div>
              {t("staff.repairs.receipt.imei")}: {repair.device.imei}
            </div>
          )}
        </>
      )}

      {repair.reportedIssues.length > 0 && (
        <div>
          {t("staff.repairs.receipt.issues")}:{" "}
          {repair.reportedIssues.map((issue) => t(REPORTED_ISSUE_LABEL_KEY[issue])).join(" · ")}
          {repair.reportedIssues.includes(ReportedIssue.OTHER) && repair.reportedIssueOther
            ? ` (${repair.reportedIssueOther})`
            : ""}
        </div>
      )}

      {repair.diagnosis && (
        <div>
          {t("staff.repairs.receipt.diagnosis")}: {repair.diagnosis}
        </div>
      )}
      {repair.technician && (
        <div>
          {t("staff.repairs.receipt.technician")}: {repair.technician.name}
        </div>
      )}

      {/* Parts used — names only, never a price (owner request after S31; S30/Q3 still holds). */}
      {repair.parts.length > 0 && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          <div style={{ fontWeight: "bold" }}>{t("staff.repairs.receipt.parts")}</div>
          {repair.parts.map((part) => (
            <div key={part.id}>
              {part.productName}
              {part.quantity > 1 ? ` x ${part.quantity}` : ""}
            </div>
          ))}
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {priced && (
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>{t("staff.repairs.receipt.total")}</span>
          <span>{formatDZD(repair.totalAmount, language)}</span>
        </div>
      )}
      {(priced || repair.paidAmount > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.paid")}</span>
          <span>{formatDZD(repair.paidAmount, language)}</span>
        </div>
      )}
      {priced && amountDue > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.due")}</span>
          <span>{formatDZD(amountDue, language)}</span>
        </div>
      )}
      {repair.refundedAmount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.refunded")}</span>
          <span>{formatDZD(repair.refundedAmount, language)}</span>
        </div>
      )}
      {priced && (
        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            border: "1px solid #000",
            padding: "2px",
            marginTop: "4px",
          }}
        >
          {t(paidStatusKey)}
        </div>
      )}

      {repair.invoiceNumber && (
        <div>
          {t("staff.repairs.receipt.invoiceNumber")}: {repair.invoiceNumber}
        </div>
      )}

      <div style={{ textAlign: "center", paddingBottom: "6mm", marginTop: "4px" }}>
        {t("staff.repairs.receipt.footer")}
      </div>
    </div>
  );
}
