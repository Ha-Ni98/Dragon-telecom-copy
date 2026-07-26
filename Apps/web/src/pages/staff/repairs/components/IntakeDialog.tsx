import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ReportedIssue,
  type BrandDto,
  type DeviceModelDto,
  type TechnicianDto,
} from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import {
  intakeRepairSchema,
  type IntakeRepairFormValues,
} from "@/pages/staff/repairs/intake-repair.schema";

const ISSUE_LABEL_KEY: Record<ReportedIssue, string> = {
  [ReportedIssue.CHARGING]: "staff.repairs.intake.issue.charging",
  [ReportedIssue.DISPLAY]: "staff.repairs.intake.issue.display",
  [ReportedIssue.BATTERY]: "staff.repairs.intake.issue.battery",
  [ReportedIssue.CAMERA]: "staff.repairs.intake.issue.camera",
  [ReportedIssue.SPEAKER]: "staff.repairs.intake.issue.speaker",
  [ReportedIssue.MICROPHONE]: "staff.repairs.intake.issue.microphone",
  [ReportedIssue.WATER_DAMAGE]: "staff.repairs.intake.issue.waterDamage",
  [ReportedIssue.SOFTWARE]: "staff.repairs.intake.issue.software",
  [ReportedIssue.OTHER]: "staff.repairs.intake.issue.other",
};

interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brands?: BrandDto[];
  models?: DeviceModelDto[];
  technicians?: TechnicianDto[];
  onSubmit: (values: IntakeRepairFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state) — Sprint 7 wires useCreateRepair() + print-claim-slip.
export function IntakeDialog({
  open,
  onOpenChange,
  brands,
  models,
  technicians,
  onSubmit,
  isSubmitting,
}: IntakeDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<IntakeRepairFormValues>({
    resolver: zodResolver(intakeRepairSchema(t)),
    defaultValues: { customerName: "", customerPhone: "", reportedIssues: [] },
  });
  const watchedIssues = watch("reportedIssues");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staff.repairs.intake.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="intake-customer-name">
                {t("staff.repairs.intake.customerNameLabel")}
              </Label>
              <Input id="intake-customer-name" {...register("customerName")} />
              {errors.customerName && (
                <p className="text-sm text-destructive">{errors.customerName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-customer-phone">
                {t("staff.repairs.intake.customerPhoneLabel")}
              </Label>
              <Input id="intake-customer-phone" {...register("customerPhone")} />
              {errors.customerPhone && (
                <p className="text-sm text-destructive">{errors.customerPhone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="intake-brand">{t("staff.repairs.intake.brandLabel")}</Label>
              <Controller
                control={control}
                name="brandId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="intake-brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(brands ?? []).map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-model">{t("staff.repairs.intake.modelLabel")}</Label>
              <Controller
                control={control}
                name="deviceModelId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="intake-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(models ?? []).map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="intake-device-label">{t("staff.repairs.intake.imeiLabel")}</Label>
            <Input id="intake-device-label" {...register("deviceImei")} />
          </div>

          <div className="space-y-2">
            <Label>{t("staff.repairs.intake.reportedIssuesLabel")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(ReportedIssue).map((issue) => (
                <Controller
                  key={issue}
                  control={control}
                  name="reportedIssues"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value?.includes(issue)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...(field.value ?? []), issue]
                              : (field.value ?? []).filter((v) => v !== issue),
                          )
                        }
                      />
                      {t(ISSUE_LABEL_KEY[issue])}
                    </label>
                  )}
                />
              ))}
            </div>
            {errors.reportedIssues && (
              <p className="text-sm text-destructive">{errors.reportedIssues.message}</p>
            )}
          </div>

          {watchedIssues?.includes(ReportedIssue.OTHER) && (
            <div className="space-y-1">
              <Label htmlFor="intake-issue-other">
                {t("staff.repairs.intake.reportedIssueOtherLabel")}
              </Label>
              <Input id="intake-issue-other" {...register("reportedIssueOther")} />
              {errors.reportedIssueOther && (
                <p className="text-sm text-destructive">{errors.reportedIssueOther.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="intake-technician">{t("staff.repairs.intake.technicianLabel")}</Label>
            <Controller
              control={control}
              name="technicianId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="intake-technician">
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
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.repairs.intake.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
