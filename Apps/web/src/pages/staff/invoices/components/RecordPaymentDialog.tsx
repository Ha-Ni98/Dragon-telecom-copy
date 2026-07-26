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
  recordClientPaymentSchema,
  type RecordClientPaymentFormValues,
} from "@/pages/staff/invoices/record-client-payment.schema";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posClientId: string;
  invoiceNumber?: string;
  /** Live preview — the caller computes `currentCredit - amount` as the user types (STF-06
   * §Interactions: "previews previous credit → new credit before submit"). */
  previousCredit: number;
  amount: number;
  onAmountChange: (amount: number) => void;
  onSubmit: (values: RecordClientPaymentFormValues) => void;
  isSubmitting?: boolean;
}

// Dumb (owns only local form state) — Sprint 6 wires useCreateClientPayment() and the
// echo-after-submit (component just receives whatever previousCredit/amount the parent tracks).
export function RecordPaymentDialog({
  open,
  onOpenChange,
  posClientId,
  invoiceNumber,
  previousCredit,
  amount,
  onAmountChange,
  onSubmit,
  isSubmitting,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordClientPaymentFormValues>({
    resolver: zodResolver(recordClientPaymentSchema(t)),
    defaultValues: { posClientId, invoiceNumber, amount },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.invoices.recordPayment.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("posClientId")} />
          {invoiceNumber && <input type="hidden" {...register("invoiceNumber")} />}

          <div className="space-y-1">
            <Label htmlFor="record-payment-amount">
              {t("staff.invoices.recordPayment.amountLabel")}
            </Label>
            <Input
              id="record-payment-amount"
              type="number"
              step="0.01"
              {...register("amount", {
                valueAsNumber: true,
                onChange: (e) => onAmountChange(Number(e.target.value)),
              })}
            />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>

          <CreditMovementPreview
            previousCredit={previousCredit}
            newCredit={previousCredit - amount}
          />

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.invoices.recordPayment.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
