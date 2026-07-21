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
  onCreateNewProduct?: (name: string) => void;
}

// ADM-08 editor — one invoice line row: product/qty/unit cost/serials, with a live landed-
// unit-cost readout (per-line unit cost only here — the shipping-cost apportionment across all
// lines happens once at the footer level, computed from the full line set, not per-row).
export function InvoiceLineEditor({
  index,
  control,
  productOptions,
  quantity,
  unitCost,
  onRemove,
  onCreateNewProduct,
}: InvoiceLineEditorProps) {
  const { t } = useTranslation();
  const lineTotal = quantity * unitCost;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
      <Controller
        control={control}
        name={`lines.${index}.productId`}
        render={({ field }) => (
          <AutocompleteInput
            value={field.value ?? ""}
            onChange={field.onChange}
            suggestions={productOptions}
            placeholder={t("admin.supplierInvoices.editor.product")}
            onCreateNew={onCreateNewProduct}
            showCreateNew={!!onCreateNewProduct}
          />
        )}
      />
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
          />
        )}
      />
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
          />
        )}
      />
      <Controller
        control={control}
        name={`lines.${index}.serialNumbers`}
        render={({ field }) => (
          <Input {...field} placeholder={t("admin.supplierInvoices.editor.serialNumbers")} />
        )}
      />
      <div>
        <span className="text-xs text-muted-foreground">
          {t("admin.supplierInvoices.editor.subtotal")}
        </span>
        <div>{lineTotal.toLocaleString()}</div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
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
