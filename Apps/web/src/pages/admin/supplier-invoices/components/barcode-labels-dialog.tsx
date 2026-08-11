import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import {
  BARCODE_LABEL_MAX_QUANTITY,
  BARCODE_LABEL_SHEET_MAX_TOTAL,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useBarcodeLookup, usePrintBarcodeLabels } from "@/hooks/useCatalogProducts";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";

interface BarcodeLabelsDialogProps {
  invoice: SupplierInvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Same clamp rule as the products-list dialog: applied per keystroke so a mistyped extra digit is
// corrected in place, and a cleared field reads as NaN and falls back to 1.
const clampQuantity = (raw: number): number =>
  Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), BARCODE_LABEL_MAX_QUANTITY) : 1;

// S22 — every product line of one supplier invoice, one editable label count per line, defaulting
// to the quantity received. Lines whose product has no printable barcode are omitted entirely and
// reported as a count, so the absence is never silent (the same predicate runs server-side, so the
// note and the PDF can never disagree). Available on every invoice regardless of status: an
// amount-only invoice simply has no lines and shows the empty note.
export function BarcodeLabelsDialog({ invoice, open, onOpenChange }: BarcodeLabelsDialogProps) {
  const { t } = useTranslation();

  // Stable across renders so it can be a query key; invoice.lines is already in line order.
  const productIds = useMemo(() => invoice.lines.map((line) => line.productId), [invoice.lines]);
  const lookup = useBarcodeLookup(productIds, { enabled: open });
  const printLabels = usePrintBarcodeLabels();

  const barcodeByProduct = useMemo(
    () => new Map((lookup.data?.items ?? []).map((item) => [item.productId, item.barcode])),
    [lookup.data],
  );

  // One row per *line*, not per product — the same product on two lines is two rows with two
  // quantities, and the PDF keeps that order.
  const printableLines = useMemo(
    () =>
      invoice.lines.flatMap((line) => {
        const barcode = barcodeByProduct.get(line.productId);
        return barcode == null ? [] : [{ ...line, barcode }];
      }),
    [invoice.lines, barcodeByProduct],
  );
  const skippedCount = invoice.lines.length - printableLines.length;

  // Keyed by line id, seeded from the invoice quantity each time the dialog opens.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!open) return;
    setQuantities(
      Object.fromEntries(printableLines.map((line) => [line.id, clampQuantity(line.quantity)])),
    );
  }, [open, printableLines]);

  const totalLabels = printableLines.reduce(
    (sum, line) => sum + (quantities[line.id] ?? line.quantity),
    0,
  );
  const overLimit = totalLabels > BARCODE_LABEL_SHEET_MAX_TOTAL;

  const handlePrint = () => {
    printLabels.mutate(
      {
        items: printableLines.map((line) => ({
          productId: line.productId,
          quantity: quantities[line.id] ?? line.quantity,
        })),
      },
      {
        onSuccess: (blob) => {
          downloadBlob(`labels-${invoice.reference}.pdf`, blob);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.supplierInvoices.printLabels.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.supplierInvoices.printLabels.description")}
          </DialogDescription>
        </DialogHeader>

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

        <div className="space-y-1 text-xs text-muted-foreground">
          {skippedCount > 0 && (
            <p>{t("admin.supplierInvoices.printLabels.skipped", { count: skippedCount })}</p>
          )}
          {printableLines.length > 0 && (
            <p>{t("admin.supplierInvoices.printLabels.total", { count: totalLabels })}</p>
          )}
          {overLimit && (
            <p className="text-destructive">
              {t("admin.productsList.printLabels.tooMany", { max: BARCODE_LABEL_SHEET_MAX_TOTAL })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={handlePrint}
            disabled={printableLines.length === 0 || overLimit || printLabels.isPending}
          >
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
