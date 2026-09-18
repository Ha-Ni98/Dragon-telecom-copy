import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_SHEET_MAX_TOTAL,
  BARCODE_LABEL_TEXT_MAX,
  type SupplierInvoiceDto,
} from "@dragon-telecom/contract";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBarcodeLookup } from "@/hooks/useCatalogProducts";
import { usePlatformSettings } from "@/hooks/usePlatform";
import { useTranslation } from "@/hooks/useTranslation";
import { useLabelSize } from "@/hooks/use-label-size";
import { usePrinterMode, usePrintBridgeStatus } from "@/hooks/use-print-bridge";
import { printLabelSheet } from "@/lib/print";
import { bytesToBase64, newJobId, printOrFallback } from "@/lib/print-bridge";
import { buildZplBatch } from "@/lib/zpl";
import { PrinterModeField } from "@/components/shared/printer-mode-field";
import { renderBarcodeSvg } from "@/lib/barcode-svg";
import { BarcodeLabelSheet, type LabelSheetItem } from "@/components/shared/barcode-label-sheet";
import { LabelSizeField } from "@/components/shared/label-size-field";
import {
  LABEL_PADDING_MM,
  LABEL_STORE_COLUMN_MM,
  LABEL_STORE_GAP_MM,
} from "@/types/label-print.types";

interface BarcodeLabelsDialogProps {
  invoice: SupplierInvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same clamp rule as the products-list dialog: applied per keystroke so a mistyped extra digit is
// corrected in place, and a cleared field reads as NaN and falls back to 1.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// "Hamdid Teck" -> "HA". Diacritics are stripped and non-alphanumerics dropped before taking the
// first two characters, so "Élec-Tronique" gives "EL" rather than "ÉL" or "E-". Same normalisation
// idea as the api's barcodePrefix (S19), but with no padding: this is a display string, and a
// one-character supplier name should contribute one character, not an invented filler.
const supplierInitials = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip the combining marks NFD just split off
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

// S22 — every product line of one supplier invoice, one editable label count per line, defaulting
// to the quantity received. Lines whose product has no printable barcode are omitted entirely and
// reported as a count, so the absence is never silent (the same predicate runs server-side, so the
// note and the printed sheet can never disagree). Available on every invoice regardless of status:
// an amount-only invoice simply has no lines and shows the empty note.
//
// S26 — plus the two customizable texts. The store name is one field for the whole run (defaulting
// to the store name from settings followed by the supplier's initials, e.g. "Dragon Telecom HA");
// the caption above the bars is *per line*, defaulting to that line's own product model, because a
// single shared caption could only ever be right for one product on a multi-line invoice
// (owner decision Q2).
//
// S27 — printed directly via the browser's print dialog (lib/print.ts's printLabelSheet), not a
// server-side PDF download: this replaces the POST /admin/products/barcode-labels + downloadBlob
// flow, which is now deleted. Barcodes are still resolved server-side via useBarcodeLookup — only
// the rendering moved into the browser. <BarcodeLabelSheet> is a sibling of <Dialog>, and this
// dialog does NOT close itself after Print (window.print() is not reliably blocking — see
// lib/print.ts), so the print root stays mounted for as long as printing needs it; the admin
// closes the dialog manually via Cancel once done, exactly as before.
export function BarcodeLabelsDialog({ invoice, open, onOpenChange }: BarcodeLabelsDialogProps) {
  const { t } = useTranslation();

  // Stable across renders so it can be a query key; invoice.lines is already in line order.
  const productIds = useMemo(() => invoice.lines.map((line) => line.productId), [invoice.lines]);
  const lookup = useBarcodeLookup(productIds, { enabled: open });
  const [size, setSize] = useLabelSize();
  const [mode, setMode] = usePrinterMode();
  const { available: bridgeAvailable, labelDpi } = usePrintBridgeStatus();
  const [isPrinting, setIsPrinting] = useState(false);

  const settings = usePlatformSettings();
  // Both halves are optional: no settings yet, or a supplier whose name has no usable characters,
  // simply contributes nothing rather than a stray separator space.
  const defaultStoreName = [settings.data?.store.name, supplierInitials(invoice.supplierName)]
    .filter((part) => part != null && part !== "")
    .join(" ");

  // undefined = untouched, show the default (same reason as the products dialog: settings resolve
  // asynchronously, so seeding state from them would race the admin's typing).
  const [storeName, setStoreName] = useState<string | undefined>(undefined);
  const effectiveStoreName = storeName ?? defaultStoreName;
  const trimmedStoreName = effectiveStoreName.trim();

  // Per line, keyed by line id; a missing key means "untouched, use that product's model name".
  // Mirrors how `quantities` already defaults to the line's invoice quantity.
  const [topTexts, setTopTexts] = useState<Record<string, string>>({});

  const lookupByProduct = useMemo(
    () => new Map((lookup.data?.items ?? []).map((item) => [item.productId, item])),
    [lookup.data],
  );

  // One row per *line*, not per product — the same product on two lines is two rows with two
  // quantities and two captions, and the printed sheet keeps that order.
  const printableLines = useMemo(
    () =>
      invoice.lines.flatMap((line) => {
        const found = lookupByProduct.get(line.productId);
        return found == null
          ? []
          : [{ ...line, barcode: found.barcode, modelName: found.modelName ?? "" }];
      }),
    [invoice.lines, lookupByProduct],
  );
  const skippedCount = invoice.lines.length - printableLines.length;

  // Keyed by line id, seeded from the invoice quantity each time the dialog opens.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open) return;
    setQuantities(
      Object.fromEntries(printableLines.map((line) => [line.id, clampQuantity(line.quantity)])),
    );
    setTopTexts({});
    setStoreName(undefined);
  }, [open, printableLines]);

  const totalLabels = printableLines.reduce(
    (sum, line) => sum + (quantities[line.id] ?? line.quantity),
    0,
  );
  const overLimit = totalLabels > BARCODE_LABEL_SHEET_MAX_TOTAL;

  const printItems: LabelSheetItem[] = useMemo(
    () =>
      printableLines.map((line) => {
        const caption = (topTexts[line.id] ?? line.modelName).trim();
        return {
          barcode: line.barcode,
          quantity: quantities[line.id] ?? line.quantity,
          ...(caption !== "" ? { topText: caption } : {}),
        };
      }),
    [printableLines, topTexts, quantities],
  );

  // Narrowest barcode area across the run drives the scan-floor warning — if the densest label
  // in the batch is fine, every shorter one is too (a longer value only ever narrows the bars
  // further at a fixed label width).
  const moduleMm = useMemo(() => {
    if (printableLines.length === 0) return undefined;
    const barcodeAreaMm =
      size.widthMm -
      LABEL_PADDING_MM * 2 -
      (trimmedStoreName !== "" ? LABEL_STORE_COLUMN_MM + LABEL_STORE_GAP_MM : 0);
    const modulesPerLine = printableLines.map(
      (line) => renderBarcodeSvg(line.barcode).totalModules,
    );
    const maxModules = Math.max(...modulesPerLine, 0);
    return maxModules > 0 ? barcodeAreaMm / maxModules : undefined;
  }, [printableLines, size, trimmedStoreName]);

  // S27.1 — thermal first, browser fallback. The early return is deliberately synchronous:
  // `window.print()` after an `await` leaves the user-gesture task.
  //
  // One POST for the whole invoice: buildZplBatch emits one ^XA…^XZ block per line, each with its
  // own ^PQ, so a 14-line invoice is a single job rather than fourteen round-trips.
  const handlePrint = async () => {
    const browserFallback = () => printLabelSheet(size.widthMm, size.heightMm);

    if (mode === "browser" || bridgeAvailable !== true) {
      browserFallback();
      return;
    }

    setIsPrinting(true);
    try {
      const zpl = buildZplBatch(
        printItems.map((item) => ({
          barcode: item.barcode,
          totalModules: renderBarcodeSvg(item.barcode).totalModules,
          widthMm: size.widthMm,
          heightMm: size.heightMm,
          copies: item.quantity,
          dpi: labelDpi,
          ...(item.topText != null && item.topText !== "" ? { topText: item.topText } : {}),
          ...(trimmedStoreName !== "" ? { storeName: trimmedStoreName } : {}),
        })),
      );
      const outcome = await printOrFallback(
        {
          jobId: newJobId(),
          target: "label",
          language: "ZPL",
          encoding: "base64",
          payload: bytesToBase64(new TextEncoder().encode(zpl)),
          // ^PQ inside each block already carries the per-line count; the helper must send a ZPL
          // payload exactly once.
          copies: 1,
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("admin.supplierInvoices.printLabels.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.supplierInvoices.printLabels.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label htmlFor="invoice-label-store-name">
              {t("admin.supplierInvoices.printLabels.storeNameLabel")}
            </Label>
            <Input
              id="invoice-label-store-name"
              maxLength={BARCODE_LABEL_TEXT_MAX}
              value={effectiveStoreName}
              onChange={(event) => setStoreName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.supplierInvoices.printLabels.storeNameHelper")}
            </p>
          </div>

          {lookup.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : lookup.isError ? (
            <p className="text-sm text-destructive">
              {t("admin.supplierInvoices.printLabels.loadError")}
            </p>
          ) : printableLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.supplierInvoices.printLabels.none")}
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.supplierInvoices.printLabels.columnProduct")}</TableHead>
                    <TableHead>{t("admin.supplierInvoices.printLabels.columnBarcode")}</TableHead>
                    <TableHead>{t("admin.supplierInvoices.printLabels.columnTopText")}</TableHead>
                    <TableHead className="w-28">
                      {t("admin.supplierInvoices.printLabels.columnQuantity")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printableLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{line.productNameSnapshot}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {line.barcode}
                      </TableCell>
                      <TableCell>
                        <Input
                          maxLength={BARCODE_LABEL_TEXT_MAX}
                          value={topTexts[line.id] ?? line.modelName}
                          onChange={(event) =>
                            setTopTexts((prev) => ({ ...prev, [line.id]: event.target.value }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={BARCODE_LABEL_MAX_QUANTITY}
                          value={quantities[line.id] ?? line.quantity}
                          onChange={(event) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [line.id]: clampQuantity(Number(event.target.value)),
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <LabelSizeField value={size} onChange={setSize} moduleMm={moduleMm} />

          <PrinterModeField value={mode} onChange={setMode} bridgeAvailable={bridgeAvailable} />

          <div className="space-y-1 text-xs text-muted-foreground">
            {skippedCount > 0 && (
              <p>{t("admin.supplierInvoices.printLabels.skipped", { count: skippedCount })}</p>
            )}
            {printableLines.length > 0 && (
              <p>{t("admin.supplierInvoices.printLabels.total", { count: totalLabels })}</p>
            )}
            {overLimit && (
              <p className="text-destructive">
                {t("admin.productsList.printLabels.tooMany", {
                  max: BARCODE_LABEL_SHEET_MAX_TOTAL,
                })}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              onClick={handlePrint}
              disabled={printableLines.length === 0 || overLimit || isPrinting}
            >
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
