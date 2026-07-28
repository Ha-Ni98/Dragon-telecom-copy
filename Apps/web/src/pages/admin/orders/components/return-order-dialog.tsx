import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import type { OrderDto } from "@dragon-telecom/contract";
import {
  returnOrderSchema,
  type ReturnOrderFormInput,
  type ReturnOrderFormValues,
} from "@/pages/admin/orders/components/return-order.schema";

interface ReturnOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: ReturnOrderFormValues) => void;
  isSubmitting?: boolean;
}

// ADM-09 §UI. Dumb (owns only local form state) — Sprint 6 wires useReturnOrder().
// D1 (S9) — one quantity input per order line, replacing the single quantity field.
// S18/D-1 — no longer admin-only: staff holding the orders page reaches this dialog too, via the
// staff-mounted return route.
export function ReturnOrderDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
  isSubmitting,
}: ReturnOrderDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ReturnOrderFormInput, unknown, ReturnOrderFormValues>({
    resolver: zodResolver(returnOrderSchema(t, order?.lines ?? [])),
    defaultValues: {
      lines: (order?.lines ?? []).map((line) => ({
        orderLineId: line.id,
        quantity: line.quantity,
      })),
      restock: true,
      refundAmount: order?.totalAmount ?? 0,
    },
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.orders.returnDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            {order.lines.map((line, index) => (
              <div key={line.id} className="space-y-1">
                <Label htmlFor={`return-quantity-${line.id}`}>
                  {line.productName} — {t("admin.orders.returnDialog.quantityLabel")}
                </Label>
                <Input
                  id={`return-quantity-${line.id}`}
                  type="number"
                  min={1}
                  max={line.quantity}
                  {...register(`lines.${index}.quantity`)}
                />
                <input type="hidden" {...register(`lines.${index}.orderLineId`)} value={line.id} />
                {errors.lines?.[index]?.quantity && (
                  <p className="text-sm text-destructive">
                    {errors.lines[index]?.quantity?.message}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="return-restock">{t("admin.orders.returnDialog.restockLabel")}</Label>
            <Controller
              control={control}
              name="restock"
              render={({ field }) => (
                <Switch
                  id="return-restock"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="return-refund">
              {t("admin.orders.returnDialog.refundAmountLabel")}
            </Label>
            <Input id="return-refund" type="number" step="0.01" {...register("refundAmount")} />
            {errors.refundAmount && (
              <p className="text-sm text-destructive">{errors.refundAmount.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("admin.orders.returnDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
