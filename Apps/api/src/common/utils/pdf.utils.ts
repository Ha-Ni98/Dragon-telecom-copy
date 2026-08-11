import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';

// PDFKit works in PostScript points; every dimension in this file is authored in millimetres and
// converted here. 1 in = 25.4 mm = 72 pt.
const MM = 72 / 25.4;

// Shared by every renderer in this file (S22): buffer the document's own stream and resolve once
// it has ended. Extracted from renderInvoicePdf so the label sheet — and S25's exports — reuse one
// piece of plumbing rather than re-implementing the chunk collection.
const toBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

export type InvoicePdfLine = { label: string; quantity: number; unitPrice: number; lineTotal: number };

export type InvoicePdfData = {
  number: string;
  status: string;
  issuedAt: string;
  clientNameSnapshot: string;
  clientAddressSnapshot?: string;
  totalAmount: number;
  paidAmount: number;
  lines: InvoicePdfLine[];
  store: { name: string; address?: string; phone?: string };
};

// Server-rendered from the invoice snapshot + the settings-store header only (spec: "never
// recomputed from live product/price data") — every value here is already resolved by the
// caller (billing.service.ts), this function only lays it out.
export const renderInvoicePdf = (data: InvoicePdfData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(18).text(data.store.name);
  if (data.store.address != null) doc.fontSize(10).text(data.store.address);
  if (data.store.phone != null) doc.fontSize(10).text(data.store.phone);
  doc.moveDown();

  doc.fontSize(14).text(`Invoice ${data.number}`);
  doc.fontSize(10).text(`Issued: ${data.issuedAt}`);
  doc.text(`Status: ${data.status}`);
  doc.moveDown();

  doc.text(`Bill to: ${data.clientNameSnapshot}`);
  if (data.clientAddressSnapshot != null) doc.text(data.clientAddressSnapshot);
  doc.moveDown();

  for (const line of data.lines) {
    doc.text(`${line.label}  x${line.quantity}  @ ${line.unitPrice.toFixed(2)}  =  ${line.lineTotal.toFixed(2)}`);
  }
  doc.moveDown();

  doc.fontSize(12).text(`Total: ${data.totalAmount.toFixed(2)}`);
  doc.text(`Paid: ${data.paidAmount.toFixed(2)}`);

  return toBuffer(doc);
};

// --- S22: Code 128 barcode label sheet ---

// Owner decision Q4 (S19) fixed the label at 40 x 25 mm carrying the symbol and its human-readable
// characters and nothing else. S22 fixes the sheet around it: A4 portrait, 8 mm page margin, 2 mm
// gutter -> 4 columns x 10 rows = 40 labels per page, which is what S19's browser sheet produced.
const LABEL_WIDTH_MM = 40;
const LABEL_HEIGHT_MM = 25;
const SHEET_MARGIN_MM = 8;
const LABEL_GUTTER_MM = 2;
const LABEL_COLUMNS = 4;
const LABEL_ROWS = 10;
const LABELS_PER_PAGE = LABEL_COLUMNS * LABEL_ROWS;

// Inside one label.
const LABEL_PADDING_MM = 1; // leaves 38 mm drawable
const BARS_TOP_MM = 3;
const BARS_HEIGHT_MM = 15;
const TEXT_TOP_MM = 19;
const TEXT_SIZE_PT = 8;
// Code 128 requires a quiet zone of at least 10 modules on each side. It is *not* part of what
// bwipjs.raw() returns, so it is added to the module budget here: with a 9-character value the
// symbol is 123 modules, giving 38 mm / 143 = 0.266 mm per module — above the ~0.25 mm floor a
// handheld scanner needs. A longer barcode narrows the bars proportionally.
const QUIET_ZONE_MODULES = 10;

export type BarcodeLabelRequest = { barcode: string; quantity: number };

// Bar/space widths in modules for one Code 128 symbol, starting with a bar.
//
// bwip-js's ESM build exports a *named* `raw` that is the "raw" symbology, NOT this encoder — only
// the default export carries it, and the bundled .d.ts does not distinguish the two. Import it as
// a default or it type-checks and then throws at runtime.
//
// raw() is declared as a union with a pixel-based variant and the array index is possibly
// undefined under noUncheckedIndexedAccess, hence the two guards below.
const barcodeModules = (value: string): number[] => {
  const encoded = bwipjs.raw('code128', value);
  const first = encoded[0];
  if (first == null || !('sbs' in first)) return [];
  return first.sbs;
};

// One label at (x, y) in points. bbs/bhs are ignored on purpose: for Code 128 every bar is
// full-height (guard-bar extensions are an EAN/UPC concept), so only the widths matter.
const drawBarcodeLabel = (doc: PDFKit.PDFDocument, x: number, y: number, value: string): void => {
  const sbs = barcodeModules(value);
  if (sbs.length === 0) return;

  const totalModules = sbs.reduce((sum, width) => sum + width, 0) + QUIET_ZONE_MODULES * 2;
  const drawableWidth = (LABEL_WIDTH_MM - LABEL_PADDING_MM * 2) * MM;
  const moduleWidth = drawableWidth / totalModules;

  let cursorX = x + LABEL_PADDING_MM * MM + QUIET_ZONE_MODULES * moduleWidth;
  doc.save().fillColor('#000000');
  for (let index = 0; index < sbs.length; index += 1) {
    const width = (sbs[index] ?? 0) * moduleWidth;
    // sbs alternates bar, space, bar, … starting with a bar — even indices are the bars.
    if (index % 2 === 0) doc.rect(cursorX, y + BARS_TOP_MM * MM, width, BARS_HEIGHT_MM * MM).fill();
    cursorX += width;
  }
  doc.restore();

  doc
    .font('Helvetica')
    .fontSize(TEXT_SIZE_PT)
    .fillColor('#000000')
    .text(value, x, y + TEXT_TOP_MM * MM, { width: LABEL_WIDTH_MM * MM, align: 'center' });
};

// Server-side counterpart of what S19 printed from the browser — the single source of label
// layout, so the products list and the supplier invoice cannot drift apart. `requests` is already
// filtered and ordered by the caller (catalog.service.ts): every barcode here is known printable,
// and the order is invoice-line order.
export const renderBarcodeLabelsPdf = (requests: BarcodeLabelRequest[]): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  let slot = 0;
  for (const request of requests) {
    for (let copy = 0; copy < request.quantity; copy += 1) {
      const position = slot % LABELS_PER_PAGE;
      if (slot > 0 && position === 0) doc.addPage();
      const column = position % LABEL_COLUMNS;
      const row = Math.floor(position / LABEL_COLUMNS);
      drawBarcodeLabel(
        doc,
        (SHEET_MARGIN_MM + column * (LABEL_WIDTH_MM + LABEL_GUTTER_MM)) * MM,
        (SHEET_MARGIN_MM + row * (LABEL_HEIGHT_MM + LABEL_GUTTER_MM)) * MM,
        request.barcode,
      );
      slot += 1;
    }
  }

  return toBuffer(doc);
};
