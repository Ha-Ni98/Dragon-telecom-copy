import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import type { InvoiceDto } from "@dragon-telecom/contract";
import {
  cancelInvoiceSchema,
  type CancelInvoiceFormValues,
} from "@/pages/admin/invoices/components/cancel-invoice.schema";

interface CancelInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDto | null;
  onSubmit: (values: CancelInvoiceFormValues) => void;
  isSubmitting?: boolean;
}

// Admin-only (ADM-14 §UI: "cancel" on the Outgoing tab). Sprint 6 addition — Sprint 4 built
// every other invoices dialog but missed this one; small enough, and required by ADM-14's own
// acceptance criteria, to build here rather than leave the "cancel" action unwired (same
// precedent as Sprint 2's B1 endpoint build). Dumb (owns only local form state) — wires
// useCancelInvoice().
export function CancelInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSubmit,
  isSubmitting,
}: CancelInvoiceDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm<CancelInvoiceFormValues>({
    resolver: zodResolver(cancelInvoiceSchema(t)),
    defaultValues: { reason: "" },
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.invoices.outgoing.cancelDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cancel-invoice-reason">
              {t("admin.invoices.outgoing.cancelDialog.reasonLabel")}
            </Label>
            <Textarea id="cancel-invoice-reason" {...register("reason")} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {t("admin.invoices.outgoing.cancelDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
