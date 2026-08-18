// S19 — generated barcode format: <2 chars of the family name><2 chars of the brand name><5 digits>,
// e.g. family "display" + brand "iphone" -> "DIIP00001". Every magnitude in that sentence is named
// here because the generator (api), the response schema (contract) and the label sheet (web) must
// all agree on it.
export const BARCODE_PREFIX_CHARS = 2;
export const BARCODE_DIGITS = 5;
export const BARCODE_LENGTH = BARCODE_PREFIX_CHARS * 2 + BARCODE_DIGITS; // 9

// Owner decision Q1 — a name that yields fewer than BARCODE_PREFIX_CHARS usable characters (a
// one-letter family, or a purely non-Latin one like "شاشة") is right-padded with this character,
// so the prefix is always exactly 2 chars and generation never fails on the name alone.
export const BARCODE_PREFIX_PAD_CHAR = 'X';

// Owner decision Q2 — the loop must terminate. Five digits give 100 000 combinations per
// family-brand pair, so exhaustion is effectively impossible; the bound exists only as a guarantee.
export const BARCODE_GENERATION_MAX_ATTEMPTS = 10;

// Upper bound on the labels one *line* may ask for. S19 set it while the sheet was rendered
// client-side as SVG; S22 moved rendering to a server-side PDF, so the cap now bounds the work the
// API does per line rather than what the tab can survive. See BARCODE_LABEL_SHEET_MAX_TOTAL for
// the whole-run bound.
export const BARCODE_LABEL_MAX_QUANTITY = 200;

// S22 — bounds on one label-sheet request. Named here because the API validates against them and
// the dialogs must disable Confirm on the same figures rather than letting the user submit into a
// 400. S26 widened the label to 50 x 25 mm, so 1000 labels is now 34 A4 pages (30 per page, was 40);
// it still renders in well under 100 ms, so the ceiling exists to keep the request bounded, not
// because the renderer is slow.
export const BARCODE_LABEL_SHEET_MAX_ITEMS = 100;
export const BARCODE_LABEL_SHEET_MAX_TOTAL = 1000;

// S22 — bound on one barcode-lookup request. A supplier invoice with more product lines than this
// does not exist in practice; the cap only stops an unbounded id list reaching the database.
export const BARCODE_LOOKUP_MAX_IDS = 200;

// S26 — caps on the two customizable label texts (store name, top text). The renderer truncates
// visually to fit the label regardless, so these only bound the request payload. Declared here
// because the schema validates against them and the inputs set maxLength from them.
export const BARCODE_LABEL_TEXT_MAX = 60;

// Business-rule sentinels. They travel as the *error message*, not `error.code` — the API's
// ConflictError/BadRequestError hardcode the generic ErrorCode (RESOURCE_CONFLICT /
// VALIDATION_ERROR), which is why lib/query-client.ts's `apiErrorMessage()` exists. Declared here
// so neither side compares a bare string literal.
export const CATALOG_ERROR = {
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  BARCODE_GENERATION_EXHAUSTED: 'BARCODE_GENERATION_EXHAUSTED',
  // S22 — every requested product turned out to have no printable barcode, so the sheet would be
  // an empty PDF. The dialogs prevent this, so it is a defence against a stale client, not a
  // routine path.
  BARCODE_LABELS_EMPTY: 'BARCODE_LABELS_EMPTY',
  // S22 — the run exceeds BARCODE_LABEL_SHEET_MAX_TOTAL. Raised by the request schema's refine so
  // it travels the same sentinel path as the others rather than as an English zod sentence.
  BARCODE_LABEL_TOTAL_EXCEEDED: 'BARCODE_LABEL_TOTAL_EXCEEDED',
} as const;
export type CatalogErrorSentinel = (typeof CATALOG_ERROR)[keyof typeof CATALOG_ERROR];
