import { useForm } from "react-hook-form";
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
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { useTranslation } from "@/hooks/useTranslation";
import {
  recordSupplierPaymentSchema,
  type RecordSupplierPaymentFormValues,
} from "@/pages/admin/invoices/components/record-supplier-payment.schema";
import { FieldError } from "@/components/shared/FieldError";

interface SupplierPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierInvoiceReference?: string;
  previousCredit: number;
  amount: number;
  onAmountChange: (amount: number) => void;
  onSubmit: (values: RecordSupplierPaymentFormValues) => void;
  isSubmitting?: boolean;
}

// Admin-only (ADM-14 §Forms). Dumb (owns only local form state) — Sprint 6 wires
// useCreatePurchasingPayment() and the echo-after-submit.
export function SupplierPaymentDialog({
  open,
  onOpenChange,
  supplierId,
  supplierInvoiceReference,
  previousCredit,
  amount,
  onAmountChange,
  onSubmit,
  isSubmitting,
}: SupplierPaymentDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordSupplierPaymentFormValues>({
    resolver: zodResolver(recordSupplierPaymentSchema(t)),
    defaultValues: { supplierId, supplierInvoiceReference, amount },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.invoices.recordSupplierPayment.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("supplierId")} />
          {supplierInvoiceReference && (
            <input type="hidden" {...register("supplierInvoiceReference")} />
          )}

          <div className="space-y-1">
            <Label htmlFor="supplier-payment-amount">
              {t("admin.invoices.recordSupplierPayment.amountLabel")}
            </Label>
            <Input
              id="supplier-payment-amount"
              type="number"
              step="0.01"
              {...register("amount", {
                valueAsNumber: true,
                onChange: (e) => onAmountChange(Number(e.target.value)),
              })}
            />
            {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
          </div>

          <CreditMovementPreview
            previousCredit={previousCredit}
            newCredit={previousCredit - amount}
          />

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("admin.invoices.recordSupplierPayment.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
