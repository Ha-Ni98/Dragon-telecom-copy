import ExcelJS from 'exceljs';

// Column layout importFees (Sprint P3) parses: wilayaCode, communeCode (blank = wilaya-level
// row), deliveryHome, deliveryOffice. One sheet, header row first.
export const FEES_IMPORT_HEADERS = ['wilayaCode', 'communeCode', 'deliveryHome', 'deliveryOffice'] as const;

export type FeesImportRow = [string, string | null, number | string, number | string];

const buildWorkbookBuffer = async (rows: FeesImportRow[]): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fees');
  sheet.addRow([...FEES_IMPORT_HEADERS]);
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
};

// A single well-formed wilaya-level row.
export const validFeesWorkbook = (wilayaCode: string, deliveryHome = 500, deliveryOffice = 300) =>
  buildWorkbookBuffer([[wilayaCode, null, deliveryHome, deliveryOffice]]);

// One good row + one row with a non-numeric fee — exercises "one bad row -> 400 listing it,
// zero writes" (spec Test Scenarios).
export const mixedFeesWorkbook = (wilayaCode: string) =>
  buildWorkbookBuffer([
    [wilayaCode, null, 500, 300],
    [wilayaCode, null, 'not-a-number', 300],
  ]);
