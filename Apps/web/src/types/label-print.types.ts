// S27 — label sizes and geometry. Web-only: S27 deleted the server-side label PDF, so nothing
// back-end reads these. The millimetre figures are carried over verbatim from S26's PDF renderer
// (pdf.utils.ts, now deleted) so the printed label keeps the layout the owner approved.

export interface LabelSize {
  widthMm: number;
  heightMm: number;
}

/** S26's report records 40 x 25 mm stock as invalid and 50 x 25 mm as what the store now buys —
 *  so that is the default, and the first preset offered. */
export const LABEL_SIZE_PRESETS: readonly LabelSize[] = [
  { widthMm: 40, heightMm: 20 },
  { widthMm: 40, heightMm: 30 },
  { widthMm: 50, heightMm: 30 },
] as const;

export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 40, heightMm: 20 };

/** Bounds on the custom size, so a typo cannot emit a 5000 mm page. */
export const LABEL_CUSTOM_MIN_MM = 15;
export const LABEL_CUSTOM_MAX_MM = 150;

/** Carried from pdf.utils.ts (S26). The store column is a fixed width at every label size — it
 *  holds one rotated line of text, which does not need to grow with the label. */
export const LABEL_PADDING_MM = 1;
export const LABEL_STORE_COLUMN_MM = 6;
export const LABEL_STORE_GAP_MM = 0.5;

/** Code 128 requires >= 10 quiet-zone modules each side and JsBarcode does not add them: its
 *  `margin` option is in the same pixel units as `width`, so margin = QUIET_ZONE_MODULES * width
 *  buys exactly ten modules. A barcode printed edge to edge will not scan. */
export const QUIET_ZONE_MODULES = 10;

/** S22/S26's recorded scanning floor. Below this a handheld reader starts failing; S26 widened
 *  the label 40 -> 50 mm purely to stay above it. A custom size that falls under it is warned
 *  about in the dialog rather than silently printed. */
export const BARCODE_MIN_MODULE_MM = 0.25;

/** localStorage key — "remember the last chosen size so the counter isn't re-picking it every
 *  time" (S27 brief). */
export const LABEL_SIZE_STORAGE_KEY = "dt_label_size";

/** S27.1 — the repair client label remembers its own size, separately from the product/supplier
 *  labels: it is a different physical stock on a different bench. Same per-workstation reasoning
 *  as LABEL_SIZE_STORAGE_KEY above. */
export const REPAIR_LABEL_SIZE_STORAGE_KEY = "dt_repair_label_size";

/** S27.1 — the repair label's raw-text block. 6 pt (2.12 mm) at 1.15 line-height gives ~2.4 mm a
 *  line, so four lines cost ~9.7 mm of a 50 x 25 mm label's 23 mm content height, leaving ~13 mm
 *  for the symbol and its readable value. Dropping below 6 pt stops being legible on a thermal
 *  head; going above it starts eating the barcode. */
export const REPAIR_LABEL_TEXT_PT = 6;
export const REPAIR_LABEL_LINE_HEIGHT = 1.15;

/** S27.1 — hard ceiling on the text block as a share of the label's content height, so a long
 *  line list can never squeeze the symbol below a scannable height. This is a scan-safety floor
 *  for the barcode, not a styling choice. */
export const LABEL_TEXT_BLOCK_MAX_PCT = 55;
