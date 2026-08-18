import { Printer, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { RECEIPT_ROOT_CLASS } from "@/lib/print";
import type { ReceiptDto, PublicSettingsDto } from "@dragon-telecom/contract";

interface PosReceiptViewProps {
  total: number;
  previousCredit: number;
  grandTotal: number;
  paid: number;
  newCredit: number;
  /** S25 — the printed receipt's line table, reference and timestamp; the on-screen card and the
   *  five money rows are unaffected. */
  reference: string;
  lines: ReceiptDto["lines"];
  issuedAt: string;
  /** Optional — the settings query backing this may still be in flight. */
  store?: PublicSettingsDto["store"];
  onPrint: () => void;
  /** Returns to a fresh, empty ticket (S6/I2) — the receipt view's own draft has already become
   *  the completed sale, so this never deletes anything, unlike the ticket's Clear button. */
  onNewSale: () => void;
}

// Dumb, props-only (Sprint 4) — Sprint 7 renders this from the useConfirmSale() result
// (STF-02 §Interactions: "receipt view (total · previous credit · grand total · paid · new
// credit) with print"). Not built on CreditMovementPreview (the receipt is a fixed 5-row
// layout, not a 2-value prev→new preview). S6/I2 adds a "New sale" action beside Print.
//
// S25 — this component now renders TWO subtrees: (a) the on-screen card below, unchanged in
// shape aside from the new lines list, and (b) a print-only 80mm receipt gated by
// index.css's `.receipt-print-root` rule (only visible during a lib/print.ts-driven print).
// The card is what the cashier sees; the print root is the printed artefact — they are not the
// same markup. No barcode of the sale reference on either (brief decision).
export function PosReceiptView({
  total,
  previousCredit,
  grandTotal,
  paid,
  newCredit,
  reference,
  lines,
  issuedAt,
  store,
  onPrint,
  onNewSale,
}: PosReceiptViewProps) {
  const { t, language } = useTranslation();

  const row = (label: string, value: number, emphasis = false) => (
    <div
      className={`flex items-center justify-between ${emphasis ? "text-lg font-bold" : "text-sm"}`}
    >
      <span className={emphasis ? "" : "text-muted-foreground"}>{label}</span>
      <span className={emphasis ? "" : "font-medium"}>{formatDZD(value, language)}</span>
    </div>
  );

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold">{t("staff.pos.receipt.title")}</h3>

        {lines.length > 0 && (
          <ul className="space-y-1 text-sm">
            {lines.map((line, index) => (
              <li key={index} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{line.productName}</span>
                  {line.serialNumbers && line.serialNumbers.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {line.serialNumbers.join(", ")}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  ×{line.quantity} {formatDZD(line.unitPrice, language)}
                </span>
                <span className="font-medium">{formatDZD(line.lineTotal, language)}</span>
              </li>
            ))}
          </ul>
        )}

        {row(t("staff.pos.ticket.total"), total)}
        {row(t("staff.pos.receipt.previousCredit"), previousCredit)}
        <Separator />
        {row(t("staff.pos.receipt.grandTotal"), grandTotal, true)}
        {row(t("staff.pos.receipt.paid"), paid)}
        {row(t("staff.pos.receipt.newCredit"), newCredit)}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t("staff.pos.receipt.print")}
          </Button>
          <Button className="flex-1" onClick={onNewSale}>
            <Plus className="mr-2 h-4 w-4" />
            {t("staff.pos.receipt.newSale")}
          </Button>
        </div>
      </div>

      <div className={RECEIPT_ROOT_CLASS}>
        {store?.logoUrl && (
          // A remote R2 URL may not finish loading before the print dialog paints — the store
          // name below is always text, so the header is never empty even if this doesn't render.
          <img src={store.logoUrl} alt="" style={{ maxWidth: "40mm", margin: "0 auto" }} />
        )}
        {store?.name && <div style={{ textAlign: "center", fontWeight: "bold" }}>{store.name}</div>}
        {store?.address && <div style={{ textAlign: "center" }}>{store.address}</div>}
        {store?.phone && <div style={{ textAlign: "center" }}>{store.phone}</div>}

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        <div>
          {t("staff.pos.receipt.reference")}: {reference}
        </div>
        <div>{formatDateTime(issuedAt, language)}</div>

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        {lines.map((line, index) => (
          <div key={index} style={{ marginBottom: "2px" }}>
            <div>{line.productName}</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {line.quantity} × {formatDZD(line.unitPrice, language)}
              </span>
              <span>{formatDZD(line.lineTotal, language)}</span>
            </div>
            {line.serialNumbers && line.serialNumbers.length > 0 && (
              <div style={{ paddingLeft: "8px", fontSize: "10px" }}>
                {t("staff.pos.receipt.serials")}: {line.serialNumbers.join(", ")}
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.pos.ticket.total")}</span>
          <span>{formatDZD(total, language)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.pos.receipt.previousCredit")}</span>
          <span>{formatDZD(previousCredit, language)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>{t("staff.pos.receipt.grandTotal")}</span>
          <span>{formatDZD(grandTotal, language)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.pos.receipt.paid")}</span>
          <span>{formatDZD(paid, language)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("staff.pos.receipt.newCredit")}</span>
          <span>{formatDZD(newCredit, language)}</span>
        </div>

        <div style={{ textAlign: "center", paddingBottom: "6mm", marginTop: "4px" }}>
          {t("staff.pos.receipt.thankYou")}
        </div>
      </div>
    </>
  );
}
