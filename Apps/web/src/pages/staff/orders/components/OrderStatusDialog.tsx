import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTranslation } from "@/hooks/useTranslation";
import { OrderStatus, type OrderDto } from "@dragon-telecom/contract";
import {
  orderStatusSchema,
  type OrderStatusFormValues,
} from "@/pages/staff/orders/order-status.schema";
import { ORDER_STATUS_LABEL_KEY } from "@/pages/staff/orders/order-status-labels";

const ADVANCEABLE_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKAGED,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
];

interface OrderStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: OrderStatusFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state) — Sprint 6 wires useUpdateOrderStatus() and passes it in.
// Cancel/Return are absent here (admin-only, STF-04 §Interactions) — forward-state transitions
// only (PENDING→…→COMPLETED).
export function OrderStatusDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
  isSubmitting,
}: OrderStatusDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<OrderStatusFormValues>({
    resolver: zodResolver(orderStatusSchema(t)),
    defaultValues: { status: OrderStatus.CONFIRMED },
  });
  const watchedStatus = watch("status");

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.orders.statusDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="status-select">{t("staff.orders.statusDialog.statusLabel")}</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADVANCEABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(ORDER_STATUS_LABEL_KEY[s])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {watchedStatus === OrderStatus.IN_DELIVERY && (
            <>
              <div className="space-y-1">
                <Label htmlFor="delivery-company">
                  {t("staff.orders.statusDialog.deliveryCompanyLabel")}
                </Label>
                <Input id="delivery-company" {...register("deliveryCompany")} />
                {errors.deliveryCompany && (
                  <p className="text-sm text-destructive">{errors.deliveryCompany.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="tracking-number">
                  {t("staff.orders.statusDialog.trackingNumberLabel")}
                </Label>
                <Input id="tracking-number" {...register("trackingNumber")} />
                {errors.trackingNumber && (
                  <p className="text-sm text-destructive">{errors.trackingNumber.message}</p>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.orders.statusDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
