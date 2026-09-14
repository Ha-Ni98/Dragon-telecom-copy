import { useEffect, useMemo, useState } from "react";
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
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "@/pages/admin/inventory/components/adjustment.schema";
import { AdjustmentLineEditor } from "@/pages/admin/inventory/components/adjustment-line-editor";
import { useAdjustmentProducts } from "@/hooks/use-adjustment-products";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";

interface AdjustmentFormProps {
  onSubmit: (values: AdjustmentFormValues) => void;
  isSubmitting?: boolean;
}

// ADM-06 Adjustments tab — Sprint 5 wires `useCreateAdjustment`. Mounts only on first tab
// activation (plan §5, "heavy → lazy value").
//
// S28 — this component now owns the product picker's search state and its data hook (it is the
// component that knows which productIds are selected), instead of receiving
// `productOptions`/`systemQuantityByProductId`/`avgStockPriceByProductId` as props from a single
// capped `useAdminCatalogProducts({ page: 1, limit: 100 })` call on the page. One shared search
// string serves every line's picker — only one dropdown is open at a time, so a per-line search
// would only add queries.
//
// `selectedProductIds` is plain state, kept in sync with the form's own productId values via the
// effect below, rather than read live from `watch()` — `useAdjustmentProducts`'s output feeds the
// zod resolver passed into `useForm`, and `watch` only exists once `useForm` has already run, so
// deriving it live would be circular. The one-render lag this introduces settles well before any
// validation runs (blur/submit).
export function AdjustmentForm({ onSubmit, isSubmitting = false }: AdjustmentFormProps) {
  const { t } = useTranslation();
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([""]);

  const categories = useCatalogClientCategories();
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [categories.data],
  );

  const {
    options: productOptions,
    systemQuantityByProductId,
    avgStockPriceByProductId,
    currentPricesByProductId,
    isLoading: isProductSearchLoading,
  } = useAdjustmentProducts(debouncedProductSearch, selectedProductIds);

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

  useEffect(() => {
    const ids = (watchedLines ?? []).map((line) => line.productId);
    setSelectedProductIds((prev) =>
      prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids,
    );
  }, [watchedLines]);

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
            watch={watch}
            productOptions={productOptions}
            systemQuantityByProductId={systemQuantityByProductId}
            avgStockPrice={avgStockPriceByProductId[watchedLines?.[index]?.productId ?? ""] ?? 0}
            countedQuantity={watchedLines?.[index]?.countedQuantity ?? 0}
            productId={watchedLines?.[index]?.productId ?? ""}
            onRemove={() => remove(index)}
            unitCostError={errors.lines?.[index]?.unitCost?.message}
            onSearchChange={setProductSearch}
            isSearchLoading={isProductSearchLoading}
            categories={categoryOptions}
            currentPrices={currentPricesByProductId[watchedLines?.[index]?.productId ?? ""]}
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
