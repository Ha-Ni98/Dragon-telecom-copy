import JsBarcode from "jsbarcode";
import { QUIET_ZONE_MODULES } from "@/types/label-print.types";

// Internal coordinate unit. Only ratios matter — the <svg> is scaled by CSS to the label — so this
// is arbitrary; 2 keeps the viewBox numbers small and integral.
const MODULE_PX = 2;

export interface RenderedBarcode {
  /** <svg> markup, ready for dangerouslySetInnerHTML. */
  svg: string;
  /** Total modules INCLUDING both quiet zones — what the label's width must be divided by to get
   *  the printed millimetres per module. */
  totalModules: number;
}

// S27 — replaces S26's server-side bwip-js render. Renders into a detached element, so nothing is
// mounted and the same string can back N identical labels.
export function renderBarcodeSvg(value: string): RenderedBarcode {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    displayValue: true, // the human-readable value is part of the SVG, so it scales with it
    fontSize: 14,
    height: 48,
    width: MODULE_PX,
    // Quiet zone belongs on the left/right only ("leaving a quiet zone on both sides" — brief).
    // The generic `margin` option pads all four sides equally, which wasted vertical room the
    // label has none of to spare and left less height for the caption above the bars.
    marginLeft: QUIET_ZONE_MODULES * MODULE_PX,
    marginRight: QUIET_ZONE_MODULES * MODULE_PX,
    marginTop: 0,
    marginBottom: 0,
    textMargin: 2,
  });
  // JsBarcode writes "0 0 <w> <h>"; w is (modules + 2 * quiet) * MODULE_PX.
  const viewBox = svg.getAttribute("viewBox") ?? "";
  const width = Number(viewBox.split(" ")[2] ?? 0);

  // JsBarcode also writes fixed pixel `width`/`height` attributes on the <svg> itself. Those
  // attributes override any CSS placed on a *wrapping* element, so without this the symbol always
  // rendered at its own native size (tens of mm) regardless of the label's real physical
  // dimensions — badly overflowing a 50x25mm (or smaller) label and getting clipped by
  // `.label-page`'s `overflow: hidden`. Replacing them with percentages, plus a non-uniform
  // `preserveAspectRatio`, makes the symbol fill exactly whatever box the caller gives it: a
  // barcode's decodability depends only on the horizontal bar-width ratios, so a uniform vertical
  // stretch (or squash) is harmless, and filling the assigned area is exactly what a label needs.
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");

  return { svg: svg.outerHTML, totalModules: width > 0 ? width / MODULE_PX : 0 };
}
