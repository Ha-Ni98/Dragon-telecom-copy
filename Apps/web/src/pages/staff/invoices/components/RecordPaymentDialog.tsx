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
import { formatDZD } from "@/lib/utils";
import type { ClientPaymentDto } from "@dragon-telecom/contract";
import {
  recordClientPaymentSchema,
  type RecordClientPaymentFormValues,
} from "@/pages/staff/invoices/record-client-payment.schema";
import { FieldError } from "@/components/shared/FieldError";

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
  /** S34 — when set, the dialog shows the recorded payment (the server's own previous/new credit
   * snapshot) instead of the form. Only the POS-clients page passes it; other callers keep
   * closing on success. */
  result?: ClientPaymentDto | null;
}

// Dumb (owns only local form state) — Sprint 6 wires useCreateClientPayment() and the
// echo-after-submit (component just receives whatever previousCredit/amount the parent tracks).
// S34 — with `result` set it echoes the ledger row's own previous → new credit after submit.
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
  result,
}: RecordPaymentDialogProps) {
  const { t, language } = useTranslation();
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
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("staff.invoices.recordPayment.recordedTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("staff.invoices.recordPayment.reference")}
                  </span>
                  <span className="font-medium">{result.reference}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("staff.invoices.recordPayment.amountLabel")}
                  </span>
                  <span className="font-medium">{formatDZD(result.amount, language)}</span>
                </div>
              </div>
              <CreditMovementPreview
                previousCredit={result.previousCredit}
                newCredit={result.newCredit}
              />
              <DialogFooter>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  {t("common.close")}
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : (
          <>
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
                {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
