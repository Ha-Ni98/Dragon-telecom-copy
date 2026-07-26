import { Controller, type Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Trash2 } from "lucide-react";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface AdjustmentLineEditorProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  productOptions: AutocompleteOption[];
  systemQuantityByProductId: Record<string, number>;
  countedQuantity: number;
  productId: string;
  onRemove: () => void;
  unitCostError?: string;
}

// ADM-06 adjustment form — one line row. Shows the counted-vs-system delta chip and reveals
// `unitCost` only when the count raises stock (an IN-delta), matching `adjustment.schema.ts`'s
// own `superRefine` rule.
export function AdjustmentLineEditor({
  index,
  control,
  productOptions,
  systemQuantityByProductId,
  countedQuantity,
  productId,
  onRemove,
  unitCostError,
}: AdjustmentLineEditorProps) {
  const { t } = useTranslation();
  const systemQuantity = systemQuantityByProductId[productId] ?? 0;
  const delta = countedQuantity - systemQuantity;
  const isIncrease = delta > 0;

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
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                placeholder={t("admin.inventory.adjustment.unitCost")}
                className={unitCostError ? "border-destructive" : ""}
              />
            )}
          />
          {unitCostError && <p className="mt-1 text-sm text-destructive">{unitCostError}</p>}
        </div>
      )}
    </div>
  );
}
