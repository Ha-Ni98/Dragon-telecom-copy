import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Trash2, Plus } from "lucide-react";
import type { SupplierInvoiceFormValues } from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface InvoiceLineEditorProps {
  index: number;
  control: Control<SupplierInvoiceFormValues>;
  productOptions: AutocompleteOption[];
  quantity: number;
  unitCost: number;
  onRemove: () => void;
  /** Opens the quick-add-product dialog for this row (I5) — a button, not the autocomplete's
   *  own create-on-no-result, which this row no longer offers. */
  onQuickAddProduct?: () => void;
  /** The selected product's live stock figures, for the two helper texts under quantity (I6).
   *  Undefined until a product is picked, or when the product is outside the loaded page. */
  productStock?: { quantityOnHand: number; avgPrice: number };
  /** Read-only rows render this snapshot instead of a disabled autocomplete (I10) — the editor
   *  only loads the first page of products, so a confirmed invoice's product may fall outside
   *  it and render an empty box otherwise. */
  productNameSnapshot?: string;
  disabled?: boolean;
}

// ADM-08 editor — one invoice line row: product/qty/unit cost/serials, with a live landed-
// unit-cost readout (per-line unit cost only here — the shipping-cost apportionment across all
// lines happens once at the footer level, computed from the full line set, not per-row). S7:
// the product cell gains a quick-add button (I5) and drops create-on-no-result; read-only rows
// render the invoice's own productNameSnapshot instead of a disabled autocomplete (I10); two
// helper texts under quantity surface qty-in-stock and the unweighted avgPrice (I6).
export function InvoiceLineEditor({
  index,
  control,
  productOptions,
  quantity,
  unitCost,
  onRemove,
  onQuickAddProduct,
  productStock,
  productNameSnapshot,
  disabled = false,
}: InvoiceLineEditorProps) {
  const { t } = useTranslation();
  const lineTotal = quantity * unitCost;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
      {disabled ? (
        <div className="text-sm font-medium">
          {productNameSnapshot ?? t("admin.supplierInvoices.editor.unknownProduct")}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {onQuickAddProduct && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onQuickAddProduct}
              aria-label={t("admin.supplierInvoices.editor.quickAddProduct")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Controller
            control={control}
            name={`lines.${index}.productId`}
            render={({ field }) => (
              <AutocompleteInput
                inputId={`invoice-line-${index}-product`}
                value={field.value ?? ""}
                onChange={field.onChange}
                suggestions={productOptions}
                placeholder={t("admin.supplierInvoices.editor.product")}
                showCreateNew={false}
              />
            )}
          />
        </div>
      )}
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

export function AddLineButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      {t("admin.supplierInvoices.editor.addLine")}
    </Button>
  );
}
