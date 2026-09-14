import { Fragment } from "react";
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
  /** S27 — Σ line totals BEFORE discount; printed above `total` in the money block. */
  subtotal: number;
  /** S27 — the deduction applied to `subtotal`; printed as its own row even when 0. */
  discountAmount: number;
  /** S27 — absent for a walk-in sale. Gates BOTH the credit block and the client-name line. */
  posClientName?: string;
  /** S27 — the cashier, printed in the footer. */
  staffName: string;
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
// S25 — this component renders TWO subtrees: (a) the on-screen card below, unchanged in shape
// since S25, and (b) a print-only 80mm receipt gated by index.css's `.receipt-print-root` rule
// (only visible during a lib/print.ts-driven print). The card is what the cashier sees; the print
// root is the printed artefact — they are not the same markup.
//
// S27 — the print subtree was rebuilt into nine sections (print logo, store block, separator,
// items table with real column headers and per-line wrapping, item summary, money block,
// credit block, client name, footer). The on-screen card was deliberately left untouched — this
// set's structure list is "The POS receipt" print output, not the screen view. No barcode on
// either (brief decision, unchanged).
export function PosReceiptView({
  total,
  previousCredit,
  grandTotal,
  paid,
  newCredit,
  reference,
  lines,
  issuedAt,
  subtotal,
  discountAmount,
  posClientName,
  staffName,
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

  // Print-only row helper — plain flex, no card typography classes (the print root sets its own
  // font/weight/colour in index.css).
  const printRow = (label: string, value: number, bold = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: bold ? 700 : undefined,
      }}
    >
      <span>{label}</span>
      <span>{formatDZD(value, language)}</span>
    </div>
  );

  const printRule = <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />;

  const articleCount = lines.length;
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

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
        {/* 1. Print logo — the dedicated monochrome logo (S26.1); falls back to the full-colour
            store logo so the header is never empty for a store that hasn't uploaded one yet
            (owner decision D3). A remote R2 URL may not finish loading before the print dialog
            paints — the store name below is always text, so the header is never empty either
            way. */}
        {(store?.printLogoUrl ?? store?.logoUrl) && (
          <img
            src={store?.printLogoUrl ?? store?.logoUrl}
            alt=""
            style={{ maxWidth: "40mm", margin: "0 auto", display: "block" }}
          />
        )}

        {/* 2. Store block: name, activity line, address, then the two labelled phone numbers.
            Each phone falls back to the general `store.phone` when its own field is unset
            (S26.1 Q2) — if neither repairPhone nor salesPhone is set, both labels print the same
            number, which is a deliberate, self-explanatory prompt to fill them in. */}
        {store?.name && <div style={{ textAlign: "center", fontWeight: 700 }}>{store.name}</div>}
        {store?.activityLine && <div style={{ textAlign: "center" }}>{store.activityLine}</div>}
        {store?.address && <div style={{ textAlign: "center" }}>{store.address}</div>}
        {(store?.repairPhone ?? store?.phone) && (
          <div style={{ textAlign: "center" }}>
            {t("staff.pos.receipt.repairPhone")}: {store?.repairPhone ?? store?.phone}
          </div>
        )}
        {(store?.salesPhone ?? store?.phone) && (
          <div style={{ textAlign: "center" }}>
            {t("staff.pos.receipt.salesPhone")}: {store?.salesPhone ?? store?.phone}
          </div>
        )}

        {/* 3. Separator */}
        {printRule}

        {/* 4. Items table — the set's headline fix. A real <table> so the label cell can wrap
            onto as many lines as it needs while quantity/unit price/total stay right-aligned on
            the row's FIRST line: `vertical-align: top` on the figure cells plus
            `overflow-wrap: anywhere` on the label cell is what a flex row cannot do. */}
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontWeight: 700 }}>
                {t("staff.pos.receipt.colItem")}
              </th>
              <th style={{ width: "8mm", textAlign: "right", fontWeight: 700 }}>
                {t("staff.pos.receipt.colQty")}
              </th>
              <th style={{ width: "18mm", textAlign: "right", fontWeight: 700 }}>
                {t("staff.pos.receipt.colUnitPrice")}
              </th>
              <th style={{ width: "18mm", textAlign: "right", fontWeight: 700 }}>
                {t("staff.pos.receipt.colLineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <Fragment key={index}>
                <tr>
                  <td
                    style={{
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      whiteSpace: "normal",
                    }}
                  >
                    {line.productName}
                  </td>
                  <td style={{ textAlign: "right", verticalAlign: "top" }}>{line.quantity}</td>
                  <td style={{ textAlign: "right", verticalAlign: "top" }}>
                    {formatDZD(line.unitPrice, language)}
                  </td>
                  <td style={{ textAlign: "right", verticalAlign: "top" }}>
                    {formatDZD(line.lineTotal, language)}
                  </td>
                </tr>
                {line.serialNumbers && line.serialNumbers.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ paddingLeft: "8px", fontSize: "10px" }}>
                      {t("staff.pos.receipt.serials")}: {line.serialNumbers.join(", ")}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {printRule}

        {/* 5. Item summary */}
        <div>{t("staff.pos.receipt.articleCount", { count: articleCount })}</div>
        <div>{t("staff.pos.receipt.totalQuantity", { count: totalQuantity })}</div>

        {printRule}

        {/* 6. Money block — always all three rows, even while discount is 0 (owner decision D1;
            the credit block below is the one that is conditionally hidden entirely). */}
        {printRow(t("staff.pos.receipt.subtotal"), subtotal)}
        {printRow(t("staff.pos.receipt.discount"), discountAmount)}
        {printRow(t("staff.pos.receipt.amountPayable"), total, true)}

        {/* 7. Credit block — only when a POS client is attached; a walk-in sale renders nothing
            here, not zeroes (owner decision D2: posClientName is the single gate for this AND
            the client-name line below). */}
        {posClientName != null && (
          <>
            {printRule}
            {printRow(t("staff.pos.receipt.previousCredit"), previousCredit)}
            {printRow(t("staff.pos.receipt.purchaseTotal"), total)}
            {printRow(t("staff.pos.receipt.paid"), paid)}
            {printRow(t("staff.pos.receipt.newCredit"), newCredit)}
          </>
        )}

        {/* 8. Client name */}
        {posClientName != null && (
          <div>
            {t("staff.pos.receipt.client")}: {posClientName}
          </div>
        )}

        {printRule}

        {/* 9. Footer — reference, date/time, cashier. No barcode. */}
        <div>
          {t("staff.pos.receipt.reference")}: {reference}
        </div>
        <div>{formatDateTime(issuedAt, language)}</div>
        <div>
          {t("staff.pos.receipt.cashier")}: {staffName}
        </div>

        <div style={{ textAlign: "center", paddingBottom: "6mm", marginTop: "4px" }}>
          {t("staff.pos.receipt.thankYou")}
        </div>
      </div>
    </>
  );
}
