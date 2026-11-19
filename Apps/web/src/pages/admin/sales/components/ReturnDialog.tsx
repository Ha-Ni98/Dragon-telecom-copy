import { useState } from "react";
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
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { CreditChangeConfirmDialog } from "@/components/shared/CreditChangeConfirmDialog";
import { ReturnType, type SaleDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { sameMoney } from "@/lib/settlement";
import {
  createReturnSchema,
  type CreateReturnFormInput,
  type CreateReturnFormValues,
} from "@/pages/admin/sales/components/create-return.schema";
import { FieldError } from "@/components/shared/FieldError";

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleDto | null;
  /** saleLineId -> already-returned qty on prior returns, so lineBounds can be sold − returned. */
  alreadyReturnedByLine?: Record<string, number>;
  onSubmit: (values: CreateReturnFormValues) => void;
  isSubmitting?: boolean;
}

// ADM-10 §Forms, opened to staff holding the sales page by S18. Dumb (owns only local form state)
// — StaffSales wires useCreateReturn(). Each sale line starts unchecked (not in the `lines` field
// array) — only checked lines are appended, since the schema requires every entry to have
// quantity >= 1 (a 0-qty placeholder row for every sold line would always fail that bound).
// S32 — each checked line's refund starts EMPTY. A walk-in sale must refund exactly the sold
// price of the returned quantity (schema-enforced). For an attached client any amount is
// accepted, but if any line's refund differs from its sold price the credit change
// (refund − sold price, applied to the client's current credit) is confirmed first.
export function ReturnDialog({
  open,
  onOpenChange,
  sale,
  alreadyReturnedByLine = {},
  onSubmit,
  isSubmitting,
}: ReturnDialogProps) {
  const { t, language } = useTranslation();

  const lineBounds: Record<string, number> = {};
  const linePrices: Record<string, number> = {};
  for (const line of sale?.lines ?? []) {
    lineBounds[line.id] = line.quantity - (alreadyReturnedByLine[line.id] ?? 0);
    linePrices[line.id] = line.unitPrice;
  }
  const hasClient = sale?.posClientId != null;
  const previousCredit = sale?.posClientCredit ?? 0;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateReturnFormInput, unknown, CreateReturnFormValues>({
    resolver: zodResolver(createReturnSchema(t, lineBounds, linePrices, hasClient)),
    defaultValues: { saleId: sale?.id ?? "", type: ReturnType.REFUND, lines: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  // S32 — the values awaiting the client credit-change confirmation, if any.
  const [pending, setPending] = useState<CreateReturnFormValues | null>(null);

  const lineValue = (saleLineId: string, quantity: number) =>
    (linePrices[saleLineId] ?? 0) * (Number(quantity) || 0);

  const watchedLines = watch("lines");
  const goodsValue = watchedLines.reduce((sum, l) => sum + lineValue(l.saleLineId, l.quantity), 0);
  const refundTotal = watchedLines.reduce((sum, l) => sum + (Number(l.refundAmount) || 0), 0);
  const allRefundsFilled =
    watchedLines.length > 0 &&
    watchedLines.every((l) => l.refundAmount != null && !Number.isNaN(l.refundAmount));

  const fieldIndexForLine = (saleLineId: string) =>
    fields.findIndex((f) => f.saleLineId === saleLineId);

  const toggleLine = (saleLineId: string, checked: boolean) => {
    const index = fieldIndexForLine(saleLineId);
    if (checked && index === -1) {
      append({ saleLineId, quantity: 1, restock: true, refundAmount: undefined });
    } else if (!checked && index !== -1) {
      remove(index);
    }
  };

  const onValid = (values: CreateReturnFormValues) => {
    // Walk-in exactness is already enforced by the schema; for a client, any line whose refund
    // differs from its sold price is confirmed against the resulting credit first.
    const differs = values.lines.some(
      (l) => !sameMoney(l.refundAmount, lineValue(l.saleLineId, l.quantity)),
    );
    if (hasClient && differs) setPending(values);
    else onSubmit(values);
  };

  const pendingDue = pending
    ? pending.lines.reduce((sum, l) => sum + lineValue(l.saleLineId, l.quantity), 0)
    : 0;
  const pendingRefund = pending ? pending.lines.reduce((sum, l) => sum + l.refundAmount, 0) : 0;

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.sales.returnDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {sale.lines
              .filter((saleLine) => lineBounds[saleLine.id] > 0)
              .map((saleLine) => {
                const index = fieldIndexForLine(saleLine.id);
                const checked = index !== -1;
                return (
                  <div key={saleLine.id} className="space-y-2 rounded-lg border border-border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleLine(saleLine.id, v === true)}
                      />
                      {saleLine.productName}
                    </label>

                    {checked && (
                      <>
                        <div className="flex items-start gap-3">
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
                              <FieldError>{errors.lines[index]?.quantity?.message}</FieldError>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label htmlFor={`return-refund-${index}`}>
                              {t("admin.sales.returnDialog.refundAmountLabel")}
                            </Label>
                            <Input
                              id={`return-refund-${index}`}
                              type="number"
                              min={0}
                              step="0.01"
                              {...register(`lines.${index}.refundAmount`, {
                                setValueAs: (raw: string) => (raw === "" ? undefined : Number(raw)),
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("admin.sales.returnDialog.soldPriceHint", {
                                amount: formatDZD(
                                  lineValue(saleLine.id, watchedLines[index]?.quantity ?? 0),
                                  language,
                                ),
                              })}
                            </p>
                            {errors.lines?.[index]?.refundAmount && (
                              <FieldError>{errors.lines[index]?.refundAmount?.message}</FieldError>
                            )}
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
          {(errors.lines?.message || errors.lines?.root?.message) && (
            <FieldError>{errors.lines?.message ?? errors.lines?.root?.message}</FieldError>
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

          {fields.length > 0 && (
            <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{t("admin.sales.returnDialog.summaryTitle")}</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.sales.returnDialog.summaryGoodsValue")}
                </span>
                <span>{formatDZD(goodsValue, language)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("admin.sales.returnDialog.summaryRefundTotal")}
                </span>
                <span>{formatDZD(refundTotal, language)}</span>
              </div>
              {hasClient && allRefundsFilled && (
                <CreditMovementPreview
                  previousCredit={previousCredit}
                  newCredit={previousCredit + (refundTotal - goodsValue)}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("admin.sales.returnDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {hasClient && (
        <CreditChangeConfirmDialog
          open={pending != null}
          onOpenChange={(next) => !next && setPending(null)}
          dueLabel={t("admin.sales.returnDialog.summaryGoodsValue")}
          dueAmount={pendingDue}
          enteredLabel={t("admin.sales.returnDialog.summaryRefundTotal")}
          enteredAmount={pendingRefund}
          previousCredit={previousCredit}
          newCredit={previousCredit + (pendingRefund - pendingDue)}
          onConfirm={() => {
            if (pending) onSubmit(pending);
            setPending(null);
          }}
          isConfirming={isSubmitting}
        />
      )}
    </Dialog>
  );
}
