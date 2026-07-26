import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import type { SupplierInvoiceFormValues } from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface InvoiceHeaderFormProps {
  control: Control<SupplierInvoiceFormValues>;
  supplierOptions: AutocompleteOption[];
  disabled?: boolean;
}

// ADM-08 editor — header fields: supplier/reference/dates/shipping cost/note.
export function InvoiceHeaderForm({
  control,
  supplierOptions,
  disabled = false,
}: InvoiceHeaderFormProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label>{t("admin.supplierInvoices.editor.supplier")}</Label>
        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <AutocompleteInput
              value={field.value}
              onChange={field.onChange}
              suggestions={supplierOptions}
              disabled={disabled}
            />
          )}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="supplierReference">
          {t("admin.supplierInvoices.editor.supplierReference")}
        </Label>
        <Controller
          control={control}
          name="supplierReference"
          render={({ field }) => <Input id="supplierReference" {...field} disabled={disabled} />}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invoiceDate">{t("admin.supplierInvoices.editor.invoiceDate")}</Label>
        <Controller
          control={control}
          name="invoiceDate"
          render={({ field }) => (
            <Input id="invoiceDate" type="date" {...field} disabled={disabled} />
          )}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dueDate">{t("admin.supplierInvoices.editor.dueDate")}</Label>
        <Controller
          control={control}
          name="dueDate"
          render={({ field }) => <Input id="dueDate" type="date" {...field} disabled={disabled} />}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="shippingCost">{t("admin.supplierInvoices.editor.shippingCost")}</Label>
        <Controller
          control={control}
          name="shippingCost"
          render={({ field }) => (
            <Input
              id="shippingCost"
              type="number"
              min={0}
              step="0.01"
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))
              }
              disabled={disabled}
            />
          )}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="note">{t("admin.supplierInvoices.editor.note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => <Input id="note" {...field} disabled={disabled} />}
        />
      </div>
    </div>
  );
}
