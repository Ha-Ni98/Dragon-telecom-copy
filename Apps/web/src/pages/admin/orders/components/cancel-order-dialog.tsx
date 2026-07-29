import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  cancelOrderSchema,
  type CancelOrderFormValues,
} from "@/pages/admin/orders/components/cancel-order.schema";

interface AdminCancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  onSubmit: (values: CancelOrderFormValues) => void;
  isSubmitting?: boolean;
}

// ADM-09 §UI: "any pre-COMPLETED state, reason optional" — distinct from the shared
// client-facing CancelOrderDialog (components/shared/), which is a plain confirm with no reason
// field (the CLIENT_MY_CANCEL route takes no body). This one is a real RHF form aligned to
// AdminCancelOrderCommand. Dumb — Sprint 6 wires useCancelBackofficeOrder(). S18/D-1 — no longer
// admin-only despite the component's name (kept for history): staff holding the orders page
// reaches this dialog too, via the staff-mounted cancel route.
export function AdminCancelOrderDialog({
  open,
  onOpenChange,
  order,
  onSubmit,
  isSubmitting,
}: AdminCancelOrderDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm<CancelOrderFormValues>({
    resolver: zodResolver(cancelOrderSchema(t)),
    defaultValues: { reason: "" },
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.orders.cancelDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cancel-reason">{t("admin.orders.cancelDialog.reasonLabel")}</Label>
            <Textarea id="cancel-reason" {...register("reason")} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {t("admin.orders.cancelDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
