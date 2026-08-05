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

// Upper bound on one print run (S19 label sheet). Guards against a mistyped quantity rendering
// tens of thousands of SVG symbols and freezing the tab.
export const BARCODE_LABEL_MAX_QUANTITY = 200;

// Business-rule sentinels. They travel as the *error message*, not `error.code` — the API's
// ConflictError/BadRequestError hardcode the generic ErrorCode (RESOURCE_CONFLICT /
// VALIDATION_ERROR), which is why lib/query-client.ts's `apiErrorMessage()` exists. Declared here
// so neither side compares a bare string literal.
export const CATALOG_ERROR = {
  BARCODE_TAKEN: 'BARCODE_TAKEN',
  BARCODE_GENERATION_EXHAUSTED: 'BARCODE_GENERATION_EXHAUSTED',
} as const;
export type CatalogErrorSentinel = (typeof CATALOG_ERROR)[keyof typeof CATALOG_ERROR];
