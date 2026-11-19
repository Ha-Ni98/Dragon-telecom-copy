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
// client-side as SVG; S22 moved rendering to a server-side PDF; S27 moved it back into the
// browser (a print dialog, not a download), so this is once again a client-side bound — the
// number of physical labels one line can print in a single run.
export const BARCODE_LABEL_MAX_QUANTITY = 200;

// S22 — bound on the whole-run label total, across every line in one print. S27 deleted the
// server-side sheet request this used to validate; it now bounds one BROWSER print run — the
// number of `<svg>` elements the tab builds and the number of physical labels the roll feeds.
// One label is one printed page, so N labels is N pages.
export const BARCODE_LABEL_SHEET_MAX_TOTAL = 1000;

// S22 — bound on one barcode-lookup request. A supplier invoice with more product lines than this
// does not exist in practice; the cap only stops an unbounded id list reaching the database.
export const BARCODE_LOOKUP_MAX_IDS = 200;

// S26 — caps on the two customizable label texts (store name, top text). S27's browser renderer
// truncates visually to fit the label regardless, so these only bound the input fields. Declared
// here because the dialogs set maxLength from them.
export const BARCODE_LABEL_TEXT_MAX = 60;

// Business-rule sentinels. They travel as the *error message*, not `error.code` — the API's
// ConflictError/BadRequestError hardcode the generic ErrorCode (RESOURCE_CONFLICT /
// VALIDATION_ERROR), which is why lib/query-client.ts's `apiErrorMessage()` exists. Declared here
// so neither side compares a bare string literal.
export const CATALOG_ERROR = {
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  BARCODE_GENERATION_EXHAUSTED: 'BARCODE_GENERATION_EXHAUSTED',
} as const;
export type CatalogErrorSentinel = (typeof CATALOG_ERROR)[keyof typeof CATALOG_ERROR];

// S39 — the home page's "New arrivals" row: newest enabled+published products, at most
// NEW_ARRIVALS_PER_FAMILY per family so one big delivery cannot fill the row. Bounded by
// NEW_ARRIVALS_MAX (1GB machine rule); the cap is applied in SQL (window function).
export const NEW_ARRIVALS_PER_FAMILY = 3;
export const NEW_ARRIVALS_DEFAULT_LIMIT = 12;
export const NEW_ARRIVALS_MAX = 24;
