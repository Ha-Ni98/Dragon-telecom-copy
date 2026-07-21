import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import {
  confirmOrderSchema,
  type ConfirmOrderFormValues,
} from "@/pages/staff/orders/confirm-order.schema";
import type { OrderDto } from "@dragon-telecom/contract";

interface OrderConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: ConfirmOrderFormValues) => void;
  isSubmitting?: boolean;
  /** 409 INSUFFICIENT_STOCK — surfaced on this dialog (STF-04 §Forms). */
  stockError?: string;
}

// Dumb (owns only local form state) — Sprint 6 wires useConfirmOrder() and passes it in.
export function OrderConfirmDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
  isSubmitting,
  stockError,
}: OrderConfirmDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ConfirmOrderFormValues>({
    resolver: zodResolver(confirmOrderSchema(t)),
    defaultValues: {
      unitPrice: order?.unitPrice,
      paidAmount: order?.totalAmount,
      serialNumbers: [],
    },
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.orders.confirmDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="confirm-unit-price">
              {t("staff.orders.confirmDialog.unitPriceLabel")}
            </Label>
            <Input
              id="confirm-unit-price"
              type="number"
              step="0.01"
              {...register("unitPrice", { valueAsNumber: true })}
            />
            {errors.unitPrice && (
              <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-serials">{t("staff.orders.confirmDialog.serialsLabel")}</Label>
            <Controller
              control={control}
              name="serialNumbers"
              render={({ field }) => (
                <Input
                  id="confirm-serials"
                  placeholder={t("common.placeholders.serialNumbers")}
                  defaultValue={field.value?.join(", ") ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-paid-amount">
              {t("staff.orders.confirmDialog.paidAmountLabel")}
            </Label>
            <Input
              id="confirm-paid-amount"
              type="number"
              step="0.01"
              {...register("paidAmount", { valueAsNumber: true })}
            />
            {errors.paidAmount && (
              <p className="text-sm text-destructive">{errors.paidAmount.message}</p>
            )}
          </div>

          {stockError && <p className="text-sm font-medium text-destructive">{stockError}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.orders.confirmDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
