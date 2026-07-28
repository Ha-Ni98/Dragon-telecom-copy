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
import { useTranslation } from "@/hooks/useTranslation";
import {
  recordRepairPaymentSchema,
  type RecordRepairPaymentFormValues,
  type RecordRepairPaymentInput,
} from "@/pages/staff/repairs/record-repair-payment.schema";

interface RecordRepairPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** totalAmount − paidAmount so far — the field's default (S13/D5). */
  amountDue: number;
  onSubmit: (values: RecordRepairPaymentFormValues) => void;
  isSubmitting?: boolean;
}

// D5 (S13) — a cumulative payment at any pre-pickup step (INTAKE/PROCESSING/COMPLETED). Dumb,
// owns only local form state — StaffRepairs.tsx wires useRecordRepairPayment().
export function RecordRepairPaymentDialog({
  open,
  onOpenChange,
  amountDue,
  onSubmit,
  isSubmitting,
}: RecordRepairPaymentDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordRepairPaymentInput, unknown, RecordRepairPaymentFormValues>({
    resolver: zodResolver(recordRepairPaymentSchema(t)),
    defaultValues: { amount: amountDue > 0 ? amountDue : undefined },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.repairs.payments.record")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="repair-payment-amount">{t("staff.repairs.payments.amountLabel")}</Label>
            <Input id="repair-payment-amount" type="number" step="0.01" {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("staff.repairs.payments.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
