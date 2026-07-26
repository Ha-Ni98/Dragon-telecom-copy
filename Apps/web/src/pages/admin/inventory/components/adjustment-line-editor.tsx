import { useEffect, useRef } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Trash2 } from "lucide-react";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface AdjustmentLineEditorProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  productOptions: AutocompleteOption[];
  systemQuantityByProductId: Record<string, number>;
  avgStockPrice: number;
  countedQuantity: number;
  productId: string;
  onRemove: () => void;
  unitCostError?: string;
}

// ADM-06 adjustment form — one line row. Shows the counted-vs-system delta chip and reveals
// `unitCost` only when the count raises stock (an IN-delta), matching `adjustment.schema.ts`'s own
// `superRefine` rule. On an IN-delta the unit cost is pre-filled with the product's avgStockPrice
// (D10, S4) — the same value the backend's createAdjustment would default to — with the average
// shown as helper text beneath the input.
export function AdjustmentLineEditor({
  index,
  control,
  setValue,
  productOptions,
  systemQuantityByProductId,
  avgStockPrice,
  countedQuantity,
  productId,
  onRemove,
  unitCostError,
}: AdjustmentLineEditorProps) {
  const { t, language } = useTranslation();
  const systemQuantity = systemQuantityByProductId[productId] ?? 0;
  const delta = countedQuantity - systemQuantity;
  const isIncrease = delta > 0;

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

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <Controller
        control={control}
        name={`lines.${index}.productId`}
        render={({ field }) => (
          <AutocompleteInput
            inputId={`adjustment-line-${index}-product`}
            value={field.value}
            onChange={field.onChange}
            suggestions={productOptions}
            placeholder={t("admin.inventory.adjustment.product")}
          />
        )}
      />
      <div>
        <span className="text-xs text-muted-foreground">
          {t("admin.inventory.adjustment.systemQuantity")}
        </span>
        <div>{systemQuantity}</div>
      </div>
      <Controller
        control={control}
        name={`lines.${index}.countedQuantity`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            value={field.value}
            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
            placeholder={t("admin.inventory.adjustment.countedQuantity")}
          />
        )}
      />
      <div>
        <span className="text-xs text-muted-foreground">
          {t("admin.inventory.adjustment.delta")}
        </span>
        <Badge variant={delta === 0 ? "outline" : isIncrease ? "default" : "destructive"}>
          {delta > 0 ? `+${delta}` : delta}
        </Badge>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>

      {isIncrease && (
        <div className="sm:col-span-5">
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
          {unitCostError && <p className="mt-1 text-sm text-destructive">{unitCostError}</p>}
        </div>
      )}
    </div>
  );
}
