import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
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
import { ReportedIssue, type TechnicianDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useCatalogBrands,
  useCatalogModels,
  useCreateCatalogBrand,
  useCreateCatalogModel,
} from "@/hooks/useCatalogTaxonomy";
import {
  intakeRepairSchema,
  type IntakeRepairFormValues,
} from "@/pages/staff/repairs/intake-repair.schema";
// S25 — moved to repair-status-labels.ts (this cluster's single source of truth for label-key
// maps, alongside REPAIR_STATUS_LABEL_KEY) so RepairReceipt.tsx can reuse the same map.
import { REPORTED_ISSUE_LABEL_KEY as ISSUE_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";

interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians?: TechnicianDto[];
  onSubmit: (values: IntakeRepairFormValues) => void;
  isSubmitting?: boolean;
  /** S18/D-3 — the create-if-absent brand/model calls need to hit the staff-reachable catalog
   *  routes when this dialog is opened from `/staff/repairs`. */
  scope?: "staff" | "admin";
}

// S13/F5 — owns its own brand/model fetch + create-if-absent (previously the caller passed a
// flat, unfiltered model list with no cascading filter — a documented gap, now closed: model
// selection is disabled until a brand is chosen, and only that brand's models are offered,
// exactly like AdminProductsAdd's own family/brand/model cluster).
export function IntakeDialog({
  open,
  onOpenChange,
  technicians,
  onSubmit,
  isSubmitting,
  scope = "staff",
}: IntakeDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IntakeRepairFormValues>({
    resolver: zodResolver(intakeRepairSchema(t)),
    defaultValues: { customerName: "", customerPhone: "", reportedIssues: [] },
  });
  const watchedIssues = watch("reportedIssues");
  const brandId = watch("brandId");

  const { data: brands } = useCatalogBrands();
  const { data: models } = useCatalogModels({ brandId }, false, { enabled: !!brandId });
  const createBrand = useCreateCatalogBrand(scope === "admin");
  const createModel = useCreateCatalogModel(scope === "admin");

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
              <AutocompleteInput
                label={t("staff.repairs.intake.brandLabel")}
                value={brandId ?? ""}
                onChange={(value) => {
                  const brand = brands?.find((b) => b.id === value);
                  if (brand) {
                    setValue("brandId", brand.id);
                    // Cascading reset (F5) — a model belongs to exactly one brand; switching
                    // brand invalidates whatever model was previously chosen.
                    setValue("deviceModelId", undefined);
                  }
                }}
                suggestions={(brands ?? []).map((b) => ({ value: b.id, label: b.name }))}
                onCreateNew={(name) =>
                  createBrand.mutate(
                    { name },
                    {
                      onSuccess: (brand) => {
                        setValue("brandId", brand.id);
                        setValue("deviceModelId", undefined);
                      },
                    },
                  )
                }
                placeholder={t("staff.repairs.intake.brandPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <AutocompleteInput
                label={t("staff.repairs.intake.modelLabel")}
                value={watch("deviceModelId") ?? ""}
                onChange={(value) => {
                  const model = models?.find((m) => m.id === value);
                  if (model) setValue("deviceModelId", model.id);
                }}
                suggestions={(models ?? []).map((m) => ({ value: m.id, label: m.name }))}
                disabled={!brandId}
                onCreateNew={
                  brandId
                    ? (name) =>
                        createModel.mutate(
                          { brandId, name },
                          { onSuccess: (model) => setValue("deviceModelId", model.id) },
                        )
                    : undefined
                }
                placeholder={
                  brandId
                    ? t("staff.repairs.intake.modelPlaceholder")
                    : t("staff.repairs.intake.modelBrandFirst")
                }
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
