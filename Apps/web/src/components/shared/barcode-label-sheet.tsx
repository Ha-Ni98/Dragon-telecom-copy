import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { getLabelPrintPortal } from "@/lib/print";
import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
  LABEL_TEXT_BLOCK_MAX_PCT,
  REPAIR_LABEL_LINE_HEIGHT,
  REPAIR_LABEL_TEXT_PT,
  type LabelSize,
} from "@/types/label-print.types";

export interface LabelSheetItem {
  barcode: string;
  quantity: number;
  topText?: string;
  /** S27.1 — stacked raw-text lines above the symbol, used by the repair client label (name,
   *  phone, device, problem). `topText` stays the single centred caption the product and
   *  supplier-invoice labels use; a caller supplies one or the other, not both. */
  textLines?: string[];
}

interface BarcodeLabelSheetProps {
  items: LabelSheetItem[];
  storeName?: string;
  size: LabelSize;
  /** Repair label only — drops the Code 128 symbol so `textLines` gets the full label height.
   *  Defaults to true so the product/supplier-invoice dialogs are unaffected. */
  showBarcode?: boolean;
}

// S27 — replaces S26's server-side PDF (pdf.utils.ts's renderBarcodeLabelsPdf, now deleted). The
// geometry constants (padding, store column width, quiet zone) came from that file and are
// re-declared in types/label-print.types.ts so the printed label keeps the same layout the owner
// approved. Structurally identical to barcode-label.tsx's on-screen preview — the two must be
// kept in step — but this component renders ALL copies for a print run, not just one preview.
//
// S27.1 — a THIRD renderer of the same label now exists, lib/zpl.ts, for the thermal path. All
// three must agree. This one is the browser-print fallback.
//
// Rendered via a React portal into lib/print.ts's getLabelPrintPortal() — a div appended directly
// to <body>, outside #root — rather than in place in the component tree. This is NOT the
// receipt's visibility + position:absolute masking technique: that approach broke multi-page
// printing outright (Chrome's print engine does not fragment a position:absolute box across
// physical pages, so a run of N labels printed only the first page and left N-1 blank — found by
// printing a real 14-label run). The portal lives in normal document flow, so index.css can hide
// #root wholesale and let native pagination tile the labels correctly. See lib/print.ts's comment
// for the full explanation; see index.css for the matching `#label-print-portal` rules.
export function BarcodeLabelSheet({
  items,
  storeName,
  size,
  showBarcode = true,
}: BarcodeLabelSheetProps) {
  const trimmedStoreName = storeName?.trim();

  // The portal target must exist before we can render into it; grabbing it in an effect (not
  // during render) keeps this a side-effect-free render like any other component. Idempotent —
  // getLabelPrintPortal() reuses the same node across every mount.
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalNode(getLabelPrintPortal());
  }, []);

  // Render each DISTINCT barcode once (a run may be up to BARCODE_LABEL_SHEET_MAX_TOTAL = 1000
  // labels; mounting 1000 JsBarcode effects would be slow enough to look like a hang). Rebuilt
  // only when the barcode set changes — the SVG is size-independent, CSS scales it.
  const barcodeIds = useMemo(() => Array.from(new Set(items.map((item) => item.barcode))), [items]);
  const svgByBarcode = useMemo(() => {
    const map = new Map<string, string>();
    if (!showBarcode) return map;
    for (const barcode of barcodeIds) {
      map.set(barcode, renderBarcodeSvg(barcode).svg);
    }
    return map;
  }, [barcodeIds, showBarcode]);

  if (!portalNode) return null;

  return createPortal(
    <div>
      {items.flatMap((item, index) =>
        Array.from({ length: item.quantity }, (_, copy) => {
          const svg = showBarcode ? (svgByBarcode.get(item.barcode) ?? "") : "";
          const topText = item.topText?.trim();
          const textLines = item.textLines?.filter((line) => line.trim() !== "") ?? [];
          return (
            <div
              key={`${index}-${copy}`}
              className="label-page"
              style={{
                width: `${size.widthMm}mm`,
                height: `${size.heightMm}mm`,
                padding: `${LABEL_PADDING_MM}mm`,
                boxSizing: "border-box",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {trimmedStoreName ? (
                <>
                  <div
                    style={{
                      width: `${LABEL_STORE_COLUMN_MM}mm`,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* vertical-rl + rotate(180deg) is the standard bottom-to-top idiom; matches
                        barcode-label.tsx's preview and the deleted PDF's rotate(-90). */}
                    <span
                      style={{
                        maxHeight: "100%",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        fontSize: "5pt",
                        fontWeight: 700,
                        lineHeight: 1,
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {trimmedStoreName}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "1px",
                      flexShrink: 0,
                      margin: `0 ${LABEL_STORE_GAP_MM}mm`,
                      background: "#000",
                    }}
                  />
                </>
              ) : null}

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {topText ? (
                  <span
                    style={{
                      flex: "0 0 auto",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontSize: "5pt",
                      lineHeight: 1,
                    }}
                  >
                    {topText}
                  </span>
                ) : null}

                {/* S27.1 — the repair label's raw-text block. `flex: 0 1 auto` + a maxHeight cap
                    (not `0 0 auto`) is load-bearing: it lets the block SHRINK rather than push the
                    symbol out of the label, so the barcode is structurally guaranteed the
                    remaining height at any label size. That is a scan-safety floor, not styling —
                    a clipped text line is recoverable, an unscannable barcode is not. */}
                {textLines.length > 0 ? (
                  <div
                    style={{
                      flex: showBarcode ? "0 1 auto" : "1 1 auto",
                      maxHeight: showBarcode ? `${LABEL_TEXT_BLOCK_MAX_PCT}%` : "100%",
                      overflow: "hidden",
                    }}
                  >
                    {textLines.map((line, lineIndex) => (
                      <div
                        key={lineIndex}
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontSize: `${REPAIR_LABEL_TEXT_PT}pt`,
                          lineHeight: REPAIR_LABEL_LINE_HEIGHT,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
                {/* flex:1 + minHeight:0 gives this wrapper a DEFINITE resolved height — required
                    for the injected <svg>'s own height:100% (set in lib/barcode-svg.ts) to mean
                    anything; height:"auto" here would leave the percentage with nothing to
                    resolve against, and the symbol would fall back to its native pixel size and
                    overflow the label. The SVG string is our own JsBarcode output
                    (lib/barcode-svg.ts), never user-supplied markup. */}
                {showBarcode ? (
                  <div
                    style={{ flex: "1 1 auto", minHeight: 0, width: "100%" }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : null}
              </div>
            </div>
          );
        }),
      )}
    </div>,
    portalNode,
  );
}
