import { ReportedIssue, type RepairDto, type PublicSettingsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { RECEIPT_ROOT_CLASS } from "@/lib/print";
import {
  REPAIR_STATUS_LABEL_KEY,
  REPORTED_ISSUE_LABEL_KEY,
} from "@/pages/staff/repairs/repair-status-labels";

interface RepairReceiptProps {
  repair: RepairDto;
  /** Optional — the settings query backing this may still be in flight. */
  store?: PublicSettingsDto["store"];
}

// S25 — print-only, mirrors PosReceiptView's print subtree. No on-screen markup of its own: the
// repair detail sheet already shows all of this; this component exists only to be printed.
//
// Hard rule — NEVER print margins. repairs.mapper.ts gates `totalProfit` and per-part
// `costOfGoods`/`profit` behind `includeMargins`, so an ADMIN viewing the sheet genuinely
// receives them on `repair`. This receipt is handed to the customer and must render none of
// totalCost/totalProfit/part.costOfGoods/part.profit, in either scope. There is deliberately no
// `scope` prop here to branch on — the receipt is scope-independent by design, which makes the
// leak impossible rather than merely discouraged.
export function RepairReceipt({ repair, store }: RepairReceiptProps) {
  const { t, language } = useTranslation();

  const deviceLabel =
    [repair.device.brand?.name, repair.device.model?.name].filter(Boolean).join(" ") ||
    repair.device.label;

  const amountDue = repair.totalAmount - repair.paidAmount;
  // A fresh INTAKE ticket has total=0 and paid=0 — stamping that "PAID" would be wrong, it is
  // UNPAID until there is something to pay.
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

      {repair.parts.length > 0 && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          <div style={{ fontWeight: "bold" }}>{t("staff.repairs.receipt.parts")}</div>
          {repair.parts.map((part) => (
            <div key={part.id} style={{ marginBottom: "2px" }}>
              <div>{part.productName}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  {part.quantity} × {formatDZD(part.unitPrice, language)}
                </span>
                <span>{formatDZD(part.lineTotal, language)}</span>
              </div>
              {part.serialNumbers && (
                <div style={{ paddingLeft: "8px", fontSize: "10px" }}>
                  {t("staff.repairs.receipt.serials")}: {part.serialNumbers}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {repair.labourPrice > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.labour")}</span>
          <span>{formatDZD(repair.labourPrice, language)}</span>
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {repair.parts.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.partsTotal")}</span>
          <span>{formatDZD(repair.partsTotal, language)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
        <span>{t("staff.repairs.receipt.total")}</span>
        <span>{formatDZD(repair.totalAmount, language)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("staff.repairs.receipt.paid")}</span>
        <span>{formatDZD(repair.paidAmount, language)}</span>
      </div>
      {amountDue > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.repairs.receipt.due")}</span>
          <span>{formatDZD(amountDue, language)}</span>
        </div>
      )}
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
