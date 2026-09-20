import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { BARCODE_LABEL_MAX_QUANTITY, type RepairDto } from "@dragon-telecom/contract";
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
import { BarcodeLabel } from "@/components/shared/barcode-label";
import { BarcodeLabelSheet, type LabelSheetItem } from "@/components/shared/barcode-label-sheet";
import { LabelSizeField } from "@/components/shared/label-size-field";
import { PrinterModeField } from "@/components/shared/printer-mode-field";
import { useTranslation } from "@/hooks/useTranslation";
import { useLabelSize } from "@/hooks/use-label-size";
import { usePrinterMode, usePrintBridgeStatus } from "@/hooks/use-print-bridge";
import { printLabelSheet } from "@/lib/print";
import { bytesToBase64, newJobId, printOrFallback } from "@/lib/print-bridge";
import { buildLabel } from "@/lib/label-language";
import { buildRepairLabelLines } from "@/pages/staff/repairs/repair-label-lines";
import { REPAIR_LABEL_SIZE_STORAGE_KEY } from "@/types/label-print.types";

interface RepairLabelDialogProps {
  repair: RepairDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same per-keystroke clamp the two catalog label dialogs use, for the same reason: a mistyped
// extra digit would otherwise materialise tens of thousands of label pages before Print is pressed.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S27.1 — the repair client label: the client and device details as raw text lines, to stick on
// the device on the bench.
//
// NO BARCODE. The sticker only needs to be human-readable at the bench, not scanned, so the
// reference and intake date/time are printed as plain text lines (via buildRepairLabelLines)
// instead of riding along in a Code 128 symbol. That also means there is no module-width
// arithmetic here, unlike the two catalog label dialogs — the label's own size picker is a plain
// physical-stock choice, with no scan-floor warning to feed it.
//
// Like both catalog label dialogs, this does NOT self-close after Print: window.print() is not
// reliably blocking, and unmounting the print root mid-print risks a blank page.
export function RepairLabelDialog({ repair, open, onOpenChange }: RepairLabelDialogProps) {
  const { t, language } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  // Its own storage key: a bench label is different physical stock from the product labels at the
  // counter, so the two sizes are remembered independently.
  const [size, setSize] = useLabelSize(REPAIR_LABEL_SIZE_STORAGE_KEY);
  const [mode, setMode] = usePrinterMode();
  const { available: bridgeAvailable, labelDpi, labelLanguage } = usePrintBridgeStatus();
  const [isPrinting, setIsPrinting] = useState(false);

  const textLines = useMemo(
    () => buildRepairLabelLines(repair, t, language),
    [repair, t, language],
  );

  const printItems: LabelSheetItem[] = useMemo(
    () => [{ barcode: repair.reference, quantity, textLines }],
    [repair.reference, quantity, textLines],
  );

  const handlePrint = async () => {
    const browserFallback = () => printLabelSheet(size.widthMm, size.heightMm);

    // Synchronous paths first — `window.print()` called after an `await` is no longer in the
    // user-gesture task, which some browsers' pop-up/print heuristics dislike. Every common
    // "no thermal printing here" case resolves without awaiting anything.
    if (mode === "browser" || bridgeAvailable !== true) {
      browserFallback();
      return;
    }

    setIsPrinting(true);
    try {
      const labelBytes = buildLabel(labelLanguage, {
        barcode: repair.reference,
        totalModules: 0,
        showBarcode: false,
        textLines,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        copies: quantity,
        dpi: labelDpi,
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
      // The thermal path is silent by nature — no dialog opens — so without this the operator
      // cannot tell a successful print from a dead button, and presses again.
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
            <DialogTitle>{t("staff.repairs.label.dialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("staff.repairs.label.preview")}</Label>
              <div className="flex justify-center">
                <BarcodeLabel value={repair.reference} textLines={textLines} showBarcode={false} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="repair-label-quantity">
                {t("staff.repairs.label.quantityLabel")}
              </Label>
              <Input
                id="repair-label-quantity"
                type="number"
                min={1}
                max={BARCODE_LABEL_MAX_QUANTITY}
                value={quantity}
                onChange={(event) => setQuantity(clampQuantity(Number(event.target.value)))}
              />
            </div>

            {/* LabelSizeField hardcodes its element ids, so it must never be mounted twice at
                once. Safe here: this dialog lives on /staff/repairs and /admin/repairs, the two
                catalog label dialogs on products and supplier-invoices — never the same screen. */}
            <LabelSizeField value={size} onChange={setSize} />

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

      <BarcodeLabelSheet items={printItems} size={size} showBarcode={false} />
    </>
  );
}
