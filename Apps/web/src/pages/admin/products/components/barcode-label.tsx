import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  /** S26 — optional, mirrors the printed label; absent means the column and its rule are not drawn. */
  storeName?: string;
  topText?: string;
}

// S19/S22/S26 — the on-screen *preview* of one printed label. The printed sheet is rendered
// server-side as a PDF (pdf.utils.ts's renderBarcodeLabelsPdf, PDFKit + bwip-js); this only has to
// look like it, so the two must be kept in step. Layout as of S26: 50 x 25 mm, an optional store
// name running bottom-to-top down a 6 mm left column, a vertical rule, then the optional caption,
// the symbol and its digits.
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the box without distorting the bar ratios. The
// box is forced black-on-white regardless of theme: JsBarcode draws black bars, and a dark-mode
// card behind them would preview unreadably.
export function BarcodeLabel({ value, storeName, topText }: BarcodeLabelProps) {
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
    <div className="flex h-[25mm] w-[50mm] items-stretch overflow-hidden border border-dashed border-black/40 bg-white p-[1mm] text-black">
      {storeName?.trim() ? (
        <>
          <div className="flex w-[6mm] shrink-0 items-center justify-center">
            {/* vertical-rl + rotate(180deg) is the standard bottom-to-top idiom; it matches the
                PDF's rotate(-90). truncate keeps a long name on one line, as fitText does server-side. */}
            <span
              className="max-h-full truncate text-[5pt] font-bold leading-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {storeName.trim()}
            </span>
          </div>
          <div className="mx-[0.5mm] w-px shrink-0 bg-black/70" />
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {topText?.trim() ? (
          <span className="truncate text-center text-[5pt] leading-none">{topText.trim()}</span>
        ) : null}
        <svg ref={svgRef} className="h-auto w-full" />
      </div>
    </div>
  );
}
