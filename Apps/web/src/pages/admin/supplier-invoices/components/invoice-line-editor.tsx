import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { SupplierInvoiceFormValues } from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface InvoiceLineEditorProps {
  index: number;
  control: Control<SupplierInvoiceFormValues>;
  quantity: number;
  unitCost: number;
  onRemove: () => void;
  /** The picked product's stock figures, for the two helper texts under quantity (I6). Known for
   *  lines picked in this session; undefined on a saved invoice's own lines. */
  productStock?: { quantityOnHand: number; avgPrice: number };
  /** S31 — the line's product name: from the product picked in this session, or the invoice's own
   *  productNameSnapshot on a saved invoice (I10's reason still applies — the editor never loads
   *  the whole catalog, so the snapshot is the only reliable name for a saved line). */
  productName?: string;
  disabled?: boolean;
}

// ADM-08 editor — one invoice line row: product/qty/unit cost/serials, with a live landed-
// unit-cost readout (per-line unit cost only here — the shipping-cost apportionment across all
// lines happens once at the footer level, computed from the full line set, not per-row). S31 —
// the product is chosen only through InvoiceProductPickerDialog, so the per-row autocomplete and
// the per-row quick-add (S7 I5, now in the picker's footer) are gone: the product cell just shows
// the line's product name (I10). To change a line's product, remove the line and pick again. Two
// helper texts under quantity surface qty-in-stock and the unweighted avgPrice (I6).
export function InvoiceLineEditor({
  index,
  control,
  quantity,
  unitCost,
  onRemove,
  productStock,
  productName,
  disabled = false,
}: InvoiceLineEditorProps) {
  const { t } = useTranslation();
  const lineTotal = quantity * unitCost;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
      <div className="self-center text-sm font-medium">
        {productName ?? t("admin.supplierInvoices.editor.unknownProduct")}
      </div>
      <div className="space-y-1">
        <Controller
          control={control}
          name={`lines.${index}.quantity`}
          render={({ field }) => (
            <Input
              type="number"
              min={1}
              value={field.value ?? 1}
              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
              placeholder={t("admin.supplierInvoices.editor.quantity")}
              disabled={disabled}
            />
          )}
        />
        {productStock && (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>
              {t("admin.supplierInvoices.editor.qtyInStock", { qty: productStock.quantityOnHand })}
            </p>
            <p>
              {t("admin.supplierInvoices.editor.avgPriceHint", {
                price: productStock.avgPrice.toLocaleString(),
              })}
            </p>
          </div>
        )}
      </div>
      <Controller
        control={control}
        name={`lines.${index}.unitCost`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={field.value ?? 0}
            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            placeholder={t("admin.supplierInvoices.editor.unitCost")}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name={`lines.${index}.serialNumbers`}
        render={({ field }) => (
          <Input
            {...field}
            placeholder={t("admin.supplierInvoices.editor.serialNumbers")}
            disabled={disabled}
          />
        )}
      />
      <div>
        <span className="text-xs text-muted-foreground">
          {t("admin.supplierInvoices.editor.subtotal")}
        </span>
        <div>{lineTotal.toLocaleString()}</div>
      </div>
      {!disabled && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
