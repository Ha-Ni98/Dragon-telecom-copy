import { useEffect, useRef } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { FieldError } from "@/components/shared/FieldError";

interface AdjustmentUnitCostFieldProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  productId: string;
  avgStockPrice: number;
  isIncrease: boolean;
  unitCostError?: string;
  disabled?: boolean;
}

// S28 — extracted from adjustment-line-editor.tsx so the Stock-tab Adjust dialog
// (stock-adjust-dialog.tsx) can render the identical control instead of a second
// implementation. Renders only when the count raises stock (an IN-delta), matching
// `adjustment.schema.ts`'s own `superRefine` rule. On an IN-delta the unit cost is pre-filled
// with the product's avgStockPrice (D10, S4) — the same value the backend's createAdjustment
// would default to — with the average shown as helper text beneath the input.
export function AdjustmentUnitCostField({
  index,
  control,
  setValue,
  productId,
  avgStockPrice,
  isIncrease,
  unitCostError,
  disabled = false,
}: AdjustmentUnitCostFieldProps) {
  const { t, language } = useTranslation();

  // D10/S4 — a positive delta creates an IN layer, whose unit cost defaults to the product's
  // quantity-weighted average (`avgStockPrice`). Applied once per selected product: re-applied when
  // the user picks a different product (a new product means a new average), never overwriting a
  // value the user has since typed for the *same* product. A product with no average yet
  // (avgStockPrice <= 0) is left blank on purpose, so the schema's "unit cost is required when the
  // count raises stock" refine forces a real figure instead of silently creating a zero-cost layer.
  const defaultedForProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!isIncrease || !productId) return;
    if (defaultedForProductId.current === productId) return;
    defaultedForProductId.current = productId;
    setValue(`lines.${index}.unitCost`, avgStockPrice > 0 ? avgStockPrice : undefined, {
      shouldDirty: false,
    });
  }, [isIncrease, productId, avgStockPrice, index, setValue]);

  if (!isIncrease) return null;

  return (
    <div>
      <Controller
        control={control}
        name={`lines.${index}.unitCost`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={field.value ?? ""}
            onChange={(e) =>
              field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder={t("admin.inventory.adjustment.unitCost")}
            className={unitCostError ? "border-destructive" : ""}
            disabled={disabled}
          />
        )}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {avgStockPrice > 0
          ? t("admin.inventory.adjustment.avgStockPriceHint", {
              price: formatDZD(avgStockPrice, language),
            })
          : t("admin.inventory.adjustment.avgStockPriceUnknown")}
      </p>
      {unitCostError && <FieldError className="mt-1">{unitCostError}</FieldError>}
    </div>
  );
}
