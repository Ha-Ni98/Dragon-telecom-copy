// S25 — printing an 80 mm thermal receipt. Two callers: the POS receipt (PosReceiptView) and the
// repair receipt (RepairReceipt). Both mark their printable subtree with RECEIPT_ROOT_CLASS.
//
// `@page` is a document-level at-rule: it cannot be scoped by a class or an :is()/:has() selector.
// So the roll size is injected as a <style> element for the duration of one print and removed
// afterwards, and everything that CAN be selector-scoped is gated on `body.printing-receipt` in
// index.css. Without this, Ctrl+P anywhere in the app — and the /staff/sales Reprint and
// /staff/invoices Print buttons, which still print a whole A4 page on purpose (S25 owner
// decision) — would come out on an 80 mm page. Same scoping lesson as S22 finding F1.
//
// A class, not an id, because two components declare a root. They live on different routes and
// are never mounted at the same time; if that ever changes, both would print and the fix is to
// pass the wanted root in rather than to widen this.
export const RECEIPT_ROOT_CLASS = "receipt-print-root";
const STYLE_ID = "receipt-page-style";
const BODY_CLASS = "printing-receipt";
const RECEIPT_PAGE_CSS = "@page { size: 80mm auto; margin: 0; }";

function teardown(): void {
  document.getElementById(STYLE_ID)?.remove();
  document.body.classList.remove(BODY_CLASS);
}

// Idempotent — safe to call from a double-clicked Print button while a previous print is still
// tearing down. Does NOT call teardown() synchronously after window.print(): that call is not
// reliably blocking across browsers, and tearing the style down early yields a blank or A4 page.
export function printReceipt(): void {
  teardown();

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = RECEIPT_PAGE_CSS;
  document.head.appendChild(style);
  document.body.classList.add(BODY_CLASS);

  window.addEventListener("afterprint", teardown, { once: true });
  // Safety net: afterprint is not fired by every browser/driver combination, and leaving the
  // class on would make the app's own screen render wrong on the next Ctrl+P. 60s is long enough
  // that it can never fire while the print dialog is still open.
  setTimeout(teardown, 60_000);

  window.print();
}
