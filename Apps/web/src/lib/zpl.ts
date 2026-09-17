import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
  QUIET_ZONE_MODULES,
  REPAIR_LABEL_TEXT_PT,
} from "@/types/label-print.types";

// S27.1 — ZPL II generation for the Zebra label printer.
//
// One builder for BOTH label flavours (the product/supplier label with its rotated store column
// and centred caption, and the repair label with its stacked text lines), mirroring
// barcode-label-sheet.tsx's own two branches. If this only handled one, the Thermal radio would
// be a lie on the other page.
//
// Deliberately emits GEOMETRY ONLY. No ^MD (darkness), ^PR (speed), ^MM (media handling) or ^MN
// (media type): those are the shop's own printer calibration and must survive our print jobs.
// Do not "helpfully" add them.

/** Dots per millimetre. 203 dpi ≈ 7.992, 300 dpi ≈ 11.811 — never hardcode 8. */
const dotsPerMm = (dpi: number): number => dpi / 25.4;

const dots = (mm: number, dpi: number): number => Math.round(mm * dotsPerMm(dpi));

/** ^FD runs until ^FS, so the hazard is the command prefixes, not a terminator:
 *  `^` starts a format command, `~` a control command, `\` is meaningful under ^FH, and a raw
 *  CR/LF would split the field. Deliberately LOSSY sanitation rather than ^FH hex-escaping —
 *  none of these characters legitimately appears in a customer name, phone, device label or a
 *  REP-… reference, and ^FH would add a second escaping regime to reason about. */
export function sanitizeZplField(text: string): string {
  return text
    .replace(/[\^~\\]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

/** Worst-case Code 128 module count if every character lands in subset B:
 *  start + data + checksum symbols at 11 modules each, + 13 for the stop pattern, + both quiet
 *  zones. JsBarcode's subset-auto and the Zebra's own need not agree (a disagreement shifts the
 *  count by ±11), so sizing against the worst case means we can only ever over-reserve — which
 *  widens bars, never overflows the label. */
function worstCaseModules(value: string): number {
  return 11 * (value.length + 2) + 13 + QUIET_ZONE_MODULES * 2;
}

export interface ZplLabelInput {
  barcode: string;
  /** From renderBarcodeSvg(); INCLUDES both quiet zones. */
  totalModules: number;
  /** Repair label: stacked raw-text lines above the symbol. */
  textLines?: string[];
  /** Product/supplier label: single centred caption above the symbol. */
  topText?: string;
  /** Product/supplier label: rotated bottom-to-top column down the left edge. */
  storeName?: string;
  widthMm: number;
  heightMm: number;
  copies: number;
  dpi: number;
}

export function buildZplLabel(input: ZplLabelInput): string {
  const { barcode, widthMm, heightMm, copies, dpi } = input;

  const padDots = dots(LABEL_PADDING_MM, dpi);
  const widthDots = dots(widthMm, dpi);
  const heightDots = dots(heightMm, dpi);

  const storeName = input.storeName ? sanitizeZplField(input.storeName) : "";
  const hasStoreColumn = storeName !== "";

  // The barcode column starts after the optional store column + its gap, mirroring the HTML.
  const contentX =
    padDots + (hasStoreColumn ? dots(LABEL_STORE_COLUMN_MM + LABEL_STORE_GAP_MM, dpi) : 0);
  const contentWidthDots = widthDots - contentX - padDots;

  // --- Module width. THE load-bearing calculation on this label. ---
  // ^BC does NOT print quiet zones, but `totalModules` (from JsBarcode) INCLUDES them. So the
  // quiet zones stay in the divisor when sizing, and the symbol is then inset by a full quiet
  // zone when positioned. Placing the symbol at `contentX` instead would leave whatever padding
  // happens to be there — typically ~4 modules against Code 128's required 10 — and the label
  // would simply not scan.
  const budgetModules = Math.max(input.totalModules, worstCaseModules(barcode));
  const moduleDots = Math.min(10, Math.max(1, Math.floor(contentWidthDots / budgetModules)));
  const barX = contentX + QUIET_ZONE_MODULES * moduleDots;

  if (import.meta.env.DEV && moduleDots / dotsPerMm(dpi) < 0.25) {
    // Warn-only, matching LabelSizeField's established stance — never block a print the operator
    // asked for; they may know their scanner copes.
    console.warn(
      `[zpl] module width ${(moduleDots / dotsPerMm(dpi)).toFixed(3)}mm is below the 0.25mm ` +
        `scanning floor for "${barcode}" on a ${widthMm}mm label`,
    );
  }

  const fontDots = dots((REPAIR_LABEL_TEXT_PT * 25.4) / 72, dpi);
  const linePitch = Math.round(fontDots * 1.2);

  const lines: string[] = ["^XA", "^CI28", `^PW${widthDots}`, `^LL${heightDots}`, "^LH0,0"];

  // --- Optional rotated store column (^A0B = font 0, Bottom-up: the ZPL equivalent of the
  //     HTML's writing-mode: vertical-rl + rotate(180deg)). ---
  if (hasStoreColumn) {
    const columnHeight = heightDots - padDots * 2;
    lines.push(
      `^FO${padDots},${heightDots - padDots}^A0B,${fontDots},0` +
        `^FB${columnHeight},1,0,L,0^FD${storeName}^FS`,
    );
  }

  // --- Text above the symbol. ^FB with maxLines=1 makes ZPL truncate rather than overflow,
  //     matching the HTML's text-overflow: ellipsis. ---
  let cursorY = padDots;
  const topText = input.topText ? sanitizeZplField(input.topText) : "";
  if (topText !== "") {
    lines.push(
      `^FO${contentX},${cursorY}^A0N,${fontDots},0` +
        `^FB${contentWidthDots},1,0,C,0^FD${topText}^FS`,
    );
    cursorY += linePitch;
  }
  for (const raw of input.textLines ?? []) {
    const line = sanitizeZplField(raw);
    if (line === "") continue;
    lines.push(
      `^FO${contentX},${cursorY}^A0N,${fontDots},0` + `^FB${contentWidthDots},1,0,L,0^FD${line}^FS`,
    );
    cursorY += linePitch;
  }

  // --- The symbol fills the height left under the text, minus the bottom padding. ^BCN's `Y`
  //     prints the human-readable interpretation line, which is what makes the reference readable
  //     on the repair tag without spending a text line on it. ---
  const barHeight = Math.max(dots(6, dpi), heightDots - padDots - cursorY - dots(3, dpi));
  lines.push(`^BY${moduleDots},2.0,${barHeight}`);
  lines.push(`^FO${barX},${cursorY}^BCN,${barHeight},Y,N,N^FD${sanitizeZplField(barcode)}^FS`);

  lines.push(`^PQ${Math.max(1, Math.trunc(copies))}`);
  lines.push("^XZ");

  return lines.join("\n");
}

/** Several labels in one job — each its own ^XA…^XZ block, so a 14-line supplier invoice is one
 *  POST rather than fourteen. Each block carries its own ^PQ. */
export function buildZplBatch(inputs: ZplLabelInput[]): string {
  return inputs.map(buildZplLabel).join("\n");
}
