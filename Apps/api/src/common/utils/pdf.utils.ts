import PDFDocument from 'pdfkit';

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
export const renderInvoicePdf = (data: InvoicePdfData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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

    doc.end();
  });
