import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ReturnType, type SaleDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import {
  createReturnSchema,
  type CreateReturnFormValues,
} from "@/pages/admin/sales/components/create-return.schema";

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleDto | null;
  /** saleLineId -> already-returned qty on prior returns, so lineBounds can be sold − returned. */
  alreadyReturnedByLine?: Record<string, number>;
  onSubmit: (values: CreateReturnFormValues) => void;
  isSubmitting?: boolean;
}

// Admin-only (ADM-10 §Forms). Dumb (owns only local form state) — Sprint 6 wires useCreateReturn().
// Each sale line starts unchecked (not in the `lines` field array) — only checked lines are
// appended, since the schema requires every entry to have quantity >= 1 (a 0-qty placeholder
// row for every sold line would always fail that bound).
export function ReturnDialog({
  open,
  onOpenChange,
  sale,
  alreadyReturnedByLine = {},
  onSubmit,
  isSubmitting,
}: ReturnDialogProps) {
  const { t } = useTranslation();

  const lineBounds: Record<string, number> = {};
  for (const line of sale?.lines ?? []) {
    lineBounds[line.id] = line.quantity - (alreadyReturnedByLine[line.id] ?? 0);
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateReturnFormValues>({
    resolver: zodResolver(createReturnSchema(t, lineBounds)),
    defaultValues: { saleId: sale?.id ?? "", type: ReturnType.REFUND, lines: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const fieldIndexForLine = (saleLineId: string) =>
    fields.findIndex((f) => f.saleLineId === saleLineId);

  const toggleLine = (saleLineId: string, checked: boolean, unitPrice: number) => {
    const index = fieldIndexForLine(saleLineId);
    if (checked && index === -1) {
      append({ saleLineId, quantity: 1, restock: true, refundAmount: unitPrice });
    } else if (!checked && index !== -1) {
      remove(index);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.sales.returnDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {sale.lines.map((saleLine) => {
              const index = fieldIndexForLine(saleLine.id);
              const checked = index !== -1;
              return (
                <div key={saleLine.id} className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        toggleLine(saleLine.id, v === true, saleLine.unitPrice)
                      }
                    />
                    {saleLine.productName}
                  </label>

                  {checked && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`return-qty-${index}`}>
                            {t("admin.sales.returnDialog.quantityLabel")}
                          </Label>
                          <Input
                            id={`return-qty-${index}`}
                            type="number"
                            min={1}
                            max={lineBounds[saleLine.id]}
                            {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                          />
                          {errors.lines?.[index]?.quantity && (
                            <p className="text-sm text-destructive">
                              {errors.lines[index]?.quantity?.message}
                            </p>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`return-refund-${index}`}>
                            {t("admin.sales.returnDialog.refundAmountLabel")}
                          </Label>
                          <Input
                            id={`return-refund-${index}`}
                            type="number"
                            step="0.01"
                            {...register(`lines.${index}.refundAmount`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`return-restock-${index}`}>
                          {t("admin.sales.returnDialog.restockLabel")}
                        </Label>
                        <Controller
                          control={control}
                          name={`lines.${index}.restock`}
                          render={({ field: restockField }) => (
                            <Switch
                              id={`return-restock-${index}`}
                              checked={restockField.value}
                              onCheckedChange={restockField.onChange}
                            />
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {errors.lines?.message && (
            <p className="text-sm text-destructive">{errors.lines.message}</p>
          )}

          <div className="space-y-1">
            <Label htmlFor="return-type">{t("admin.sales.returnDialog.typeLabel")}</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="return-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ReturnType.REFUND}>
                      {t("admin.sales.returnDialog.typeRefund")}
                    </SelectItem>
                    <SelectItem value={ReturnType.EXCHANGE}>
                      {t("admin.sales.returnDialog.typeExchange")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="return-reason">{t("admin.sales.returnDialog.reasonLabel")}</Label>
            <Textarea id="return-reason" {...register("reason")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("admin.sales.returnDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
