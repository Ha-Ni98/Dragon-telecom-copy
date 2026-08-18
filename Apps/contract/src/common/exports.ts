// S25 — shared by every server-rendered export (delivery fees, stock levels, movement ledger,
// statistics reports). An unbounded ledger export would hold a request open while it serialised
// an arbitrary number of rows; this is the ceiling-with-a-clear-message strategy the set brief
// asked the plan to fix, chosen over streaming because every one of the four exports is a single
// in-memory document (a PDF cannot be streamed row-by-row anyway) and because the same number
// then bounds the CSV and the PDF identically.
export const EXPORT_MAX_ROWS = 5000;

// Travels as the error *message*, not error.code — same sentinel convention as CATALOG_ERROR
// (see query-client.ts's SENTINEL_TRANSLATION_KEYS comment).
export const EXPORT_ERROR = {
  ROW_LIMIT_EXCEEDED: 'EXPORT_ROW_LIMIT_EXCEEDED',
} as const;
export type ExportErrorSentinel = (typeof EXPORT_ERROR)[keyof typeof EXPORT_ERROR];
