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
import {
  OrderStatus,
  orderTransitionsFrom,
  orderTransitionAllowsPriceEdit,
  orderTransitionRequiresPayment,
  type OrderDto,
} from "@dragon-telecom/contract";
import {
  orderStatusSchema,
  type OrderStatusFormValues,
  type OrderStatusInput,
} from "@/pages/staff/orders/order-status.schema";
import { ORDER_STATUS_LABEL_KEY } from "@/lib/order-status-labels";
import { FieldError } from "@/components/shared/FieldError";

interface OrderStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: OrderStatusFormValues) => void;
  isSubmitting?: boolean;
  /** S11 — when the admin launches a specific transition from the action column, that target is
   * pre-selected and the select is locked: the menu already expressed the choice, and re-opening
   * it inside the dialog would let the operator silently switch to a different transition than the
   * one they clicked. Absent when the dialog is opened from OrderShowDialog's generic
   * "Update status" button, where the select stays free. */
  presetStatus?: OrderStatus;
}

// Dumb (owns only local form state). S10/R3 — the single place every order transition is driven
// from: renders whatever the contract's per-type machine allows for this order
// (orders.constants.ts's orderTransitionsFrom), including CANCELLED (routed server-side to the
// admin cancel path) and RETURNED (from IN_DELIVERY) alongside the forward moves. Confirm is
// folded in here too — there is no separate confirm dialog/endpoint any more. The caller must
// pass a fresh `key` per order (same convention as every other dialog in this cluster) so
// defaultValues below are recomputed rather than staying stale — S11 extends that key with
// `presetStatus` too, since a second action-column click on the same order must also recompute.
export function OrderStatusDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
  isSubmitting,
  presetStatus,
}: OrderStatusDialogProps) {
  const { t } = useTranslation();
  const targets = order ? orderTransitionsFrom(order.orderType, order.status) : [];
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<OrderStatusInput, unknown, OrderStatusFormValues>({
    resolver: zodResolver(orderStatusSchema(t)),
    defaultValues: {
      status: presetStatus ?? targets[0],
      lines: order?.lines.map((line) => ({ orderLineId: line.id, unitPrice: line.unitPrice })),
      paidAmount: order?.totalAmount,
    },
  });
  const watchedStatus = watch("status");

  if (!order) return null;

  const showPriceEdit = orderTransitionAllowsPriceEdit(order.orderType, watchedStatus);
  const showPayment = orderTransitionRequiresPayment(watchedStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.orders.statusDialog.title")}</DialogTitle>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("staff.orders.statusDialog.noTransitions")}
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="status-select">{t("staff.orders.statusDialog.statusLabel")}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={presetStatus != null}
                  >
                    <SelectTrigger id="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(presetStatus != null ? [presetStatus] : targets).map((s) => (
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
                    <FieldError>{errors.deliveryCompany.message}</FieldError>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tracking-number">
                    {t("staff.orders.statusDialog.trackingNumberLabel")}
                  </Label>
                  <Input id="tracking-number" {...register("trackingNumber")} />
                  {errors.trackingNumber && (
                    <FieldError>{errors.trackingNumber.message}</FieldError>
                  )}
                </div>
              </>
            )}

            {showPriceEdit && (
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  {t("staff.orders.statusDialog.priceSectionTitle")}
                </div>
                {order.lines.map((line, index) => (
                  <div key={line.id} className="space-y-1">
                    <Label htmlFor={`line-price-${line.id}`}>
                      {line.productName} — {t("staff.orders.statusDialog.unitPriceLabel")}
                    </Label>
                    <input
                      type="hidden"
                      {...register(`lines.${index}.orderLineId`)}
                      value={line.id}
                    />
                    <Input
                      id={`line-price-${line.id}`}
                      type="number"
                      step="0.01"
                      {...register(`lines.${index}.unitPrice`)}
                    />
                    {errors.lines?.[index]?.unitPrice && (
                      <FieldError>{errors.lines[index]?.unitPrice?.message}</FieldError>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showPayment && (
              <div className="space-y-1">
                <Label htmlFor="paid-amount">
                  {t("staff.orders.statusDialog.paidAmountLabel")}
                </Label>
                <Input id="paid-amount" type="number" step="0.01" {...register("paidAmount")} />
                {errors.paidAmount && <FieldError>{errors.paidAmount.message}</FieldError>}
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {t("staff.orders.statusDialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
