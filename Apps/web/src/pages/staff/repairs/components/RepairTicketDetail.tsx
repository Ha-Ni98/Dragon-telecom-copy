import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { Trash2, Plus, Printer } from "lucide-react";
import {
  isRepairStatusTerminal,
  type RepairDto,
  type StaffProductDto,
  type PublicSettingsDto,
} from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { printReceipt } from "@/lib/print";
import {
  addRepairPartSchema,
  type AddRepairPartFormValues,
} from "@/pages/staff/repairs/add-repair-part.schema";
import { REPAIR_STATUS_LABEL_KEY } from "@/pages/staff/repairs/repair-status-labels";
import { RecordRepairPaymentDialog } from "@/pages/staff/repairs/components/RecordRepairPaymentDialog";
import { RepairReceipt } from "@/pages/staff/repairs/components/RepairReceipt";
import type { RecordRepairPaymentFormValues } from "@/pages/staff/repairs/record-repair-payment.schema";

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
  onRecordPayment: (values: RecordRepairPaymentFormValues) => void;
  isRecordingPayment?: boolean;
  /** ADM-13 §UI — cost/profit per part is admin-only. */
  scope?: "staff" | "admin";
  /** S25 — the repair receipt's store header. Optional: the settings query may still be in flight. */
  store?: PublicSettingsDto["store"];
}

// Dumb (owns only local form state) — Sprint 7 wires useRepair(scope, id) + the mutations around
// this. S13/D8 — once picked up or cancelled a repair is read-only: no part/labour/diagnosis
// edits, no add-part form, driven off isRepairStatusTerminal (the same contract machine
// RepairStatusDialog reads). F1 — the spare-part picker was a raw text input whose text never
// updated on selection and whose "no product chosen" error was never rendered; both fixed here
// (AutocompleteInput shows the picked product's name, and errors.productId now renders).
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
  onRecordPayment,
  isRecordingPayment,
  scope = "staff",
  store,
}: RepairTicketDetailProps) {
  const { t, language } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddRepairPartFormValues>({
    resolver: zodResolver(addRepairPartSchema(t)),
    defaultValues: { productId: "", quantity: 1, unitPrice: 0 },
  });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  if (!repair) return null;

  const readOnly = isRepairStatusTerminal(repair.status);
  const amountDue = repair.totalAmount - repair.paidAmount;

  const submitAddPart = handleSubmit((values) => {
    onAddPart(values);
    reset();
  });

  const handleRecordPayment = (values: RecordRepairPaymentFormValues) => {
    onRecordPayment(values);
    setPaymentDialogOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>
                {t("staff.repairs.detail.title")} — {repair.reference}
              </SheetTitle>
              {/* S25 — printable at every status, including PICKED_UP/CANCELLED (read-only), so
                  this sits outside every `!readOnly` guard in this component. */}
              <Button variant="outline" size="sm" onClick={printReceipt}>
                <Printer className="mr-2 h-4 w-4" />
                {t("staff.repairs.receipt.print")}
              </Button>
            </div>
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

            {readOnly && (
              <p className="rounded-lg border border-border bg-muted/50 p-2 text-muted-foreground">
                {t("staff.repairs.detail.readOnly")}
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="repair-diagnosis">{t("staff.repairs.detail.diagnosisLabel")}</Label>
              <Textarea
                id="repair-diagnosis"
                defaultValue={repair.diagnosis ?? ""}
                disabled={!isDiagnosisEditable || readOnly}
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
                  {!readOnly && (
                    <Button variant="ghost" size="icon" onClick={() => onRemovePart(part.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}

              {!readOnly && (
                <form
                  onSubmit={submitAddPart}
                  className="space-y-2 rounded-lg border border-dashed border-border p-2"
                >
                  <AutocompleteInput
                    value={watch("productId") ?? ""}
                    onChange={(value) => {
                      const product = productSearchResults?.find((p) => p.id === value);
                      setValue("productId", value, { shouldValidate: true });
                      if (product) setValue("unitPrice", product.defaultSalePrice ?? 0);
                    }}
                    suggestions={(productSearchResults ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    onSearch={onProductSearch}
                    label={t("staff.repairs.addPart.productLabel")}
                    placeholder={t("staff.repairs.addPart.productPlaceholder")}
                    emptyMessage={t("staff.repairs.addPart.noResults")}
                    error={errors.productId?.message}
                    showCreateNew={false}
                  />
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
              )}
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
                disabled={readOnly}
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
            {repair.invoiceNumber != null && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("staff.repairs.detail.invoiceNumber")}</span>
                <span className="font-mono">{repair.invoiceNumber}</span>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t("staff.repairs.payments.title")}</h4>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => setPaymentDialogOpen(true)}>
                    {t("staff.repairs.payments.record")}
                  </Button>
                )}
              </div>
              {repair.payments.length === 0 ? (
                <p className="text-muted-foreground">
                  {repair.posClientId == null
                    ? t("staff.repairs.payments.walkIn")
                    : t("staff.repairs.payments.empty")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {repair.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        {payment.reference} · {formatDateTime(payment.paidAt, language)}
                        {payment.amount < 0 ? ` · ${t("staff.repairs.payments.refundRow")}` : ""}
                      </span>
                      <span className={payment.amount < 0 ? "text-destructive" : ""}>
                        {formatDZD(payment.amount, language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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

            {!readOnly && (
              <Button className="w-full" onClick={onOpenStatusDialog}>
                {t("staff.repairs.statusDialog.title")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <RecordRepairPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        amountDue={amountDue}
        onSubmit={handleRecordPayment}
        isSubmitting={isRecordingPayment}
      />

      {/* S25 — sibling of <Sheet>, deliberately NOT inside <SheetContent>: Radix animates
          SheetContent with a transform, which becomes the containing block for the receipt's
          position:absolute print rule and would print it clipped or off-page (see index.css). */}
      <RepairReceipt repair={repair} store={store} />
    </>
  );
}
