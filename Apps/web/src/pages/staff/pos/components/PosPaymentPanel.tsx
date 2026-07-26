import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface PosPaymentPanelProps {
  total: number;
  paidAmount: number;
  onPaidAmountChange: (paidAmount: number) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  /** INSUFFICIENT_STOCK, surfaced elsewhere on the named line — this only carries payment-panel-local errors (paidAmount validation). */
  paidAmountError?: string;
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires useConfirmSale() + the F4/Enter shortcuts
// (STF-02 §UI) around this. changeDue/newCredit previews are the caller's job (depend on
// whether a POS client is attached) so this only renders what's passed in.
export function PosPaymentPanel({
  total,
  paidAmount,
  onPaidAmountChange,
  onConfirm,
  isConfirming,
  paidAmountError,
}: PosPaymentPanelProps) {
  const { t, language } = useTranslation();
  const changeDue = Math.max(0, paidAmount - total);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold">{t("staff.pos.payment.title")}</h3>

      <div className="space-y-1">
        <Label htmlFor="pos-paid-amount">{t("staff.pos.payment.paidAmountLabel")}</Label>
        <Input
          id="pos-paid-amount"
          type="number"
          min={0}
          value={paidAmount}
          onChange={(e) => onPaidAmountChange(Number(e.target.value))}
        />
        {paidAmountError && <p className="text-sm text-destructive">{paidAmountError}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("staff.pos.payment.changeDue")}</span>
        <span className="font-medium">{formatDZD(changeDue, language)}</span>
      </div>

      <Button className="w-full" onClick={onConfirm} disabled={isConfirming}>
        {t("staff.pos.payment.confirm")}
      </Button>
    </div>
  );
}
