// S25 — one RFC 4180 writer for every CSV export (delivery fees, stock levels, movement ledger,
// statistics reports). Each module previously joined its fields with a bare `,`: a product name
// or a client name containing a comma silently split into two columns and shifted every later
// column of that row, and no export emitted a BOM, so Excel read UTF-8 accented and Arabic text
// as mojibake. statistics.service.ts was worse still — it escaped with JSON.stringify, which
// backslash-escapes an inner quote where CSV requires doubling it.

// Excel picks its CSV separator from the machine's list separator. `,` is kept because it is
// RFC 4180 and because the delivery-fee *importer* (platform.service.ts importFees) round-trips
// this same file. If the owner's Excel is French/Algerian-locale and drops every row into a
// single column, CSV_SEPARATOR and CSV_DECIMAL below are the two lines to flip together
// (';' and ',') — they must always move as a pair or the decimals become field breaks.
export const CSV_SEPARATOR = ',';
const CSV_DECIMAL = '.';
// Exported so a caller appending a second table after toCsv()'s output (statistics.service.ts's
// totals block) can insert the same blank-line separator without re-declaring the literal.
export const CSV_EOL = '\r\n'; // RFC 4180; Excel on Windows needs it
const CSV_BOM = '\uFEFF'; // makes Excel read the payload as UTF-8 rather than the ANSI codepage
export const CSV_MIME = 'text/csv; charset=utf-8';

export type CsvValue = string | number | boolean | null | undefined;

export const csvMoney = (n: number): string => n.toFixed(2).replace('.', CSV_DECIMAL);

// YYYY-MM-DD HH:mm in UTC, locale-free and lexically sortable. A locale-formatted date
// (12/08/2026) is ambiguous between fr and en and Excel would re-parse it against its own locale.
export const csvDate = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
};

const escapeField = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : csvMoney(value);
  }
  const needsQuoting =
    value.includes(CSV_SEPARATOR) ||
    value.includes('"') ||
    value.includes('\r') ||
    value.includes('\n') ||
    value !== value.trim();
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const buildRows = (headers: string[], rows: CsvValue[][]): string =>
  [headers, ...rows].map((row) => row.map(escapeField).join(CSV_SEPARATOR)).join(CSV_EOL) + CSV_EOL;

export const toCsv = (headers: string[], rows: CsvValue[][]): string => CSV_BOM + buildRows(headers, rows);

// BOM-free variant for appending a second table (e.g. a totals block) after an already-BOM'd
// toCsv() body — a second BOM mid-file shows up as a stray \uFEFF character in Excel.
export const toCsvSection = (headers: string[], rows: CsvValue[][]): string => buildRows(headers, rows);
