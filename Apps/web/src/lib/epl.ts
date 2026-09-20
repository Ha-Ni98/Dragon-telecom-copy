import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
  QUIET_ZONE_MODULES,
  REPAIR_LABEL_TEXT_PT,
  type LabelInput,
} from "@/types/label-print.types";

// EPL2 generation for older Zebra desktop label printers.
//
// WHY THIS EXISTS ALONGSIDE lib/zpl.ts
// ZPL II is not universal. Pre-"Plus" Zebra desktop units — the shop's LP 2824 among them — ship
// with EPL2-only firmware and no ZPL interpreter at all. Sent ZPL, such a printer finds no command
// it recognises and discards the entire stream: no error, no LED, no paper, nothing. That silence
// is what made this expensive to diagnose, and it is why the language is chosen per printer from
// the helper's /status rather than assumed (see hooks/use-print-bridge.ts's labelLanguage).
//
// This mirrors lib/zpl.ts field for field and takes the same LabelInput, so a call site switches
// languages by swapping the builder and changing nothing else.
//
// Like the ZPL builder, this emits GEOMETRY AND CONTENT ONLY. No `D` (density), `S` (speed) or `Q`
// (form length/gap): those are the shop's own media calibration, and on EPL a wrong `Q` actively
// misfeeds labels. The printer's own calibration must survive our print jobs — the same rule
// lib/zpl.ts states for ^MD/^PR/^MM/^MN, and the reason the test payload that proved this printer
// works omitted `Q` too.

/** Dots per millimetre. 203 dpi ≈ 7.992, 300 dpi ≈ 11.811 — never hardcode 8. */
const dotsPerMm = (dpi: number): number => dpi / 25.4;

const dots = (mm: number, dpi: number): number => Math.round(mm * dotsPerMm(dpi));

/** EPL2's bitmap font matrix: cell sizes in dots at 203 dpi, scaled only by integer multipliers.
 *  This is the fidelity gap against ZPL's `^A0N`, which is a scalable outline font that takes an
 *  arbitrary dot height — EPL can only land on the discrete sizes below, so text is matched to the
 *  nearest fit rather than exactly. */
const EPL_FONTS = [
  { id: 1, w: 8, h: 12 },
  { id: 2, w: 10, h: 16 },
  { id: 3, w: 12, h: 20 },
  { id: 4, w: 14, h: 24 },
  { id: 5, w: 32, h: 48 },
] as const;

/** EPL2 accepts multipliers 1-8 on both axes. */
const MAX_FONT_MULTIPLIER = 8;

interface ChosenFont {
  id: number;
  mult: number;
  /** Rendered cell size after the multiplier. */
  w: number;
  h: number;
}

/** Largest font/multiplier pair that still fits within targetDots, falling back to the smallest
 *  font when the target is below even font 1. The same multiplier is used on both axes so glyph
 *  aspect ratio is preserved.
 *
 *  On a tie the LOWER multiplier wins, which means the larger native font: 24 dots is reachable as
 *  either font 1 doubled (16x24) or font 4 at 1x (14x24), and the native glyph is both sharper and
 *  narrower than a pixel-doubled small one. */
export function pickEplFont(targetDots: number): ChosenFont {
  let best: ChosenFont = { id: 1, mult: 1, w: EPL_FONTS[0].w, h: EPL_FONTS[0].h };
  let bestHeight = 0;

  for (const font of EPL_FONTS) {
    for (let mult = 1; mult <= MAX_FONT_MULTIPLIER; mult++) {
      const height = font.h * mult;
      if (height > targetDots) break; // taller multiples of this font can only be worse
      if (height > bestHeight || (height === bestHeight && mult < best.mult)) {
        bestHeight = height;
        best = { id: font.id, mult, w: font.w * mult, h: height };
      }
    }
  }
  return best;
}

/** EPL2 field data is delimited by double quotes on a line-oriented, CRLF-terminated command, so
 *  the hazards are the quote, the backslash (EPL's own escape character) and any raw CR/LF, which
 *  would split the command.
 *
 *  Accents are stripped to their base letter rather than encoded. EPL selects a character set with
 *  its own `I` command, which is printer configuration this code cannot verify — and emitting the
 *  wrong one produces mojibake across the whole label. "ETAT" instead of "État" is an acceptable
 *  worst case; mojibake is not. That is the identical trade lib/escpos.ts's encodeText already
 *  makes for the receipt printer. If the shop's printer's character set is ever confirmed, this is
 *  the single place that would change. */
export function sanitizeEplField(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // drop the combining marks NFD just split off: e-acute -> e
      .replace(/[\\"]/g, " ") // lossy, deliberately: one escaping regime is easier to reason about
      // Anything still non-ASCII cannot be trusted to render under an unknown character set. This
      // also catches raw CR/LF, which would otherwise split the command line itself.
      .replace(/[^\x20-\x7e]/g, " ")
      // Everything above substitutes spaces rather than deleting, so "iPhone 12 \u2014 \u00e9cran" does not
      // become "iPhone 12  ecran" with a visible double gap where the dash used to be.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Truncate to what actually fits, since EPL has no `^FB` equivalent to do it for us — an
 *  overlong line would otherwise run off the label edge instead of being clipped. */
function fitToWidth(text: string, availableDots: number, charWidthDots: number): string {
  if (charWidthDots <= 0) return text;
  const maxChars = Math.floor(availableDots / charWidthDots);
  if (maxChars <= 0) return "";
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** Worst-case Code 128 module count — identical reasoning and arithmetic to lib/zpl.ts's copy:
 *  sizing against the worst case can only ever over-reserve, which widens bars rather than
 *  overflowing the label. */
function worstCaseModules(value: string): number {
  return 11 * (value.length + 2) + 13 + QUIET_ZONE_MODULES * 2;
}

export function buildEplLabel(input: LabelInput): string {
  const { barcode, widthMm, heightMm, copies, dpi } = input;
  const showBarcode = input.showBarcode ?? true;

  const padDots = dots(LABEL_PADDING_MM, dpi);
  const widthDots = dots(widthMm, dpi);
  const heightDots = dots(heightMm, dpi);

  const storeName = input.storeName ? sanitizeEplField(input.storeName) : "";
  const hasStoreColumn = storeName !== "";

  const contentX =
    padDots + (hasStoreColumn ? dots(LABEL_STORE_COLUMN_MM + LABEL_STORE_GAP_MM, dpi) : 0);
  const contentWidthDots = widthDots - contentX - padDots;

  // --- Module width. Same load-bearing calculation as the ZPL builder. ---
  // EPL's `B` command does not print quiet zones either, while totalModules (from JsBarcode)
  // includes them — so the quiet zones stay in the divisor when sizing, and the symbol is then
  // inset by a full quiet zone when positioned, or it will not scan.
  let moduleDots = 0;
  let barX = contentX;
  if (showBarcode) {
    const budgetModules = Math.max(input.totalModules, worstCaseModules(barcode));
    moduleDots = Math.min(10, Math.max(1, Math.floor(contentWidthDots / budgetModules)));
    barX = contentX + QUIET_ZONE_MODULES * moduleDots;
  }

  const font = pickEplFont(dots((REPAIR_LABEL_TEXT_PT * 25.4) / 72, dpi));
  const linePitch = Math.round(font.h * 1.2);

  // `N` clears the image buffer; `q` sets the printable width (EPL's analogue of ^PW).
  const lines: string[] = ["N", `q${widthDots}`];

  // --- Optional rotated store column, reading bottom-to-top down the left edge, matching the ZPL
  //     builder's ^A0B and the HTML's writing-mode: vertical-rl + rotate(180deg).
  //
  //     ANCHORED AT THE TOP, NOT THE BOTTOM — and that difference is why this column silently
  //     failed to print on the first hardware run. ZPL's ^FO with ^A0B anchors the baseline at the
  //     BOTTOM of the text and grows upward, so the ZPL builder passes `heightDots - padDots`.
  //     EPL's reference point is the top-left corner of the ROTATED block, which grows downward
  //     from there: copying ZPL's anchor put a ~140-dot-long string at y=152 on a 160-dot label,
  //     i.e. almost entirely past the bottom edge, and the printer simply clipped it. Nothing was
  //     wrong with the rotation — the origin was. ---
  if (hasStoreColumn) {
    const columnHeight = heightDots - padDots * 2;
    const text = fitToWidth(storeName, columnHeight, font.w);
    lines.push(`A${padDots},${padDots},3,${font.id},${font.mult},${font.mult},N,"${text}"`);
  }

  // --- Text above the symbol. EPL has no justification parameter, so the centred caption is
  //     centred by computing its origin from the rendered string width. ---
  let cursorY = padDots;
  const topText = input.topText ? sanitizeEplField(input.topText) : "";
  if (topText !== "") {
    const text = fitToWidth(topText, contentWidthDots, font.w);
    const textWidth = text.length * font.w;
    const centeredX = contentX + Math.max(0, Math.round((contentWidthDots - textWidth) / 2));
    lines.push(`A${centeredX},${cursorY},0,${font.id},${font.mult},${font.mult},N,"${text}"`);
    cursorY += linePitch;
  }
  for (const raw of input.textLines ?? []) {
    const line = sanitizeEplField(raw);
    if (line === "") continue;
    const text = fitToWidth(line, contentWidthDots, font.w);
    lines.push(`A${contentX},${cursorY},0,${font.id},${font.mult},${font.mult},N,"${text}"`);
    cursorY += linePitch;
  }

  // --- The symbol fills the height left under the text, minus the bottom padding. The trailing
  //     `B` prints the human-readable interpretation line below the bars, matching ^BCN's `Y`. ---
  if (showBarcode) {
    const barHeight = Math.max(dots(6, dpi), heightDots - padDots - cursorY - dots(3, dpi));
    // Barcode type "1" is Code 128. The wide-bar parameter is required by the command grammar but
    // is not meaningful for Code 128, which is a fixed-module symbology — it is set to a valid
    // multiple of the narrow bar rather than left at zero.
    const wideDots = Math.max(moduleDots * 2, 2);
    lines.push(
      `B${barX},${cursorY},0,1,${moduleDots},${wideDots},${barHeight},B,"${sanitizeEplField(barcode)}"`,
    );
  }

  lines.push(`P${Math.max(1, Math.trunc(copies))}`);

  // EPL2 is line-oriented and requires CRLF, including after the final command — a bare LF is
  // silently ignored by some firmware, which reads as "the printer did nothing" all over again.
  return lines.join("\r\n") + "\r\n";
}

/** Several labels in one job — each its own N…P block, so a 14-line supplier invoice is one POST
 *  rather than fourteen. Each block carries its own `P`, exactly as each ZPL block carries ^PQ. */
export function buildEplBatch(inputs: LabelInput[]): string {
  return inputs.map(buildEplLabel).join("");
}
