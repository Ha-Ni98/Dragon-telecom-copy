import type { PublicSettingsDto, ReceiptDto } from "@dragon-telecom/contract";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { ESCPOS_COLUMNS, finishReceipt, startReceipt, twoColumns, wrap } from "@/lib/escpos";
import type { Language } from "@/lib/i18n";

// S27.1 — the ESC/POS rendering of the POS receipt.
//
// A SECOND RENDERER of what PosReceiptView.tsx's print subtree draws in HTML; the two must be
// kept in step (same standing cost the codebase accepts for barcode-label.tsx <->
// barcode-label-sheet.tsx and for the repair receipt).
//
// The HTML uses a real <table> whose product-name cell wraps while the three figure cells stay on
// the row's first line. ESC/POS has no table, so that becomes: the product name wrapped across
// full-width lines, then ONE indented line carrying "qty x unit" on the left and the line total
// flush right. Same information, same reading order, expressed in a 48-column grid.
//
// Section order mirrors PosReceiptView.tsx's nine documented sections exactly: logo/store block,
// rule, items table, item summary, money block, credit block, client name, footer. NO BARCODE —
// that is a standing decision on this receipt, restated here so it is not "helpfully" added.
//
// NO LOGO (owner decision D6) — see repair-receipt-escpos.ts for the full reasoning. The store
// name prints bold and double-height instead; the browser fallback still prints the real logo.
export function buildPosReceiptEscPos(args: {
  receipt: ReceiptDto;
  issuedAt: string;
  store?: PublicSettingsDto["store"];
  t: (key: string, vars?: Record<string, string | number>) => string;
  language: Language;
}): Uint8Array {
  const { receipt, issuedAt, store, t, language } = args;
  const money = (value: number): string => formatDZD(value, language);

  const b = startReceipt();

  // --- 1/2. Store block. The two labelled numbers each fall back to the general phone, exactly
  //          as the HTML receipt does (S26.1 owner decision Q2). ---
  b.align("center");
  if (store?.name) {
    b.bold(true).size("doubleHeight").line(store.name).size("normal").bold(false);
  }
  if (store?.activityLine) for (const l of wrap(store.activityLine)) b.line(l);
  if (store?.address) for (const l of wrap(store.address)) b.line(l);
  const repairPhone = store?.repairPhone ?? store?.phone;
  const salesPhone = store?.salesPhone ?? store?.phone;
  if (repairPhone) b.line(`${t("staff.pos.receipt.repairPhone")}: ${repairPhone}`);
  if (salesPhone) b.line(`${t("staff.pos.receipt.salesPhone")}: ${salesPhone}`);
  b.align("left");

  // --- 3. Separator ---
  b.divider();

  // --- 4. Items. Column headers first, then one block per line. ---
  b.line(
    twoColumns(
      t("staff.pos.receipt.colItem"),
      `${t("staff.pos.receipt.colQty").padStart(3)} ${t("staff.pos.receipt.colUnitPrice").padStart(10)} ${t("staff.pos.receipt.colLineTotal").padStart(11)}`,
    ),
  );
  for (const line of receipt.lines) {
    for (const l of wrap(line.productName)) b.line(l);
    b.line(twoColumns(`  ${line.quantity} x ${money(line.unitPrice)}`, money(line.lineTotal)));
    if (line.serialNumbers && line.serialNumbers.length > 0) {
      for (const l of wrap(
        `  ${t("staff.pos.receipt.serials")}: ${line.serialNumbers.join(", ")}`,
      )) {
        b.line(l);
      }
    }
  }

  b.divider();

  // --- 5. Item summary ---
  const totalQuantity = receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
  b.line(t("staff.pos.receipt.articleCount", { count: receipt.lines.length }));
  b.line(t("staff.pos.receipt.totalQuantity", { count: totalQuantity }));

  b.divider();

  // --- 6. Money block — always all three rows, even at a zero discount (owner decision D1 of
  //        S27; the credit block below is the one that hides entirely). ---
  b.line(twoColumns(t("staff.pos.receipt.subtotal"), money(receipt.subtotal)));
  b.line(twoColumns(t("staff.pos.receipt.discount"), money(receipt.discountAmount)));
  b.bold(true).line(twoColumns(t("staff.pos.receipt.amountPayable"), money(receipt.total)));
  b.bold(false);

  // --- 7/8. Credit block and client name, both gated on an attached POS client. A walk-in sale
  //          prints neither — not zeroes (S27 owner decision D2). ---
  if (receipt.posClientName != null) {
    b.divider();
    b.line(twoColumns(t("staff.pos.receipt.previousCredit"), money(receipt.previousCredit)));
    b.line(twoColumns(t("staff.pos.receipt.purchaseTotal"), money(receipt.total)));
    b.line(twoColumns(t("staff.pos.receipt.paid"), money(receipt.totalPaid)));
    b.line(twoColumns(t("staff.pos.receipt.newCredit"), money(receipt.newCredit)));
    b.line(`${t("staff.pos.receipt.client")}: ${receipt.posClientName}`);
  }

  b.divider();

  // --- 9. Footer: reference, timestamp, cashier. No barcode. ---
  b.line(`${t("staff.pos.receipt.reference")}: ${receipt.reference}`);
  b.line(formatDateTime(issuedAt, language));
  b.line(`${t("staff.pos.receipt.cashier")}: ${receipt.staffName}`);

  b.line();
  b.align("center").line(t("staff.pos.receipt.thankYou").slice(0, ESCPOS_COLUMNS)).align("left");

  return finishReceipt(b);
}
