import { Controller, type Control, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Trash2 } from "lucide-react";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { AdjustmentUnitCostField } from "@/pages/admin/inventory/components/adjustment-unit-cost-field";
import { AdjustmentRepriceFields } from "@/pages/admin/inventory/components/adjustment-reprice-fields";
import { useTranslation } from "@/hooks/useTranslation";

interface AdjustmentLineEditorProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  watch: UseFormWatch<AdjustmentFormValues>;
  productOptions: AutocompleteOption[];
  systemQuantityByProductId: Record<string, number>;
  avgStockPrice: number;
  countedQuantity: number;
  productId: string;
  onRemove: () => void;
  unitCostError?: string;
  /** S28 — the picker now searches the whole catalogue server-side (useAdjustmentProducts),
   *  instead of only offering the first 100 admin products. */
  onSearchChange: (query: string) => void;
  isSearchLoading?: boolean;
  categories: { id: string; name: string }[];
  currentPrices?: {
    guestPrice?: number;
    defaultSalePrice?: number;
    categoryPrices: { categoryId: string; price: number }[];
  };
}

// ADM-06 Adjustments tab — one line row. S28 added the optional reprice sub-form below the
// unit-cost field (the same one the Stock-tab Adjust dialog uses) and moved the product picker
// onto a server-side search of the whole catalogue.
export function AdjustmentLineEditor({
  index,
  control,
  setValue,
  watch,
  productOptions,
  systemQuantityByProductId,
  avgStockPrice,
  countedQuantity,
  productId,
  onRemove,
  unitCostError,
  onSearchChange,
  isSearchLoading,
  categories,
  currentPrices,
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
            onSearch={onSearchChange}
            isLoading={isSearchLoading}
            suggestions={productOptions}
            // AutocompleteInput's own default (10) truncated below use-adjustment-products.ts's
            // search query (limit: 20) — a server-side match past position 10 never showed up in
            // the dropdown even though it had already been fetched.
            maxSuggestions={20}
            placeholder={t("admin.inventory.adjustment.productSearchPlaceholder")}
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
          <AdjustmentUnitCostField
            index={index}
            control={control}
            setValue={setValue}
            productId={productId}
            avgStockPrice={avgStockPrice}
            isIncrease={isIncrease}
            unitCostError={unitCostError}
          />
        </div>
      )}

      {productId && (
        <div className="sm:col-span-5">
          <AdjustmentRepriceFields
            index={index}
            control={control}
            setValue={setValue}
            watch={watch}
            productId={productId}
            avgStockPrice={avgStockPrice}
            categories={categories}
            current={currentPrices}
          />
        </div>
      )}
    </div>
  );
}
