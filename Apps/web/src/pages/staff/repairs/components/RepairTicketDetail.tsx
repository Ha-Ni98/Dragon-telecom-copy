import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus } from "lucide-react";
import { RepairStatus, type RepairDto, type StaffProductDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import {
  addRepairPartSchema,
  type AddRepairPartFormValues,
} from "@/pages/staff/repairs/add-repair-part.schema";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";

interface RepairTicketDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: RepairDto | null;
  isDiagnosisEditable?: boolean;
  onDiagnosisChange: (diagnosis: string) => void;
  onLabourPriceChange: (labourPrice: number) => void;
  productSearchResults?: StaffProductDto[];
  onProductSearch: (query: string) => void;
  onAddPart: (values: AddRepairPartFormValues) => void;
  onRemovePart: (partId: string) => void;
  onOpenStatusDialog: () => void;
  /** ADM-13 §UI — cost/profit per part is admin-only. */
  scope?: "staff" | "admin";
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires useRepair(scope, id) + the mutations around this.
export function RepairTicketDetail({
  open,
  onOpenChange,
  repair,
  isDiagnosisEditable,
  onDiagnosisChange,
  onLabourPriceChange,
  productSearchResults,
  onProductSearch,
  onAddPart,
  onRemovePart,
  onOpenStatusDialog,
  scope = "staff",
}: RepairTicketDetailProps) {
  const { t, language } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddRepairPartFormValues>({
    resolver: zodResolver(addRepairPartSchema(t)),
    defaultValues: { productId: "", quantity: 1, unitPrice: 0 },
  });

  if (!repair) return null;

  const submitAddPart = handleSubmit((values) => {
    onAddPart(values);
    reset();
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t("staff.repairs.detail.title")} — {repair.reference}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <div className="font-medium">{repair.customerName}</div>
            <div className="text-muted-foreground">{repair.customerPhone}</div>
            <div className="text-muted-foreground">
              {repair.device.brand?.name} {repair.device.model?.name}
              {repair.device.imei ? ` · IMEI ${repair.device.imei}` : ""}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="repair-diagnosis">{t("staff.repairs.detail.diagnosisLabel")}</Label>
            <Textarea
              id="repair-diagnosis"
              defaultValue={repair.diagnosis ?? ""}
              disabled={!isDiagnosisEditable}
              onBlur={(e) => onDiagnosisChange(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold">{t("staff.repairs.detail.partsEditor")}</h4>
            {repair.parts.map((part) => (
              <div
                key={part.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{part.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {part.quantity} × {formatDZD(part.unitPrice, language)}
                    {scope === "admin" && part.profit != null && (
                      <>
                        {" "}
                        · {t("admin.repairs.detail.profit")}: {formatDZD(part.profit, language)}
                      </>
                    )}
                  </div>
                </div>
                <div className="font-semibold">{formatDZD(part.lineTotal, language)}</div>
                <Button variant="ghost" size="icon" onClick={() => onRemovePart(part.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <form
              onSubmit={submitAddPart}
              className="space-y-2 rounded-lg border border-dashed border-border p-2"
            >
              <Input
                placeholder={t("staff.repairs.addPart.productLabel")}
                onChange={(e) => onProductSearch(e.target.value)}
              />
              {productSearchResults && productSearchResults.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {productSearchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setValue("productId", product.id);
                        setValue("unitPrice", product.defaultSalePrice ?? 0);
                      }}
                      className="block w-full rounded-md p-1.5 text-left text-xs hover:bg-accent"
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder={t("staff.repairs.addPart.quantityLabel")}
                  {...register("quantity", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t("staff.repairs.addPart.unitPriceLabel")}
                  {...register("unitPrice", { valueAsNumber: true })}
                />
              </div>
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
              {errors.unitPrice && (
                <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
              )}
              <Input
                placeholder={t("staff.repairs.addPart.serialsLabel")}
                {...register("serialNumbers")}
              />
              <Button type="submit" size="sm" variant="outline">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("staff.repairs.addPart.submit")}
              </Button>
            </form>
          </div>

          <Separator />

          <div className="space-y-1">
            <Label htmlFor="repair-labour-price">
              {t("staff.repairs.detail.labourPriceLabel")}
            </Label>
            <Input
              id="repair-labour-price"
              type="number"
              step="0.01"
              defaultValue={repair.labourPrice}
              onBlur={(e) => onLabourPriceChange(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between font-semibold">
            <span>{t("staff.repairs.detail.totals")}</span>
            <span>{formatDZD(repair.totalAmount, language)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("staff.repairs.detail.paid")}</span>
            <span>{formatDZD(repair.paidAmount, language)}</span>
          </div>

          <Separator />

          <div>
            <h4 className="mb-1 font-semibold">{t("staff.repairs.detail.timeline")}</h4>
            <ul className="space-y-1 text-muted-foreground">
              {repair.history.map((entry, index) => (
                <li key={index}>
                  {formatDateTime(entry.changedAt, language)} —{" "}
                  {t(REPAIR_STATUS_LABEL_KEY[entry.fromStatus])} →{" "}
                  {t(REPAIR_STATUS_LABEL_KEY[entry.toStatus])} ({entry.staffName})
                </li>
              ))}
            </ul>
          </div>

          {repair.status !== RepairStatus.CANCELLED && repair.status !== RepairStatus.PICKED_UP && (
            <Button className="w-full" onClick={onOpenStatusDialog}>
              {t("staff.repairs.statusDialog.title")}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
