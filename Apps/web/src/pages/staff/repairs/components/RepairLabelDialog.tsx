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
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { printLabelSheet } from "@/lib/print";
import { bytesToBase64, newJobId, printOrFallback } from "@/lib/print-bridge";
import { buildZplLabel } from "@/lib/zpl";
import { buildRepairLabelLines } from "@/pages/staff/repairs/repair-label-lines";
import { LABEL_PADDING_MM, REPAIR_LABEL_SIZE_STORAGE_KEY } from "@/types/label-print.types";

interface RepairLabelDialogProps {
  repair: RepairDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same per-keystroke clamp the two catalog label dialogs use, for the same reason: a mistyped
// extra digit would otherwise materialise tens of thousands of label pages before Print is pressed.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S27.1 — the repair client label: a Code 128 of the repair reference plus the client and device
// details as raw text lines, to stick on the device on the bench.
//
// NO STORE COLUMN, and that is arithmetic rather than taste. A reference is 13 characters
// (`REP-2026-0001`), which is 187-198 Code 128 modules including both quiet zones. On a 50 mm
// label the 6 mm store column + 0.5 mm gap would leave 41.5 mm of barcode area = 0.21-0.22 mm per
// module, well under the 0.25 mm scanning floor this project records in BARCODE_MIN_MODULE_MM.
// Without the column it is 48 mm = 0.24-0.26 mm, which clears the floor. So the column is not
// optional here — passing a storeName would make the label unscannable.
//
// It also means the label's own size picker matters more than usual: `moduleMm` below feeds
// LabelSizeField's existing sub-floor warning, and 40 mm stock will (correctly) trip it.
//
// Like both catalog label dialogs, this does NOT self-close after Print: window.print() is not
// reliably blocking, and unmounting the print root mid-print risks a blank page.
export function RepairLabelDialog({ repair, open, onOpenChange }: RepairLabelDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  // Its own storage key: a bench label is different physical stock from the product labels at the
  // counter, so the two sizes are remembered independently.
  const [size, setSize] = useLabelSize(REPAIR_LABEL_SIZE_STORAGE_KEY);
  const [mode, setMode] = usePrinterMode();
  const { available: bridgeAvailable, labelDpi } = usePrintBridgeStatus();
  const [isPrinting, setIsPrinting] = useState(false);

  const textLines = useMemo(() => buildRepairLabelLines(repair, t), [repair, t]);

  const rendered = useMemo(() => renderBarcodeSvg(repair.reference), [repair.reference]);

  // No store-column term — the only difference from the two catalog dialogs' identical formula.
  const moduleMm = useMemo(() => {
    if (rendered.totalModules === 0) return undefined;
    return (size.widthMm - LABEL_PADDING_MM * 2) / rendered.totalModules;
  }, [size, rendered.totalModules]);

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
      const zpl = buildZplLabel({
        barcode: repair.reference,
        totalModules: rendered.totalModules,
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
          language: "ZPL",
          encoding: "base64",
          payload: bytesToBase64(new TextEncoder().encode(zpl)),
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
                <BarcodeLabel value={repair.reference} textLines={textLines} />
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

      <BarcodeLabelSheet items={printItems} size={size} />
    </>
  );
}
