import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { SupplierInvoiceFormValues } from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface AmountOnlySwitchProps {
  control: Control<SupplierInvoiceFormValues>;
  isAmountOnly: boolean;
  setValue: UseFormSetValue<SupplierInvoiceFormValues>;
  disabled?: boolean;
}

// ADM-08 editor — collapses the line editor to one amount field. Toggling clears the other
// mode's value so the schema's amountOnly-XOR-lines refine never sees both set at once.
export function AmountOnlySwitch({
  control,
  isAmountOnly,
  setValue,
  disabled = false,
}: AmountOnlySwitchProps) {
  const { t } = useTranslation();

  const handleToggle = (checked: boolean) => {
    if (checked) {
      setValue("lines", undefined);
      setValue("amountOnly", 0);
    } else {
      setValue("amountOnly", undefined);
      // S31 — back to line mode with no line: lines are added through the product picker only.
      setValue("lines", []);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Switch
          id="amount-only"
          checked={isAmountOnly}
          onCheckedChange={handleToggle}
          disabled={disabled}
        />
        <Label htmlFor="amount-only">{t("admin.supplierInvoices.editor.amountOnly")}</Label>
      </div>
      {isAmountOnly && (
        <Controller
          control={control}
          name="amountOnly"
          render={({ field }) => (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
              disabled={disabled}
            />
          )}
        />
      )}
    </div>
  );
}
