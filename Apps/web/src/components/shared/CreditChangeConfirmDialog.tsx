import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface CreditChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Total due" (POS) / "Sold price of returned items" (returns). */
  dueLabel: string;
  dueAmount: number;
  /** e.g. "Paid amount" (POS) / "Refund entered" (returns). */
  enteredLabel: string;
  enteredAmount: number;
  previousCredit: number;
  newCredit: number;
  onConfirm: () => void;
  isConfirming?: boolean;
}

// S32 — shared by the POS confirm and both sale-return dialogs: an attached client's entered
// amount differs from what is due, so the credit change it leaves is shown and confirmed first.
// Pure presentational — the caller computes every figure (same rule as CreditMovementPreview).
export function CreditChangeConfirmDialog({
  open,
  onOpenChange,
  dueLabel,
  dueAmount,
  enteredLabel,
  enteredAmount,
  previousCredit,
  newCredit,
  onConfirm,
  isConfirming,
}: CreditChangeConfirmDialogProps) {
  const { t, language } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.creditConfirm.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.creditConfirm.description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{dueLabel}</span>
            <span className="font-medium">{formatDZD(dueAmount, language)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{enteredLabel}</span>
            <span className="font-medium">{formatDZD(enteredAmount, language)}</span>
          </div>
          <CreditMovementPreview previousCredit={previousCredit} newCredit={newCredit} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={isConfirming} onClick={onConfirm}>
            {t("common.creditConfirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
