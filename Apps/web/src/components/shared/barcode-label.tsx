import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeLabelProps {
  value: string;
  /** S26 — optional, mirrors the printed label; absent means the column and its rule are not drawn. */
  storeName?: string;
  topText?: string;
  /** S27.1 — stacked raw-text lines above the symbol (the repair client label: name, phone,
   *  device, problem). Mutually exclusive in practice with `topText`, which is the single
   *  centred caption the product/supplier labels use. */
  textLines?: string[];
  /** Repair label only — the bench sticker has no scanner in the loop, so it drops the Code 128
   *  symbol entirely and lets `textLines` use the full label height instead. Defaults to true so
   *  the product/supplier-invoice dialogs are unaffected. */
  showBarcode?: boolean;
}

// S19/S22/S26/S27 — the on-screen *preview* of one printed label. The printed sheet is now
// rendered in the browser too (components/shared/barcode-label-sheet.tsx, via
// lib/barcode-svg.ts's JsBarcode render — S27 deleted the S22/S26 server-side PDF renderer
// entirely), so this preview and the printed artefact share the same underlying symbol library;
// only the surrounding markup is duplicated, and the two must be kept in step.
//
// S27.1 — there is now a THIRD renderer of the same label: lib/zpl.ts, for the thermal path.
// All three must agree. This file moved out of pages/admin/products/components/ when the repair
// dialog (a staff page) started using it — a shared component cannot live inside another page's
// folder. Layout as of S26:
// 50 x 25 mm, an optional store name running bottom-to-top down a 6 mm left column, a vertical
// rule, then the optional caption, the symbol and its digits.
//
// Code 128 is the symbology: a generated barcode is 9 *alphanumeric* characters, which the
// fixed-length numeric symbologies (EAN-13, UPC) cannot encode. JsBarcode writes a `viewBox` onto
// the <svg>, so `w-full h-auto` scales the symbol to the box without distorting the bar ratios. The
// box is forced black-on-white regardless of theme: JsBarcode draws black bars, and a dark-mode
// card behind them would preview unreadably.
//
// This preview intentionally keeps `margin: 0` (no quiet zone) below — it is a visual reference at
// a fixed on-screen size, not a scan target. The printed label adds the real quiet zone via
// lib/barcode-svg.ts's `renderBarcodeSvg` (QUIET_ZONE_MODULES).
export function BarcodeLabel({
  value,
  storeName,
  topText,
  textLines,
  showBarcode = true,
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!showBarcode || !svgRef.current) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 48,
      width: 2,
      margin: 0,
      textMargin: 2,
    });
  }, [value, showBarcode]);

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
        {/* S27.1 — the text block is capped and clipped so it can never squeeze the symbol out of
            the label; the barcode keeps the remaining height. Mirrors barcode-label-sheet.tsx's
            own guard, which is the scan-safety floor rather than styling. */}
        {textLines && textLines.length > 0 ? (
          <div className={showBarcode ? "max-h-[55%] shrink overflow-hidden" : "overflow-hidden"}>
            {textLines.map((line, index) => (
              <div key={index} className="truncate text-[5pt] leading-[1.15]">
                {line}
              </div>
            ))}
          </div>
        ) : null}
        {showBarcode ? <svg ref={svgRef} className="h-auto w-full" /> : null}
      </div>
    </div>
  );
}
