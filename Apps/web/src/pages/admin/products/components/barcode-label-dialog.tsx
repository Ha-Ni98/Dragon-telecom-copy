import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
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
import { usePrintBarcodeLabels } from "@/hooks/useCatalogProducts";
import { usePlatformSettings } from "@/hooks/usePlatform";
import { downloadBlob } from "@/lib/utils";
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

// S22 — the sheet is a server-side PDF now (POST /admin/products/barcode-labels, PDFKit + bwip-js),
// not a hidden print portal: both this dialog and the supplier-invoice one post to the same
// endpoint, so the two entry points cannot produce different labels. The on-screen <BarcodeLabel>
// below is a preview only — it renders through jsbarcode in the browser and never reaches the PDF.
// Confirming downloads the file, matching every other PDF in the app (InvoiceDetail.tsx).
//
// S26 — the label also carries an optional store name (vertical, left column) and an optional
// caption above the bars. Both are seeded from data (settings / the product's model) but are the
// admin's to edit, so what is sent is exactly what the field shows — see the `?? default` reads
// below, which is why an untouched field is `undefined` rather than pre-filled state.
export function BarcodeLabelDialog({ product, open, onOpenChange }: BarcodeLabelDialogProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const printLabels = usePrintBarcodeLabels();

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

  // A product with no barcode has nothing to encode; the list already renders its action disabled,
  // this is the matching guard.
  if (!product?.barcode) return null;
  const barcode = product.barcode;

  const handlePrint = () => {
    if (!product) return;
    printLabels.mutate(
      {
        ...(effectiveStoreName.trim() !== "" ? { storeName: effectiveStoreName.trim() } : {}),
        items: [
          {
            productId: product.id,
            quantity,
            ...(effectiveTopText.trim() !== "" ? { topText: effectiveTopText.trim() } : {}),
          },
        ],
      },
      {
        onSuccess: (blob) => {
          downloadBlob(`labels-${barcode}.pdf`, blob);
          onOpenChange(false);
        },
      },
    );
  };

  return (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={handlePrint} disabled={printLabels.isPending}>
            <Printer className="mr-2 h-4 w-4" />
            {printLabels.isPending
              ? t("admin.productsList.printLabels.generating")
              : t("admin.productsList.printLabels.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
