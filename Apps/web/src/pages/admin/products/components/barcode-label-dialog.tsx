import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_TEXT_MAX,
  type AdminProductDto,
} from "@dragon-telecom/contract";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformSettings } from "@/hooks/usePlatform";
import { useLabelSize } from "@/hooks/use-label-size";
import { usePrinterMode, usePrintBridgeStatus } from "@/hooks/use-print-bridge";
import { printLabelSheet } from "@/lib/print";
import { bytesToBase64, newJobId, printOrFallback } from "@/lib/print-bridge";
import { buildLabel } from "@/lib/label-language";
import { PrinterModeField } from "@/components/shared/printer-mode-field";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { BarcodeLabel } from "@/components/shared/barcode-label";
import { BarcodeLabelSheet, type LabelSheetItem } from "@/components/shared/barcode-label-sheet";
import { LabelSizeField } from "@/components/shared/label-size-field";
import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
} from "@/types/label-print.types";

interface BarcodeLabelDialogProps {
  /** null when no row has been picked — the dialog owns no product of its own. */
  product: AdminProductDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Clamped on every keystroke rather than on submit: an accidental extra digit would otherwise
// render tens of thousands of SVG symbols and freeze the tab before Print was ever pressed. A
// cleared field reads as NaN and falls back to 1.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S27 — the label sheet is printed directly via the browser's print dialog (lib/print.ts's
// printLabelSheet), not a server-side PDF download: this replaces S22/S26's
// POST /admin/products/barcode-labels + downloadBlob flow entirely, which is now deleted. The
// on-screen <BarcodeLabel> below stays a preview; the actual printed artefact is
// <BarcodeLabelSheet>, rendered as a sibling of <Dialog> (not inside <DialogContent>, whose Radix
// portal/transform would become the containing block for the sheet's `position: absolute` print
// rule and clip it — the same trap S25 documented when placing <RepairReceipt> outside <Sheet>).
//
// This dialog deliberately does NOT close itself after Print: window.print() is not reliably
// blocking across browsers (see lib/print.ts), and unmounting the print root mid-print would risk
// a blank page. The admin closes the dialog manually via Cancel once printing is done, exactly as
// they already could before pressing Print.
//
// S26 — the label also carries an optional store name (vertical, left column) and an optional
// caption above the bars. Both are seeded from data (settings / the product's model) but are the
// admin's to edit, so what is sent is exactly what the field shows — see the `?? default` reads
// below, which is why an untouched field is `undefined` rather than pre-filled state.
export function BarcodeLabelDialog({ product, open, onOpenChange }: BarcodeLabelDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useLabelSize();
  const [mode, setMode] = usePrinterMode();
  const { available: bridgeAvailable, labelDpi, labelLanguage } = usePrintBridgeStatus();
  const [isPrinting, setIsPrinting] = useState(false);

  const settings = usePlatformSettings();
  const defaultStoreName = settings.data?.store.name ?? "";
  const defaultTopText = product?.model?.name ?? "";

  // `undefined` means "untouched, show the default" — deliberately not pre-filled state seeded by
  // an effect. Settings arrive asynchronously, and a seeded field would either overwrite what the
  // admin just typed or freeze an empty default in place if the query resolved late.
  const [storeName, setStoreName] = useState<string | undefined>(undefined);
  const [topText, setTopText] = useState<string | undefined>(undefined);

  const effectiveStoreName = storeName ?? defaultStoreName;
  const effectiveTopText = topText ?? defaultTopText;

  // Re-seed from the product's on-hand stock each time the dialog opens — one label per unit in
  // stock is the common case. A product with zero stock still gets a printable single label rather
  // than an empty sheet. The two texts return to "untouched" so they pick their defaults up again.
  useEffect(() => {
    if (open && product) {
      setQuantity(clampQuantity(product.quantityOnHand));
      setStoreName(undefined);
      setTopText(undefined);
    }
  }, [open, product]);

  const barcode = product?.barcode;
  const trimmedStoreName = effectiveStoreName.trim();

  const printItems: LabelSheetItem[] = useMemo(
    () =>
      barcode
        ? [
            {
              barcode,
              quantity,
              ...(effectiveTopText.trim() !== "" ? { topText: effectiveTopText.trim() } : {}),
            },
          ]
        : [],
    [barcode, quantity, effectiveTopText],
  );

  // Millimetres per barcode module at the current size — drives LabelSizeField's scan-floor
  // warning. Same geometry the printed label uses: the barcode area is the label width minus
  // padding minus the optional store column, and moduleMm is that width divided by the symbol's
  // total module count (bars + both quiet zones).
  const totalModules = useMemo(
    () => (barcode ? renderBarcodeSvg(barcode).totalModules : 0),
    [barcode],
  );
  const moduleMm = useMemo(() => {
    if (totalModules === 0) return undefined;
    const barcodeAreaMm =
      size.widthMm -
      LABEL_PADDING_MM * 2 -
      (trimmedStoreName !== "" ? LABEL_STORE_COLUMN_MM + LABEL_STORE_GAP_MM : 0);
    return barcodeAreaMm / totalModules;
  }, [size, trimmedStoreName, totalModules]);

  // A product with no barcode has nothing to encode; the list already renders its action disabled,
  // this is the matching guard.
  if (!barcode) return null;

  // S27.1 — thermal first, browser fallback. The early return is deliberately synchronous:
  // `window.print()` after an `await` leaves the user-gesture task, so the common "no thermal
  // printing here" cases must reach it without awaiting anything.
  const handlePrint = async () => {
    const browserFallback = () => printLabelSheet(size.widthMm, size.heightMm);

    if (mode === "browser" || bridgeAvailable !== true) {
      browserFallback();
      return;
    }

    setIsPrinting(true);
    try {
      const labelBytes = buildLabel(labelLanguage, {
        barcode,
        totalModules,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        copies: quantity,
        dpi: labelDpi,
        ...(effectiveTopText.trim() !== "" ? { topText: effectiveTopText.trim() } : {}),
        ...(trimmedStoreName !== "" ? { storeName: trimmedStoreName } : {}),
      });
      const outcome = await printOrFallback(
        {
          jobId: newJobId(),
          target: "label",
          language: labelLanguage,
          encoding: "base64",
          payload: bytesToBase64(new TextEncoder().encode(labelBytes)),
          copies: quantity,
        },
        browserFallback,
      );
      if (outcome === "bridge") toast.success(t("common.print.bridge.sent"));
      else toast.warning(t("common.print.bridge.fallback"));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.productsList.printLabels.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("admin.productsList.printLabels.preview")}</Label>
              <div className="flex justify-center">
                <BarcodeLabel
                  value={barcode}
                  storeName={effectiveStoreName}
                  topText={effectiveTopText}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="label-store-name">
                {t("admin.productsList.printLabels.storeNameLabel")}
              </Label>
              <Input
                id="label-store-name"
                maxLength={BARCODE_LABEL_TEXT_MAX}
                value={effectiveStoreName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.storeNameHelper")}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="label-top-text">
                {t("admin.productsList.printLabels.topTextLabel")}
              </Label>
              <Input
                id="label-top-text"
                maxLength={BARCODE_LABEL_TEXT_MAX}
                value={effectiveTopText}
                onChange={(event) => setTopText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.topTextHelper")}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="label-quantity">
                {t("admin.productsList.printLabels.quantityLabel")}
              </Label>
              <Input
                id="label-quantity"
                type="number"
                min={1}
                max={BARCODE_LABEL_MAX_QUANTITY}
                value={quantity}
                onChange={(event) => setQuantity(clampQuantity(Number(event.target.value)))}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.productsList.printLabels.quantityHelper", {
                  max: BARCODE_LABEL_MAX_QUANTITY,
                })}
              </p>
            </div>

            <LabelSizeField value={size} onChange={setSize} moduleMm={moduleMm} />

            <PrinterModeField value={mode} onChange={setMode} bridgeAvailable={bridgeAvailable} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={handlePrint} disabled={isPrinting}>
              <Printer className="mr-2 h-4 w-4" />
              {t("admin.productsList.printLabels.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeLabelSheet items={printItems} storeName={effectiveStoreName} size={size} />
    </>
  );
}
