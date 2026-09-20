// S27.1 — ESC/POS generation for the 80 mm thermal receipt printer.
//
// Hand-rolled rather than a dependency: ESC/POS is a handful of escape sequences, and adding a
// library needs owner sign-off per the project rules.
//
// GEOMETRY. An 80 mm roll at 203 dpi gives 576 printable dots. Font A is 12 dots wide, so the
// layout is a fixed 48-column character grid. Every helper below is written against that number.
export const ESCPOS_COLUMNS = 48;

const ESC = 0x1b;
const GS = 0x1d;

// --- Command sequences -------------------------------------------------------------------
// UNCERTAINTY, stated plainly: the cut command is the least portable byte in ESC/POS.
// `GS V 66 n` (function B, partial cut after feeding n lines) has the widest support across
// Epson-compatible clones, but `GS V 0` (full) and `GS V 1` (partial) exist and some clones
// implement only one. This MUST be verified against the actual printer. If it differs by site,
// the helper app — which knows the hardware — is the right place to substitute it, not the web.
export const CMD = {
  INIT: [ESC, 0x40],
  FONT_A: [ESC, 0x4d, 0x00],
  /** ESC t n — select character code table. 0 = CP437; see encodeText below for why. */
  CODEPAGE_CP437: [ESC, 0x74, 0x00],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  /** GS ! n, n = ((width-1) << 4) | (height-1). */
  SIZE_NORMAL: [GS, 0x21, 0x00],
  SIZE_DOUBLE: [GS, 0x21, 0x11],
  SIZE_DOUBLE_HEIGHT: [GS, 0x21, 0x01],
  LF: [0x0a],
  FEED_AND_CUT: [ESC, 0x64, 0x04, GS, 0x56, 0x42, 0x00],
} as const;

// --- Character encoding ------------------------------------------------------------------
// CP437 covers the accents French actually needs (é è à ç ù â ê î ô û ë ï ü ÿ and É Ç Ñ Ö Ü) and
// is the default on essentially every clone, which makes it the safest bet.
//
// UNCERTAINTY: the `n` in `ESC t n` is vendor-specific beyond the common values (0 = CP437,
// 16 ≈ CP1252 on Epson, 19 = CP858 on many clones). CP1252 would be marginally cleaner if the
// printer supports it. Verify against the real printer; a different page is a helper-side
// rewrite, since the helper knows the hardware and the web does not.
const CP437: ReadonlyMap<string, number> = new Map<string, number>([
  ["Ç", 0x80],
  ["ü", 0x81],
  ["é", 0x82],
  ["â", 0x83],
  ["ä", 0x84],
  ["à", 0x85],
  ["å", 0x86],
  ["ç", 0x87],
  ["ê", 0x88],
  ["ë", 0x89],
  ["è", 0x8a],
  ["ï", 0x8b],
  ["î", 0x8c],
  ["ì", 0x8d],
  ["Ä", 0x8e],
  ["Å", 0x8f],
  ["É", 0x90],
  ["æ", 0x91],
  ["Æ", 0x92],
  ["ô", 0x93],
  ["ö", 0x94],
  ["ò", 0x95],
  ["û", 0x96],
  ["ù", 0x97],
  ["ÿ", 0x98],
  ["Ö", 0x99],
  ["Ü", 0x9a],
  ["¢", 0x9b],
  ["£", 0x9c],
  ["¥", 0x9d],
  ["á", 0xa0],
  ["í", 0xa1],
  ["ó", 0xa2],
  ["ú", 0xa3],
  ["ñ", 0xa4],
  ["Ñ", 0xa5],
  ["º", 0xa6],
  ["ª", 0xa7],
  ["¿", 0xa8],
  ["°", 0xf8],
  ["·", 0xfa],
  ["²", 0xfd],
]);

/** Intl.NumberFormat("fr-FR") — which formatDZD uses for EVERY amount on the receipt — emits
 *  U+202F NARROW NO-BREAK SPACE as its thousands separator in modern ICU. That codepoint exists
 *  in no ESC/POS code page, so without this normalisation every price prints as garbage. U+00A0
 *  and U+2009 get the same treatment. This only ever shows up on real hardware, which is exactly
 *  why it is handled here rather than discovered later. */
function normaliseSpaces(text: string): string {
  return text.replace(/[\u202f\u00a0\u2009]/g, " ");
}

/** ASCII passes through; CP437 has an explicit mapping; anything else is stripped of its
 *  diacritic (the same NFD idiom supplierInitials already uses) and falls back to "?" only if it
 *  is still unencodable. "ETAT" instead of "État" on a heading is an acceptable worst case;
 *  mojibake is not. */
export function encodeText(text: string): Uint8Array {
  const normalised = normaliseSpaces(text);
  const out: number[] = [];

  for (const char of normalised) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      out.push(code);
      continue;
    }
    const mapped = CP437.get(char);
    if (mapped !== undefined) {
      out.push(mapped);
      continue;
    }
    const stripped = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const strippedCode = stripped.charCodeAt(0);
    out.push(
      stripped.length > 0 && strippedCode >= 0x20 && strippedCode <= 0x7e ? strippedCode : 0x3f,
    );
  }

  return Uint8Array.from(out);
}

// --- Layout helpers ----------------------------------------------------------------------

/** Left text and right text on one line, the right edge flush to the column count. Truncates the
 *  left side when the pair does not fit, because the right side is always the number. */
export function twoColumns(left: string, right: string, cols = ESCPOS_COLUMNS): string {
  const gap = cols - right.length;
  if (gap <= 0) return right.slice(0, cols);
  const trimmedLeft = left.length > gap - 1 ? left.slice(0, Math.max(0, gap - 1)) : left;
  return trimmedLeft + " ".repeat(cols - trimmedLeft.length - right.length) + right;
}

/** Word-wrap, breaking mid-word only when a single word exceeds the width. */
export function wrap(text: string, cols = ESCPOS_COLUMNS): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > cols) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += cols) lines.push(word.slice(i, i + cols));
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > cols) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export function divider(cols = ESCPOS_COLUMNS): string {
  return "-".repeat(cols);
}

// --- Byte builder ------------------------------------------------------------------------

/** Accumulates commands and encoded text into one byte stream. */
export class EscPosBuilder {
  private readonly chunks: number[] = [];

  raw(bytes: readonly number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  /** One line of text plus a line feed. */
  line(text = ""): this {
    this.chunks.push(...encodeText(text), ...CMD.LF);
    return this;
  }

  align(where: "left" | "center" | "right"): this {
    return this.raw(
      where === "center" ? CMD.ALIGN_CENTER : where === "right" ? CMD.ALIGN_RIGHT : CMD.ALIGN_LEFT,
    );
  }

  bold(on: boolean): this {
    return this.raw(on ? CMD.BOLD_ON : CMD.BOLD_OFF);
  }

  size(which: "normal" | "double" | "doubleHeight"): this {
    return this.raw(
      which === "double"
        ? CMD.SIZE_DOUBLE
        : which === "doubleHeight"
          ? CMD.SIZE_DOUBLE_HEIGHT
          : CMD.SIZE_NORMAL,
    );
  }

  divider(): this {
    return this.line(divider());
  }

  build(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

/** Every job opens the same way: reset, pick the code page, pick Font A (the 48-column grid all
 *  the layout helpers assume). */
export function startReceipt(): EscPosBuilder {
  return new EscPosBuilder().raw(CMD.INIT).raw(CMD.CODEPAGE_CP437).raw(CMD.FONT_A);
}

/** Feed clear of the cutter, then partial-cut. */
export function finishReceipt(builder: EscPosBuilder): Uint8Array {
  return builder.raw(CMD.FEED_AND_CUT).build();
}
