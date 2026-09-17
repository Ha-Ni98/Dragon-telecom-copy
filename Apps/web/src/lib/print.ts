// S25/S27 — printing thermal artefacts via the browser's own print dialog, never a PDF. The POS
// receipt (PosReceiptView) and the repair receipt (RepairReceipt) both print at 80mm and mark
// their root with RECEIPT_ROOT_CLASS; the barcode label sheet (BarcodeLabelSheet, S27) prints at
// a size chosen per run and is portaled into getLabelPrintPortal() below. Three dialogs drive the
// label path since S27.1 added the repair client label.
//
// S27.1 — everything here is now the FALLBACK path, not the only path. When a local print helper
// is reachable, lib/print-bridge.ts sends ZPL/ESC-POS straight to the hardware and these functions
// are never called; they run when there is no helper, when the operator chose Browser, or when a
// thermal send failed. Nothing in this file knows about that — callers decide, so this stays the
// simple, always-works path it has always been.
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
// A class, not an id, for the receipt root, because more than one component may declare one. They
// live on different routes and are never mounted at the same time; if that ever changes, both
// would print and the fix is to pass the wanted root in rather than to widen this.
export const RECEIPT_ROOT_CLASS = "receipt-print-root";

// S27 (post-owner-report fix) — the label sheet does NOT use the receipt's visibility +
// position:absolute masking. That approach silently breaks multi-page printing: Chrome's print
// engine does not fragment a position:absolute box across physical pages, so only the FIRST label
// printed and every subsequent forced page-break (one per label) came out blank — confirmed by
// printing a 14-label run and getting page 1 correct, pages 2-14 empty. The receipt never hit this
// because its `@page` height is `auto` — it is architecturally always exactly one page, so its box
// never needed to fragment.
//
// The fix: render the label sheet through a React portal attached directly to <body>
// (getLabelPrintPortal, used by barcode-label-sheet.tsx), living outside #root in NORMAL document
// flow. Hiding #root wholesale (display:none) and letting the portal's content flow normally is
// what lets the browser's native pagination tile N labels across N physical pages correctly.
const LABEL_PORTAL_ID = "label-print-portal";

// Idempotent — safe to call on every render of every mounted BarcodeLabelSheet. Lazily creates the
// portal node on first call rather than eagerly at module load, so this file has no side effects
// for pages that never print a label sheet.
export function getLabelPrintPortal(): HTMLElement {
  let node = document.getElementById(LABEL_PORTAL_ID);
  if (!node) {
    node = document.createElement("div");
    node.id = LABEL_PORTAL_ID;
    document.body.appendChild(node);
  }
  return node;
}

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
