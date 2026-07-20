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
  type ReturnOrderFormValues,
} from "@/pages/admin/orders/components/return-order.schema";

interface ReturnOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: ReturnOrderFormValues) => void;
  isSubmitting?: boolean;
}

// Admin-only (ADM-09 §UI). Dumb (owns only local form state) — Sprint 6 wires useReturnOrder().
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
  } = useForm<ReturnOrderFormValues>({
    resolver: zodResolver(returnOrderSchema(t, order?.quantity ?? 1)),
    defaultValues: {
      quantity: order?.quantity ?? 1,
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
          <div className="space-y-1">
            <Label htmlFor="return-quantity">{t("admin.orders.returnDialog.quantityLabel")}</Label>
            <Input
              id="return-quantity"
              type="number"
              min={1}
              max={order.quantity}
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
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
            <Input
              id="return-refund"
              type="number"
              step="0.01"
              {...register("refundAmount", { valueAsNumber: true })}
            />
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
