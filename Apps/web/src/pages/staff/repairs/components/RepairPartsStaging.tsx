import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import type { AddRepairPartsCommand, StaffProductDto } from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import {
  addRepairPartsSchema,
  type AddRepairPartsFormInput,
  type AddRepairPartsFormValues,
} from "@/pages/staff/repairs/add-repair-part.schema";
import { RepairPartPickerDialog } from "@/pages/staff/repairs/components/RepairPartPickerDialog";

interface RepairPartsStagingProps {
  /** `onSuccess` clears the staged list; on failure it stays on screen for correction. */
  onSubmit: (command: AddRepairPartsCommand, onSuccess: () => void) => void;
  isSubmitting?: boolean;
}

// S31 — picking happens in the shared product-picker dialog, confirming happens here. Picked
// products land in this staged list with quantity, unit price and serials still editable; nothing
// is reserved until "Add parts", which reserves every staged part in one backend transaction
// (all or nothing — plan P1). Dumb: owns only its local form state and the picker's open flag.
// The unit price defaults to the product's default sale price (plan P2 — the same default the
// old single-row form used); a product already staged is not added twice (plan P4).
export function RepairPartsStaging({ onSubmit, isSubmitting }: RepairPartsStagingProps) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<AddRepairPartsFormInput, unknown, AddRepairPartsFormValues>({
    resolver: zodResolver(addRepairPartsSchema(t)),
    defaultValues: { parts: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "parts" });

  const handlePicked = (products: StaffProductDto[]) => {
    const staged = new Set(getValues("parts").map((row) => row.productId));
    for (const product of products) {
      if (staged.has(product.id)) continue;
      append({
        productId: product.id,
        productName: product.name,
        availableQuantity: product.availableQuantity,
        quantity: 1,
        unitPrice: product.defaultSalePrice ?? 0,
      });
    }
  };

  const submit = handleSubmit((values) =>
    onSubmit(
      {
        parts: values.parts.map((row) => ({
          productId: row.productId,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          ...(row.serialNumbers?.trim() ? { serialNumbers: row.serialNumbers.trim() } : {}),
        })),
      },
      () => reset({ parts: [] }),
    ),
  );

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t("staff.repairs.addPart.addProducts")}
      </Button>

      {fields.length > 0 && (
        <form onSubmit={submit} className="space-y-2">
          <h5 className="text-sm font-medium">{t("staff.repairs.addPart.pendingTitle")}</h5>
          {fields.map((field, index) => {
            const rowErrors = errors.parts?.[index];
            return (
              <div key={field.id} className="space-y-1 rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{field.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("staff.repairs.addPart.availableHint", { qty: field.availableQuantity })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={t("staff.repairs.addPart.removeStaged", {
                      name: field.productName,
                    })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={field.availableQuantity}
                    placeholder={t("staff.repairs.addPart.quantityLabel")}
                    {...register(`parts.${index}.quantity`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t("staff.repairs.addPart.unitPriceLabel")}
                    {...register(`parts.${index}.unitPrice`)}
                  />
                </div>
                <Input
                  placeholder={t("staff.repairs.addPart.serialsLabel")}
                  {...register(`parts.${index}.serialNumbers`)}
                />
                {rowErrors?.quantity && (
                  <p className="text-sm text-destructive">{rowErrors.quantity.message}</p>
                )}
                {rowErrors?.unitPrice && (
                  <p className="text-sm text-destructive">{rowErrors.unitPrice.message}</p>
                )}
              </div>
            );
          })}
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("staff.repairs.addPart.submit")}
          </Button>
        </form>
      )}

      <RepairPartPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onAdd={handlePicked} />
    </div>
  );
}
