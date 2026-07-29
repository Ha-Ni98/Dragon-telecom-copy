import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save } from "lucide-react";
import { AdjustmentReason } from "@dragon-telecom/contract";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "@/pages/admin/inventory/components/adjustment.schema";
import { AdjustmentLineEditor } from "@/pages/admin/inventory/components/adjustment-line-editor";
import { useTranslation } from "@/hooks/useTranslation";

interface AdjustmentFormProps {
  productOptions: AutocompleteOption[];
  systemQuantityByProductId: Record<string, number>;
  avgStockPriceByProductId: Record<string, number>;
  onSubmit: (values: AdjustmentFormValues) => void;
  isSubmitting?: boolean;
}

// ADM-06 Adjustments tab — dumb (owns only local form state); Sprint 5 wires
// `useCreateAdjustment`. Mounts only on first tab activation (plan §5, "heavy → lazy value").
export function AdjustmentForm({
  productOptions,
  systemQuantityByProductId,
  avgStockPriceByProductId,
  onSubmit,
  isSubmitting = false,
}: AdjustmentFormProps) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema(t, systemQuantityByProductId)),
    defaultValues: {
      reason: AdjustmentReason.COUNT,
      note: "",
      lines: [{ productId: "", countedQuantity: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.inventory.adjustment.reason")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AdjustmentReason.COUNT}>
                  {t("admin.inventory.adjustment.reason.count")}
                </SelectItem>
                <SelectItem value={AdjustmentReason.DAMAGE}>
                  {t("admin.inventory.adjustment.reason.damage")}
                </SelectItem>
                <SelectItem value={AdjustmentReason.LOSS}>
                  {t("admin.inventory.adjustment.reason.loss")}
                </SelectItem>
                <SelectItem value={AdjustmentReason.CORRECTION}>
                  {t("admin.inventory.adjustment.reason.correction")}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <Textarea {...field} placeholder={t("admin.inventory.adjustment.note")} />
          )}
        />
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <AdjustmentLineEditor
            key={field.id}
            index={index}
            control={control}
            setValue={setValue}
            productOptions={productOptions}
            systemQuantityByProductId={systemQuantityByProductId}
            avgStockPrice={avgStockPriceByProductId[watchedLines?.[index]?.productId ?? ""] ?? 0}
            countedQuantity={watchedLines?.[index]?.countedQuantity ?? 0}
            productId={watchedLines?.[index]?.productId ?? ""}
            onRemove={() => remove(index)}
            unitCostError={errors.lines?.[index]?.unitCost?.message}
          />
        ))}
        {errors.lines?.root && (
          <p className="text-sm text-destructive">{errors.lines.root.message}</p>
        )}
        {errors.lines?.message && (
          <p className="text-sm text-destructive">{errors.lines.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ productId: "", countedQuantity: 0 })}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.inventory.adjustment.addLine")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? t("common.saving") : t("admin.inventory.adjustment.submit")}
        </Button>
      </div>
    </form>
  );
}
