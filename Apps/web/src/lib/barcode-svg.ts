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
    margin: QUIET_ZONE_MODULES * MODULE_PX, // the quiet zone JsBarcode does not add by default
    textMargin: 2,
  });
  // JsBarcode writes "0 0 <w> <h>"; w is (modules + 2 * quiet) * MODULE_PX.
  const viewBox = svg.getAttribute("viewBox") ?? "";
  const width = Number(viewBox.split(" ")[2] ?? 0);
  return { svg: svg.outerHTML, totalModules: width > 0 ? width / MODULE_PX : 0 };
}
