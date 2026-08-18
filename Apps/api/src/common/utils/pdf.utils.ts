import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js/node';

// PDFKit works in PostScript points; every dimension in this file is authored in millimetres and
// converted here. 1 in = 25.4 mm = 72 pt.
const MM = 72 / 25.4;

// Shared by every renderer in this file (S22): buffer the document's own stream and resolve once
// it has ended. Extracted from renderInvoicePdf so the label sheet — and the S25 export renderer
// below — reuse one piece of plumbing rather than re-implementing the chunk collection.
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

// --- S25: generic table/report export renderer ---
//
// Reused by delivery fees, stock levels, the movement ledger and statistics reports
// (platform/inventory/statistics .service.ts) so every PDF export shares one layout engine
// rather than four bespoke ones. `rows` are already formatted strings — same division of labour
// as renderInvoicePdf above: this function only lays out values the caller has already resolved.
//
// Known limitation: PDFKit's built-in Helvetica is WinAnsi-encoded and cannot render Arabic
// glyphs, so an Arabic product/client name renders as garbage here — the same pre-existing
// limitation renderInvoicePdf already has. Fixing it needs an embedded Unicode TTF, which the
// repo does not ship; out of scope for S25.

export type TablePdfColumn = {
  header: string;
  width: number; // relative weight, normalised across the row
  align?: 'left' | 'right'; // default 'left'; money/quantity columns pass 'right'
};

export type TablePdfData = {
  title: string;
  filters: { label: string; value: string }[]; // [] renders as "Filters: none"
  generatedAt: Date;
  orientation: 'portrait' | 'landscape';
  columns: TablePdfColumn[];
  rows: string[][]; // already formatted by the caller — this function lays out only
  totals?: { label: string; value: string }[];
  chart?: { label: string; value: number }[]; // omitted or empty = no chart
};

const PAGE_MARGIN = 36; // 12.7 mm — a printable margin on any consumer printer
const TITLE_SIZE = 16;
const META_SIZE = 9; // filter lines + generated-at
const HEAD_SIZE = 9;
const BODY_SIZE = 8.5;
const ROW_HEIGHT = 15;
const HEAD_HEIGHT = 18;
const FOOTER_SIZE = 8;
const CHART_HEIGHT = 140;
const CHART_MAX_BARS = 20; // beyond this the labels are unreadable; the table still has every row

const formatUtcTimestamp = (d: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

const drawTitleBlock = (doc: PDFKit.PDFDocument, data: TablePdfData): void => {
  doc.font('Helvetica-Bold').fontSize(TITLE_SIZE).fillColor('#000000').text(data.title);
  doc.font('Helvetica').fontSize(META_SIZE).fillColor('#333333');
  if (data.filters.length === 0) {
    doc.text('Filters: none');
  } else {
    for (const filter of data.filters) doc.text(`${filter.label}: ${filter.value}`);
  }
  doc.text(`Generated: ${formatUtcTimestamp(data.generatedAt)}`);
  doc.moveDown();
};

// A deliberately plain bar chart matching ReportDto.chart's single-series {label, value} shape —
// it is not, and does not try to be, a pixel copy of the page's Recharts render (owner decision
// S25 §0.5). Caller (renderTablePdf) only calls this when `chart` is non-empty.
const drawChart = (
  doc: PDFKit.PDFDocument,
  chart: { label: string; value: number }[],
  availableWidth: number,
): void => {
  const bars = chart.slice(0, CHART_MAX_BARS);
  const max = Math.max(...bars.map((b) => b.value), 0);
  if (max <= 0) return; // all-zero data draws nothing meaningful

  const top = doc.y;
  const labelSpace = 12;
  const valueLabelSpace = 10;
  const plotHeight = CHART_HEIGHT - labelSpace - valueLabelSpace;
  const n = bars.length;
  const slot = availableWidth / n;
  const barWidth = slot * 0.7;
  const gap = slot * 0.3;
  const baselineY = top + valueLabelSpace + plotHeight;

  bars.forEach((bar, index) => {
    const barHeight = (bar.value / max) * plotHeight;
    const x = PAGE_MARGIN + index * slot + gap / 2;
    const barTop = baselineY - barHeight;
    doc.fillColor('#2563EB').rect(x, barTop, barWidth, barHeight).fill();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#000000')
      .text(String(bar.value), x, barTop - 9, { width: barWidth, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#333333')
      .text(bar.label, x, baselineY + 2, { width: barWidth, align: 'center', ellipsis: true, lineBreak: false });
  });

  doc
    .strokeColor('#999999')
    .moveTo(PAGE_MARGIN, baselineY)
    .lineTo(PAGE_MARGIN + availableWidth, baselineY)
    .stroke();

  doc.y = top + CHART_HEIGHT;
  doc.moveDown();
};

type LaidOutColumn = { header: string; align: 'left' | 'right'; x: number; width: number };

const layoutColumns = (columns: TablePdfColumn[], availableWidth: number): LaidOutColumn[] => {
  const totalWeight = columns.reduce((sum, col) => sum + col.width, 0);
  let x = PAGE_MARGIN;
  return columns.map((col) => {
    const width = (availableWidth * col.width) / totalWeight;
    const laidOut: LaidOutColumn = { header: col.header, align: col.align ?? 'left', x, width };
    x += width;
    return laidOut;
  });
};

const drawHeaderRow = (
  doc: PDFKit.PDFDocument,
  laidOut: LaidOutColumn[],
  y: number,
  availableWidth: number,
): void => {
  doc.fillColor('#EEEEEE').rect(PAGE_MARGIN, y, availableWidth, HEAD_HEIGHT).fill();
  doc.font('Helvetica-Bold').fontSize(HEAD_SIZE).fillColor('#000000');
  for (const col of laidOut) {
    doc.text(col.header, col.x + 2, y + 4, { width: col.width - 4, align: col.align, ellipsis: true, lineBreak: false });
  }
};

// The part that must not be improvised: `lineBreak: false` + `ellipsis` keeps every row exactly
// one line tall, which is what makes the fixed ROW_HEIGHT pagination arithmetic below correct.
// Switching a cell to wrap silently breaks pagination — rows would overlap without warning.
const drawTable = (doc: PDFKit.PDFDocument, data: TablePdfData, availableWidth: number): void => {
  const laidOut = layoutColumns(data.columns, availableWidth);
  const pageBottom = doc.page.height - PAGE_MARGIN - FOOTER_SIZE * 2;
  let y = doc.y;

  drawHeaderRow(doc, laidOut, y, availableWidth);
  y += HEAD_HEIGHT;
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');

  for (const row of data.rows) {
    if (y + ROW_HEIGHT > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow(doc, laidOut, y, availableWidth);
      y += HEAD_HEIGHT;
      doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');
    }
    laidOut.forEach((col, index) => {
      const cell = row[index] ?? '';
      doc.text(cell, col.x + 2, y + 3, { width: col.width - 4, align: col.align, ellipsis: true, lineBreak: false });
    });
    doc
      .strokeColor('#DDDDDD')
      .moveTo(PAGE_MARGIN, y + ROW_HEIGHT)
      .lineTo(PAGE_MARGIN + availableWidth, y + ROW_HEIGHT)
      .stroke();
    y += ROW_HEIGHT;
  }

  doc.y = y;
};

const drawTotals = (
  doc: PDFKit.PDFDocument,
  totals: { label: string; value: string }[],
  availableWidth: number,
): void => {
  doc.moveDown();
  doc
    .strokeColor('#000000')
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + availableWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(BODY_SIZE + 1).fillColor('#000000');
  const text = totals.map((t) => `${t.label}: ${t.value}`).join('     ');
  doc.text(text, PAGE_MARGIN, doc.y, { width: availableWidth });
};

// Second pass, once doc.bufferedPageRange() knows the true page count — bufferPages: true at
// construction (in renderTablePdf below) is required for this; without it switchToPage() throws.
// Must run after all content is drawn. Writing into the bottom margin is intentional — the
// numbers sit below the last table row, never over content.
const stampPageNumbers = (doc: PDFKit.PDFDocument): void => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .font('Helvetica')
      .fontSize(FOOTER_SIZE)
      .fillColor('#666666')
      .text(`Page ${i + 1} / ${range.count}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN + 4, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'center',
      });
  }
};

export const renderTablePdf = (data: TablePdfData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', layout: data.orientation, margin: PAGE_MARGIN, bufferPages: true });
  const availableWidth = doc.page.width - PAGE_MARGIN * 2;

  drawTitleBlock(doc, data);
  if (data.chart && data.chart.length > 0) drawChart(doc, data.chart, availableWidth);
  drawTable(doc, data, availableWidth);
  if (data.totals && data.totals.length > 0) drawTotals(doc, data.totals, availableWidth);
  stampPageNumbers(doc);

  return toBuffer(doc);
};
