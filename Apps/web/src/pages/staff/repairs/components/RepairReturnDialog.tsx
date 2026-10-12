import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RepairDto, ReturnRepairCommand } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import {
  returnRepairSchema,
  type ReturnRepairFormValues,
} from "@/pages/staff/repairs/return-repair.schema";

interface RepairReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: RepairDto | null;
  onSubmit: (command: ReturnRepairCommand) => void;
  isSubmitting?: boolean;
}

// S30 — PICKED_UP → RETURNED. Dumb (owns only local form state); only reachable from a
// picked-up ticket (RepairTicketDetail). One restock switch per fitted part, on by default (sales'
// ReturnDialog precedent): a part switched off writes no stock movement at all (fitted then
// removed, not resellable). The refund is NOT editable (owner decision Q4) — every payment is
// reversed in full, so the amount shown is simply what the repair collected. Mount with
// `key={repair.id}` so defaultValues are rebuilt per ticket.
export function RepairReturnDialog({
  open,
  onOpenChange,
  repair,
  onSubmit,
  isSubmitting,
}: RepairReturnDialogProps) {
  const { t, language } = useTranslation();
  const { register, handleSubmit, control } = useForm<ReturnRepairFormValues>({
    resolver: zodResolver(returnRepairSchema),
    defaultValues: {
      parts: (repair?.parts ?? []).map((part) => ({ partId: part.id, restock: true })),
      note: "",
    },
  });

  if (!repair) return null;

  const submit = handleSubmit((values) => {
    onSubmit({
      restockPartIds: values.parts.filter((part) => part.restock).map((part) => part.partId),
      ...(values.note ? { note: values.note } : {}),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staff.repairs.return.title")}</DialogTitle>
          <DialogDescription>
            {t("staff.repairs.return.description", { invoice: repair.invoiceNumber ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {repair.parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("staff.repairs.return.noParts")}</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {repair.parts.map((part, index) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{part.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {part.quantity} × {formatDZD(part.unitPrice, language)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Label htmlFor={`repair-return-restock-${index}`} className="text-xs">
                      {t("staff.repairs.return.restockLabel")}
                    </Label>
                    <Controller
                      control={control}
                      name={`parts.${index}.restock`}
                      render={({ field }) => (
                        <Switch
                          id={`repair-return-restock-${index}`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between font-semibold">
              <span>{t("staff.repairs.return.refundTotal")}</span>
              <span>{formatDZD(repair.paidAmount, language)}</span>
            </div>
            <p className="text-muted-foreground">
              {repair.posClientId != null
                ? t("staff.repairs.return.accountNote")
                : t("staff.repairs.return.walkInNote")}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="repair-return-note">{t("staff.repairs.return.noteLabel")}</Label>
            <Textarea id="repair-return-note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {t("staff.repairs.return.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
