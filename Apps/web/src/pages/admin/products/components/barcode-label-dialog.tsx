import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { BARCODE_LABEL_MAX_QUANTITY, type AdminProductDto } from "@dragon-telecom/contract";
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
import { BarcodeLabel } from "@/pages/admin/products/components/barcode-label";

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

// S19 — the print sheet is portalled to <body> as #barcode-print-root and is display:none on
// screen; the `@media print` rule in index.css hides every *other* direct child of <body> (the app
// root, and Radix's dialog portals, which are body children too) and shows only the sheet. That is
// why the sheet lives outside <DialogContent>: nested inside it, the dialog's own fixed positioning
// and max-height would clip the page at one screenful of labels.
export function BarcodeLabelDialog({ product, open, onOpenChange }: BarcodeLabelDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);

  // Re-seed from the product's on-hand stock each time the dialog opens — one label per unit in
  // stock is the common case. A product with zero stock still gets a printable single label rather
  // than an empty sheet.
  useEffect(() => {
    if (open && product) setQuantity(clampQuantity(product.quantityOnHand));
  }, [open, product]);

  // A product with no barcode has nothing to encode; the list already renders its action disabled,
  // this is the matching guard.
  if (!product?.barcode) return null;
  const barcode = product.barcode;

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
                <BarcodeLabel value={barcode} />
              </div>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("admin.productsList.printLabels.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open &&
        createPortal(
          <div id="barcode-print-root" className="hidden">
            <div className="flex flex-wrap gap-[2mm]">
              {Array.from({ length: quantity }, (_, index) => (
                <BarcodeLabel key={index} value={barcode} />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
