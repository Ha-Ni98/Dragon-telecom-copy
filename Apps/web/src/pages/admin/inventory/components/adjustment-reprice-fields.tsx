import { useEffect, useRef } from "react";
import { Controller, type Control, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MarginDisplay } from "@/components/shared/MarginDisplay";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface AdjustmentRepriceFieldsProps {
  index: number;
  control: Control<AdjustmentFormValues>;
  setValue: UseFormSetValue<AdjustmentFormValues>;
  watch: UseFormWatch<AdjustmentFormValues>;
  productId: string;
  avgStockPrice: number;
  categories: { id: string; name: string }[];
  current?: {
    guestPrice?: number;
    defaultSalePrice?: number;
    categoryPrices: { categoryId: string; price: number }[];
  };
  disabled?: boolean;
}

// S28 — the ADM-06 §UI "optional collapsed reprice sub-form" ("an optional collapsed reprice
// sub-form prefilled with current prices"), which had never actually been built even though the
// contract and backend already supported `CreateAdjustmentCommand.lines[].prices`. Shared by the
// Adjustments tab's line editor and the Stock-tab Adjust dialog (stock-adjust-dialog.tsx) so
// there is exactly one reprice form, not two that could drift.
//
// Shape mirrors `supplier-invoices/components/reprice-prompt.tsx` — the app's other "reprice one
// product, prefilled with its current prices" form — down to the `-previous …-` label convention
// and using `avgStockPrice` (D10/RC-2) as the MarginDisplay cost basis.
export function AdjustmentRepriceFields({
  index,
  control,
  setValue,
  watch,
  productId,
  avgStockPrice,
  categories,
  current,
  disabled = false,
}: AdjustmentRepriceFieldsProps) {
  const { t } = useTranslation();

  // Prefill once per product, once `current` (the product's live prices) has arrived — same
  // once-per-product-id guard as AdjustmentUnitCostField's default, so a value the user already
  // typed into the reprice form is never overwritten by a re-render, and switching products
  // re-prefills for the new one. `enabled` is preserved rather than reset, so toggling the
  // checkbox on before `current` has loaded is not undone once it arrives.
  const prefilledForProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!current || !productId) return;
    if (prefilledForProductId.current === productId) return;
    prefilledForProductId.current = productId;
    const currentEnabled = watch(`lines.${index}.reprice.enabled`) ?? false;
    setValue(
      `lines.${index}.reprice`,
      {
        enabled: currentEnabled,
        guestPrice: current.guestPrice,
        defaultSalePrice: current.defaultSalePrice,
        categoryPrices: categories.map((category) => ({
          categoryId: category.id,
          price: current.categoryPrices.find((p) => p.categoryId === category.id)?.price,
        })),
      },
      { shouldDirty: false },
    );
  }, [current, productId, categories, index, setValue, watch]);

  const enabled = watch(`lines.${index}.reprice.enabled`) ?? false;

  const previousLabel = (base: string, previous: number | undefined): string =>
    previous == null
      ? `${base} ${t("admin.inventory.adjustment.reprice.previousEmpty")}`
      : `${base} ${t("admin.inventory.adjustment.reprice.previous", { value: previous.toLocaleString() })}`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={`lines.${index}.reprice.enabled`}
          render={({ field }) => (
            <Checkbox
              id={`adjustment-line-${index}-reprice-enabled`}
              checked={field.value ?? false}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={disabled}
            />
          )}
        />
        <Label htmlFor={`adjustment-line-${index}-reprice-enabled`}>
          {t("admin.inventory.adjustment.reprice.toggle")}
        </Label>
      </div>

      {enabled && (
        <div className="mt-3 space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">{t("admin.inventory.adjustment.reprice.title")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>
                {previousLabel(
                  t("admin.inventory.adjustment.reprice.guestPrice"),
                  current?.guestPrice,
                )}
              </Label>
              <Controller
                control={control}
                name={`lines.${index}.reprice.guestPrice`}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    disabled={disabled}
                  />
                )}
              />
              <MarginDisplay
                price={watch(`lines.${index}.reprice.guestPrice`)}
                cost={avgStockPrice}
              />
            </div>
            <div className="space-y-1">
              <Label>
                {previousLabel(
                  t("admin.inventory.adjustment.reprice.defaultSalePrice"),
                  current?.defaultSalePrice,
                )}
              </Label>
              <Controller
                control={control}
                name={`lines.${index}.reprice.defaultSalePrice`}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    disabled={disabled}
                  />
                )}
              />
              <MarginDisplay
                price={watch(`lines.${index}.reprice.defaultSalePrice`)}
                cost={avgStockPrice}
              />
            </div>
            {categories.map((category, catIndex) => {
              const previous = current?.categoryPrices.find(
                (p) => p.categoryId === category.id,
              )?.price;
              return (
                <div key={category.id} className="space-y-1">
                  <Label>
                    {previousLabel(
                      t("admin.inventory.adjustment.reprice.categoryPriceLabel", {
                        category: category.name,
                      }),
                      previous,
                    )}
                  </Label>
                  <Controller
                    control={control}
                    name={`lines.${index}.reprice.categoryPrices.${catIndex}.categoryId`}
                    render={({ field }) => (
                      <input type="hidden" {...field} value={field.value ?? category.id} />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`lines.${index}.reprice.categoryPrices.${catIndex}.price`}
                    render={({ field }) => (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                        disabled={disabled}
                      />
                    )}
                  />
                  <MarginDisplay
                    price={watch(`lines.${index}.reprice.categoryPrices.${catIndex}.price`)}
                    cost={avgStockPrice}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
