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
import {
  RepairStatus,
  repairTransitionsFrom,
  type RepairDto,
  type TechnicianDto,
} from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import {
  repairStatusSchema,
  type RepairStatusFormValues,
  type RepairStatusInput,
} from "@/pages/staff/repairs/repair-status.schema";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";

interface RepairStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: RepairDto | null;
  technicians?: TechnicianDto[];
  onSubmit: (values: RepairStatusFormValues) => void;
  isSubmitting?: boolean;
  /** S13 — when the transition is launched from a specific action (e.g. always PICKED_UP from a
   * "complete pickup" affordance), that target is pre-selected and the select is locked, same
   * shape as orders' own OrderStatusDialog presetStatus (S11). Absent when opened from the ticket
   * drawer's generic "Update status" button, where the select stays free. */
  presetStatus?: RepairStatus;
}

// Dumb (owns only local form state) — Sprint 7 wires useUpdateRepairStatus() (+
// useUpdateRepair() for the technicianId side-call on PROCESSING, see repair-status.schema.ts).
// S13/D8 — the transition machine is read from the contract (repairTransitionsFrom), not a
// locally hand-rolled map; PICKED_UP shows the settlement (amount due, defaulted payment) and
// CANCELLED shows a refund field whenever money was already collected (D6).
export function RepairStatusDialog({
  open,
  onOpenChange,
  repair,
  technicians,
  onSubmit,
  isSubmitting,
  presetStatus,
}: RepairStatusDialogProps) {
  const { t, language } = useTranslation();
  const amountDue = repair ? repair.totalAmount - repair.paidAmount : 0;
  const targets = repair ? repairTransitionsFrom(repair.status) : [];
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<RepairStatusInput, unknown, RepairStatusFormValues>({
    resolver: zodResolver(repairStatusSchema(t, { amountDue })),
    defaultValues: {
      toStatus: presetStatus ?? targets[0],
      paymentAmount: amountDue > 0 ? amountDue : undefined,
      refundAmount: repair?.paidAmount,
    },
  });
  const watchedStatus = watch("toStatus");

  if (!repair) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.repairs.statusDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="toStatus"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={presetStatus != null}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(presetStatus != null ? [presetStatus] : targets).map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(REPAIR_STATUS_LABEL_KEY[status])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          {watchedStatus === RepairStatus.PROCESSING && (
            <div className="space-y-1">
              <Label htmlFor="status-technician">
                {t("staff.repairs.statusDialog.technicianLabel")}
              </Label>
              <Controller
                control={control}
                name="technicianId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status-technician">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(technicians ?? []).map((technician) => (
                        <SelectItem key={technician.id} value={technician.id}>
                          {technician.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.technicianId && (
                <p className="text-sm text-destructive">{errors.technicianId.message}</p>
              )}
            </div>
          )}

          {watchedStatus === RepairStatus.PICKED_UP && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("staff.repairs.detail.totals")}</span>
                <span>{formatDZD(repair.totalAmount, language)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("staff.repairs.detail.paid")}</span>
                <span>{formatDZD(repair.paidAmount, language)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>{t("staff.repairs.detail.amountDue")}</span>
                <span>{formatDZD(amountDue, language)}</span>
              </div>
              {amountDue > 0 ? (
                <div className="space-y-1 pt-1">
                  <Label htmlFor="status-payment-amount">
                    {t("staff.repairs.statusDialog.paymentAmountLabel")}
                  </Label>
                  <Input
                    id="status-payment-amount"
                    type="number"
                    step="0.01"
                    {...register("paymentAmount")}
                  />
                  {errors.paymentAmount && (
                    <p className="text-sm text-destructive">{errors.paymentAmount.message}</p>
                  )}
                </div>
              ) : (
                <p className="pt-1 text-muted-foreground">
                  {t("staff.repairs.statusDialog.nothingDue")}
                </p>
              )}
            </div>
          )}

          {watchedStatus === RepairStatus.CANCELLED && repair.paidAmount > 0 && (
            <div className="space-y-1">
              <Label htmlFor="status-refund-amount">
                {t("staff.repairs.statusDialog.refundAmountLabel")}
              </Label>
              <Input
                id="status-refund-amount"
                type="number"
                step="0.01"
                {...register("refundAmount")}
              />
              <p className="text-sm text-muted-foreground">
                {t("staff.repairs.statusDialog.refundHelp", {
                  amount: formatDZD(repair.paidAmount, language),
                })}
              </p>
              {errors.refundAmount && (
                <p className="text-sm text-destructive">{errors.refundAmount.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("staff.repairs.statusDialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.repairs.statusDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
