import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
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
  returnWholeSaleSchema,
  type ReturnWholeSaleFormInput,
  type ReturnWholeSaleFormValues,
} from "@/pages/admin/sales/components/return-whole-sale.schema";
import { FieldError } from "@/components/shared/FieldError";

interface ReturnWholeSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleDto | null;
  /** saleLineId -> already-returned qty on prior returns; only the remainder is returned. */
  alreadyReturnedByLine?: Record<string, number>;
  onSubmit: (values: ReturnWholeSaleFormValues) => void;
  isSubmitting?: boolean;
}

// S32 (P2) — "Return whole sale": every line still returnable, at its full remaining quantity,
// with a restock switch per line and ONE refund figure (the server splits it by line value).
// Same rules as ReturnDialog: the refund starts empty, a walk-in must refund exactly the
// remaining goods' sold value, and an attached client's difference is confirmed against the
// credit it leaves. Dumb — StaffSales wires useReturnWholeSale(). Mounted with a per-sale `key`
// so defaultValues are rebuilt for each sale.
export function ReturnWholeSaleDialog({
  open,
  onOpenChange,
  sale,
  alreadyReturnedByLine = {},
  onSubmit,
  isSubmitting,
}: ReturnWholeSaleDialogProps) {
  const { t, language } = useTranslation();

  const openLines = (sale?.lines ?? [])
    .map((line) => ({ line, remaining: line.quantity - (alreadyReturnedByLine[line.id] ?? 0) }))
    .filter((entry) => entry.remaining > 0);
  const dueTotal =
    Math.round(openLines.reduce((sum, e) => sum + e.line.unitPrice * e.remaining, 0) * 100) / 100;
  const hasClient = sale?.posClientId != null;
  const previousCredit = sale?.posClientCredit ?? 0;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ReturnWholeSaleFormInput, unknown, ReturnWholeSaleFormValues>({
    resolver: zodResolver(returnWholeSaleSchema(t, dueTotal, hasClient)),
    defaultValues: {
      saleId: sale?.id ?? "",
      type: ReturnType.REFUND,
      refundAmount: undefined,
      lines: openLines.map((e) => ({ saleLineId: e.line.id, restock: true })),
    },
  });

  // The values awaiting the client credit-change confirmation, if any.
  const [pending, setPending] = useState<ReturnWholeSaleFormValues | null>(null);

  const watchedRefund = watch("refundAmount");
  const refundFilled = watchedRefund != null && !Number.isNaN(watchedRefund);

  const onValid = (values: ReturnWholeSaleFormValues) => {
    if (hasClient && !sameMoney(values.refundAmount, dueTotal)) setPending(values);
    else onSubmit(values);
  };

  if (!sale || openLines.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.sales.wholeReturnDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.sales.wholeReturnDialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {openLines.map((entry, index) => (
              <div
                key={entry.line.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{entry.line.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.remaining} × {formatDZD(entry.line.unitPrice, language)} ={" "}
                    {formatDZD(entry.line.unitPrice * entry.remaining, language)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`whole-return-restock-${index}`} className="text-xs">
                    {t("admin.sales.returnDialog.restockLabel")}
                  </Label>
                  <Controller
                    control={control}
                    name={`lines.${index}.restock`}
                    render={({ field }) => (
                      <Switch
                        id={`whole-return-restock-${index}`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="whole-return-refund">
              {t("admin.sales.returnDialog.refundAmountLabel")}
            </Label>
            <Input
              id="whole-return-refund"
              type="number"
              min={0}
              step="0.01"
              {...register("refundAmount", {
                setValueAs: (raw: string) => (raw === "" ? undefined : Number(raw)),
              })}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.sales.returnDialog.soldPriceHint", {
                amount: formatDZD(dueTotal, language),
              })}
            </p>
            {errors.refundAmount && <FieldError>{errors.refundAmount.message}</FieldError>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="whole-return-type">{t("admin.sales.returnDialog.typeLabel")}</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="whole-return-type">
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
            <Label htmlFor="whole-return-reason">{t("admin.sales.returnDialog.reasonLabel")}</Label>
            <Textarea id="whole-return-reason" {...register("reason")} />
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{t("admin.sales.returnDialog.summaryTitle")}</div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t("admin.sales.returnDialog.summaryGoodsValue")}
              </span>
              <span>{formatDZD(dueTotal, language)}</span>
            </div>
            {hasClient && refundFilled && (
              <CreditMovementPreview
                previousCredit={previousCredit}
                newCredit={previousCredit + (watchedRefund - dueTotal)}
              />
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("admin.sales.wholeReturnDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {hasClient && (
        <CreditChangeConfirmDialog
          open={pending != null}
          onOpenChange={(next) => !next && setPending(null)}
          dueLabel={t("admin.sales.returnDialog.summaryGoodsValue")}
          dueAmount={dueTotal}
          enteredLabel={t("admin.sales.returnDialog.summaryRefundTotal")}
          enteredAmount={pending?.refundAmount ?? 0}
          previousCredit={previousCredit}
          newCredit={previousCredit + ((pending?.refundAmount ?? 0) - dueTotal)}
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
