import { useMemo } from "react";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { LABEL_ROOT_CLASS } from "@/lib/print";
import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
  type LabelSize,
} from "@/types/label-print.types";

export interface LabelSheetItem {
  barcode: string;
  quantity: number;
  topText?: string;
}

interface BarcodeLabelSheetProps {
  items: LabelSheetItem[];
  storeName?: string;
  size: LabelSize;
}

// S27 — replaces S26's server-side PDF (pdf.utils.ts's renderBarcodeLabelsPdf, now deleted). The
// geometry constants (padding, store column width, quiet zone) came from that file and are
// re-declared in types/label-print.types.ts so the printed label keeps the same layout the owner
// approved. Structurally identical to barcode-label.tsx's on-screen preview — the two must be
// kept in step — but this component renders ALL copies for a print run, not just one preview.
//
// The root is gated on `body.printing-labels` in index.css, exactly the way the receipt root is
// gated on `body.printing-receipt`: an ungated print rule is exactly the S22 finding F1
// regression (a label print rule that leaked into every other print in the app).
//
// Renders nothing on screen — `.label-print-root` is `display: none` outside a gated print, which
// index.css already guarantees. The dialogs keep their own <BarcodeLabel> preview.
export function BarcodeLabelSheet({ items, storeName, size }: BarcodeLabelSheetProps) {
  const trimmedStoreName = storeName?.trim();

  // Render each DISTINCT barcode once (a run may be up to BARCODE_LABEL_SHEET_MAX_TOTAL = 1000
  // labels; mounting 1000 JsBarcode effects would be slow enough to look like a hang). Rebuilt
  // only when the barcode set changes — the SVG is size-independent, CSS scales it.
  const barcodeIds = useMemo(() => Array.from(new Set(items.map((item) => item.barcode))), [items]);
  const svgByBarcode = useMemo(() => {
    const map = new Map<string, string>();
    for (const barcode of barcodeIds) {
      map.set(barcode, renderBarcodeSvg(barcode).svg);
    }
    return map;
  }, [barcodeIds]);

  return (
    <div className={LABEL_ROOT_CLASS}>
      {items.flatMap((item, index) =>
        Array.from({ length: item.quantity }, (_, copy) => {
          const svg = svgByBarcode.get(item.barcode) ?? "";
          const topText = item.topText?.trim();
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
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {topText ? (
                  <span
                    style={{
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
                {/* The SVG string is our own JsBarcode output (lib/barcode-svg.ts), never
                    user-supplied markup. */}
                <div
                  style={{ width: "100%", height: "auto" }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}
