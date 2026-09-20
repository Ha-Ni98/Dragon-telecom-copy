import { Fragment } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { RECEIPT_ROOT_CLASS } from "@/lib/print";
import type { ReceiptDto, PublicSettingsDto } from "@dragon-telecom/contract";

/** Everything a printed 80mm sale receipt needs — the customer-facing subset of a sale. Named
 *  after the contract's ReceiptDto because that is exactly what it is: the POS passes the DTO the
 *  confirm call returned, and the sales drawer maps an existing SaleDto into the same shape. */
export interface PosReceiptPrintableProps {
  reference: string;
  lines: ReceiptDto["lines"];
  issuedAt: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  previousCredit: number;
  grandTotal: number;
  paid: number;
  newCredit: number;
  /** Absent for a walk-in sale. Gates BOTH the credit block and the client-name line. */
  posClientName?: string;
  staffName: string;
  /** Optional — the settings query backing this may still be in flight. */
  store?: PublicSettingsDto["store"];
}

// The printed 80mm receipt, extracted from PosReceiptView so it is not welded to the POS screen.
//
// It was previously the second subtree of that component, which meant the only way to
// browser-print a POS-style receipt was to be on the POS. The sales drawer's Reprint therefore
// called window.print() and printed the whole page instead. Both now render THIS, so there is one
// printed receipt layout rather than two that can drift — the same reason lib/escpos.ts's thermal
// renderer is shared rather than copied.
//
// Rendered permanently but invisibly: index.css only reveals `.receipt-print-root` during a
// lib/print.ts-driven print, so mounting it costs nothing on screen.
export function PosReceiptPrintable({
  reference,
  lines,
  issuedAt,
  subtotal,
  discountAmount,
  total,
  previousCredit,
  grandTotal,
  paid,
  newCredit,
  posClientName,
  staffName,
  store,
}: PosReceiptPrintableProps) {
  const { t, language } = useTranslation();

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
            <th style={{ textAlign: "left", fontWeight: 700 }}>{t("staff.pos.receipt.colItem")}</th>
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
  );
}
