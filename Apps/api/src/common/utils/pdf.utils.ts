import PDFDocument from 'pdfkit';

// Shared by every renderer in this file (S22): buffer the document's own stream and resolve once
// it has ended. Extracted from renderInvoicePdf so the S25 export renderer below reuses one piece
// of plumbing rather than re-implementing the chunk collection. (S27 removed the third caller,
// the barcode-label PDF renderer — label printing moved into the browser.)
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
  // Relative weight, normalised across the row. S28 — cells wrap onto as many lines as they need
  // rather than being ellipsised onto one, so a narrow weight now means "more wrapped lines for
  // this column", not "truncate this column".
  width: number;
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
const ROW_MIN_HEIGHT = 15; // the pre-S28 fixed row height, now a floor for short rows
const HEAD_MIN_HEIGHT = 18;
const CELL_PAD_X = 2;
const CELL_PAD_Y = 3;
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

// S28 — statistics reports have dynamic columns, so their caller cannot hand-tune weights the way
// the inventory/platform exports do. Derive a weight from the longest string each column actually
// contains (header included), divided by a nominal characters-per-unit and clamped so one very
// long free-text column cannot squeeze every other column to nothing. The absolute value is
// irrelevant — layoutColumns normalises the weights across the row.
const WEIGHT_CHARS_PER_UNIT = 8;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 6;

export const deriveColumnWeights = (headers: string[], rows: string[][]): number[] =>
  headers.map((header, index) => {
    const longest = rows.reduce(
      (max, row) => Math.max(max, (row[index] ?? '').length),
      header.length,
    );
    return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, longest / WEIGHT_CHARS_PER_UNIT));
  });

// S28 — cells wrap instead of being ellipsised on one line, so a row is as tall as its tallest
// cell. `heightOfString` measures with the font and size CURRENTLY set on the doc, so every
// caller must set the row's font before calling this (bold/HEAD_SIZE for the header row,
// Helvetica/BODY_SIZE for body rows) — measuring with the wrong font silently mis-paginates.
const measureRowHeight = (
  doc: PDFKit.PDFDocument,
  laidOut: LaidOutColumn[],
  cells: string[],
  minHeight: number,
): number => {
  let tallest = 0;
  laidOut.forEach((col, index) => {
    const height = doc.heightOfString(cells[index] ?? '', {
      width: col.width - CELL_PAD_X * 2,
      align: col.align,
    });
    if (height > tallest) tallest = height;
  });
  return Math.max(minHeight, tallest + CELL_PAD_Y * 2);
};

// The cell box: `height` is a hard clip that also stops PDFKit adding a page of its own mid-cell,
// which would desynchronise the manual `y` cursor below. `ellipsis` therefore only ever fires in
// the pathological case handled in drawTable (a single cell taller than a whole page); in every
// normal row the text wraps and fits.
const drawCell = (
  doc: PDFKit.PDFDocument,
  col: LaidOutColumn,
  text: string,
  y: number,
  rowHeight: number,
): void => {
  doc.text(text, col.x + CELL_PAD_X, y + CELL_PAD_Y, {
    width: col.width - CELL_PAD_X * 2,
    height: rowHeight - CELL_PAD_Y * 2,
    align: col.align,
    ellipsis: true,
  });
};

const drawHeaderRow = (
  doc: PDFKit.PDFDocument,
  laidOut: LaidOutColumn[],
  y: number,
  availableWidth: number,
  headHeight: number,
): void => {
  doc.fillColor('#EEEEEE').rect(PAGE_MARGIN, y, availableWidth, headHeight).fill();
  doc.font('Helvetica-Bold').fontSize(HEAD_SIZE).fillColor('#000000');
  for (const col of laidOut) drawCell(doc, col, col.header, y, headHeight);
};

// S28 — rows wrap and grow. The arithmetic that must not be improvised:
//   rowHeight = max(ROW_MIN_HEIGHT, measured + 2*CELL_PAD_Y), then clamped to maxRowHeight.
//   cell box height = rowHeight - 2*CELL_PAD_Y, which is >= `measured` in BOTH branches of the
//   max (if the floor wins, `measured` was < ROW_MIN_HEIGHT - 2*CELL_PAD_Y by definition), so a
//   normal row is never clipped. Only the clamp can clip, and that needs one cell taller than an
//   entire page. Reverting any cell to `lineBreak: false` silently breaks this pagination.
const drawTable = (doc: PDFKit.PDFDocument, data: TablePdfData, availableWidth: number): void => {
  const laidOut = layoutColumns(data.columns, availableWidth);
  const pageBottom = doc.page.height - PAGE_MARGIN - FOOTER_SIZE * 2;

  doc.font('Helvetica-Bold').fontSize(HEAD_SIZE);
  const headHeight = measureRowHeight(doc, laidOut, data.columns.map((col) => col.header), HEAD_MIN_HEIGHT);
  // The tallest a row may be: a full fresh page minus its repeated header. Measured once.
  const maxRowHeight = Math.max(ROW_MIN_HEIGHT, pageBottom - PAGE_MARGIN - headHeight);

  let y = doc.y;
  drawHeaderRow(doc, laidOut, y, availableWidth, headHeight);
  y += headHeight;
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');

  for (const row of data.rows) {
    const rowHeight = Math.min(measureRowHeight(doc, laidOut, row, ROW_MIN_HEIGHT), maxRowHeight);
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow(doc, laidOut, y, availableWidth, headHeight);
      y += headHeight;
      doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#000000');
    }
    laidOut.forEach((col, index) => drawCell(doc, col, row[index] ?? '', y, rowHeight));
    doc
      .strokeColor('#DDDDDD')
      .moveTo(PAGE_MARGIN, y + rowHeight)
      .lineTo(PAGE_MARGIN + availableWidth, y + rowHeight)
      .stroke();
    y += rowHeight;
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
