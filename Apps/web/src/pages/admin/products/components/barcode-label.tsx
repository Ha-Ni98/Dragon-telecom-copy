import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
}

// S19 — one 40 x 25 mm label (owner decision Q4: the symbol and its digits, nothing else — no
// product name, no price; a price would be stale the moment pricing changed and is not the price
// an approved client sees anyway).
//
// S22 — this is the on-screen *preview* only. The printed sheet is rendered server-side as a PDF
// (pdf.utils.ts's renderBarcodeLabelsPdf, PDFKit + bwip-js) so the products list and the supplier
// invoice produce identical labels; keep the two in step if either changes.
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the label box without distorting the bar
// ratios. The box is forced black-on-white regardless of theme: JsBarcode draws black bars, and a
// dark-mode card behind them would preview unreadably.
export function BarcodeLabel({ value }: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 48,
      width: 2,
      margin: 0,
      textMargin: 2,
    });
  }, [value]);

  return (
    <div className="flex h-[25mm] w-[40mm] items-center justify-center overflow-hidden border border-dashed border-black/40 bg-white p-[1mm] text-black">
      <svg ref={svgRef} className="h-auto w-full" />
    </div>
  );
}
