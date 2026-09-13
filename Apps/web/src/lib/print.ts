// S25/S27 — printing thermal artefacts via the browser's own print dialog, never a PDF. Three
// callers across two page sizes: the POS receipt (PosReceiptView) and the repair receipt
// (RepairReceipt) both print at 80mm and mark their root with RECEIPT_ROOT_CLASS; the barcode
// label sheet (BarcodeLabelSheet, S27) prints at a size chosen per run and marks its root with
// LABEL_ROOT_CLASS.
//
// `@page` is a document-level at-rule: it cannot be scoped by a class or an :is()/:has() selector.
// So the page size is injected as a <style> element for the duration of one print and removed
// afterwards, and everything that CAN be selector-scoped is gated on a body class in index.css.
// Without this, Ctrl+P anywhere in the app — and the /staff/sales Reprint and /staff/invoices
// Print buttons, which still print a whole A4 page on purpose (S25 owner decision) — would come
// out at the wrong size. Same scoping lesson as S22 finding F1 (an ungated label print rule broke
// every other print in the app); the label print rule this file drives is gated exactly the same
// way the receipt one always has been.
//
// A class, not an id, for each root, because more than one component may declare one. They live
// on different routes and are never mounted at the same time; if that ever changes, both would
// print and the fix is to pass the wanted root in rather than to widen this.
export const RECEIPT_ROOT_CLASS = "receipt-print-root";
export const LABEL_ROOT_CLASS = "label-print-root";

const STYLE_ID = "scoped-page-style";
const RECEIPT_BODY_CLASS = "printing-receipt";
const LABEL_BODY_CLASS = "printing-labels";

function teardown(): void {
  document.getElementById(STYLE_ID)?.remove();
  document.body.classList.remove(RECEIPT_BODY_CLASS, LABEL_BODY_CLASS);
}

// Shared engine. `pageCss` is a full @page rule; `bodyClass` gates the selector-scoped half in
// index.css. The sequence below is S25's proven one and must not be reordered:
//  - teardown first, so a double-clicked Print button cannot stack two styles;
//  - afterprint teardown + a 60s safety net, because afterprint is not fired by every
//    browser/driver combination, and leaving the class on would make the app's own screen render
//    wrong on the next Ctrl+P;
//  - NO synchronous teardown after window.print() — that call is not reliably blocking across
//    browsers, and tearing down early yields a blank or wrongly-sized page.
function printScoped(pageCss: string, bodyClass: string): void {
  teardown();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = pageCss;
  document.head.appendChild(style);
  document.body.classList.add(bodyClass);

  window.addEventListener("afterprint", teardown, { once: true });
  setTimeout(teardown, 60_000);

  window.print();
}

export function printReceipt(): void {
  printScoped("@page { size: 80mm auto; margin: 0; }", RECEIPT_BODY_CLASS);
}

// S27 — one label per page, so the page IS the label. The size must match the stock loaded in the
// printer exactly; a mismatch is what makes a label printer misfeed.
export function printLabelSheet(widthMm: number, heightMm: number): void {
  printScoped(`@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`, LABEL_BODY_CLASS);
}
