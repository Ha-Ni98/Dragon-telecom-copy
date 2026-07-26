import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RepairStatus, type RepairDto, type TechnicianDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import {
  repairStatusSchema,
  type RepairStatusFormValues,
} from "@/pages/staff/repairs/repair-status.schema";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";

const NEXT_STATUS: Record<RepairStatus, RepairStatus[]> = {
  [RepairStatus.INTAKE]: [RepairStatus.PROCESSING, RepairStatus.CANCELLED],
  [RepairStatus.PROCESSING]: [RepairStatus.COMPLETED, RepairStatus.CANCELLED],
  [RepairStatus.COMPLETED]: [RepairStatus.PICKED_UP, RepairStatus.CANCELLED],
  [RepairStatus.PICKED_UP]: [],
  [RepairStatus.CANCELLED]: [],
};

interface RepairStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: RepairDto | null;
  technicians?: TechnicianDto[];
  /** ids of parts already consumed (post-COMPLETED) — drives the per-part restock refine. */
  consumedPartIds?: string[];
  onSubmit: (values: RepairStatusFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state) — Sprint 7 wires useUpdateRepairStatus() (+
// useUpdateRepair() for the technicianId side-call on PROCESSING, see repair-status.schema.ts).
export function RepairStatusDialog({
  open,
  onOpenChange,
  repair,
  technicians,
  consumedPartIds = [],
  onSubmit,
  isSubmitting,
}: RepairStatusDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<RepairStatusFormValues>({
    resolver: zodResolver(repairStatusSchema(t, consumedPartIds)),
    defaultValues: { toStatus: repair ? NEXT_STATUS[repair.status][0] : undefined },
  });
  const watchedStatus = watch("toStatus");

  if (!repair) return null;
  const options = NEXT_STATUS[repair.status];

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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((status) => (
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
            <div className="space-y-1">
              <Label htmlFor="status-paid-amount">
                {t("staff.repairs.statusDialog.paidAmountLabel")}
              </Label>
              <Input
                id="status-paid-amount"
                type="number"
                step="0.01"
                {...register("paidAmount", { valueAsNumber: true })}
              />
              {errors.paidAmount && (
                <p className="text-sm text-destructive">{errors.paidAmount.message}</p>
              )}
            </div>
          )}

          {watchedStatus === RepairStatus.CANCELLED && consumedPartIds.length > 0 && (
            <div className="space-y-2">
              <Label>{t("staff.repairs.statusDialog.consumedPartReturnsLabel")}</Label>
              {consumedPartIds.map((partId, index) => (
                <div key={partId} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{partId.slice(0, 8)}</span>
                  <Controller
                    control={control}
                    name={`consumedPartReturns.${index}.restock`}
                    render={({ field }) => (
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                    )}
                  />
                  <input
                    type="hidden"
                    {...register(`consumedPartReturns.${index}.partId`)}
                    value={partId}
                  />
                </div>
              ))}
              {errors.consumedPartReturns && (
                <p className="text-sm text-destructive">{errors.consumedPartReturns.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.repairs.statusDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
