import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdjustmentReason } from "@dragon-telecom/contract";
import type { StockRowDto } from "@dragon-telecom/contract";
import {
  adjustmentSchema,
  type AdjustmentFormValues,
} from "@/pages/admin/inventory/components/adjustment.schema";
import { AdjustmentUnitCostField } from "@/pages/admin/inventory/components/adjustment-unit-cost-field";
import { AdjustmentRepriceFields } from "@/pages/admin/inventory/components/adjustment-reprice-fields";
import { useAdminCatalogProduct } from "@/hooks/useCatalogProducts";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useTranslation } from "@/hooks/useTranslation";

interface StockAdjustDialogProps {
  row: StockRowDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AdjustmentFormValues) => void;
  isSubmitting?: boolean;
}

// S28 — this is the Stock tab's per-product entry point (opened from the new Adjust column,
// stock-levels-table.tsx). It carries the SAME functionality as the Adjustments tab's line
// editor (adjustment-line-editor.tsx), scoped to one product. The adjustment MODEL is unchanged:
// it posts the same `POST /admin/inventory/adjustments`, gets the same `AJU-` reference from the
// same sequence, and produces the same ADJUSTMENT_IN/ADJUSTMENT_OUT movement types as the tab —
// the only difference is that the command has exactly one line. This component never calls a
// service or a mutation itself; it hands the form values up to the page via `onSubmit`, which
// maps them through `toCreateAdjustmentCommand` (adjustment.schema.ts) exactly like the tab does.
export function StockAdjustDialog({
  row,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: StockAdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {row && (
          <StockAdjustForm
            key={row.productId}
            row={row}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface StockAdjustFormProps {
  row: StockRowDto;
  onSubmit: (values: AdjustmentFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function StockAdjustForm({ row, onSubmit, onCancel, isSubmitting = false }: StockAdjustFormProps) {
  const { t } = useTranslation();

  // Prices/categories for the reprice sub-form only — the quantity and cost figures the dialog
  // reasons about (`systemQuantity`, `avgStockPrice`) come from `row`, the record the admin
  // actually clicked and what the table already shows, never from this second fetch. Taking them
  // from two different sources would risk showing two different numbers on one screen.
  const product = useAdminCatalogProduct(row.productId);
  const categories = useCatalogClientCategories();
  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [categories.data],
  );

  const systemQuantityByProductId = useMemo(() => ({ [row.productId]: row.quantityOnHand }), [row]);

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
      lines: [{ productId: row.productId, countedQuantity: row.quantityOnHand }],
    },
  });

  const countedQuantity = watch("lines.0.countedQuantity");
  const delta = countedQuantity - row.quantityOnHand;
  const isIncrease = delta > 0;

  const currentPrices = product.data
    ? {
        guestPrice: product.data.guestPrice,
        defaultSalePrice: product.data.defaultSalePrice,
        categoryPrices: product.data.categoryPrices.map((p) => ({
          categoryId: p.categoryId,
          price: p.price,
        })),
      }
    : undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {t("admin.inventory.stock.adjustDialog.title", { product: row.name })}
        </DialogTitle>
        <DialogDescription>
          {t("admin.inventory.stock.adjustDialog.description")}
          {row.barcode ? ` — ${row.barcode}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
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
            <Textarea
              {...field}
              placeholder={t("admin.inventory.adjustment.note")}
              disabled={isSubmitting}
            />
          )}
        />
      </div>

      <div className="grid grid-cols-3 items-end gap-3">
        <div>
          <span className="text-xs text-muted-foreground">
            {t("admin.inventory.adjustment.systemQuantity")}
          </span>
          <div>{row.quantityOnHand}</div>
        </div>
        <Controller
          control={control}
          name="lines.0.countedQuantity"
          render={({ field }) => (
            <Input
              type="number"
              min={0}
              value={field.value}
              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
              placeholder={t("admin.inventory.adjustment.countedQuantity")}
              disabled={isSubmitting}
            />
          )}
        />
        <div>
          <span className="text-xs text-muted-foreground">
            {t("admin.inventory.adjustment.delta")}
          </span>
          <div>
            <Badge variant={delta === 0 ? "outline" : isIncrease ? "default" : "destructive"}>
              {delta > 0 ? `+${delta}` : delta}
            </Badge>
          </div>
        </div>
      </div>

      {isIncrease && (
        <AdjustmentUnitCostField
          index={0}
          control={control}
          setValue={setValue}
          productId={row.productId}
          avgStockPrice={row.avgStockPrice}
          isIncrease={isIncrease}
          unitCostError={errors.lines?.[0]?.unitCost?.message}
          disabled={isSubmitting}
        />
      )}

      <AdjustmentRepriceFields
        index={0}
        control={control}
        setValue={setValue}
        watch={watch}
        productId={row.productId}
        avgStockPrice={row.avgStockPrice}
        categories={categoryOptions}
        current={currentPrices}
        disabled={isSubmitting}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : t("admin.inventory.adjustment.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
