import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { useTranslation } from "@/hooks/useTranslation";
import { FieldError } from "@/components/shared/FieldError";

interface PosPaymentPanelProps {
  /** S32 — null while the field is empty: the paid amount is never pre-filled. */
  paidAmount: number | null;
  onPaidAmountChange: (paidAmount: number | null) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  /** INSUFFICIENT_STOCK, surfaced elsewhere on the named line — this only carries payment-panel-local errors (paidAmount validation). */
  paidAmountError?: string;
  /** The attached POS client's credit before this sale — omitted for a walk-in, where no credit
   *  exists to move (S5/D5), and while no amount has been entered yet (S32). */
  previousCredit?: number;
  /** Credit after this sale: previousCredit + (total − paidAmount), computed by the caller with
   *  S5's arithmetic. */
  newCredit?: number;
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires useConfirmSale() + the F4/Enter shortcuts
// (STF-02 §UI) around this. The credit preview (S6/I3) lives in this panel, above the paid-amount
// field, but the arithmetic itself is the caller's job (depends on whether a POS client is
// attached) — this only renders what's passed in. S32 — no "change due" line any more: a walk-in
// must pay the exact total and a client's overpayment goes to credit, so it was always 0 (P9).
export function PosPaymentPanel({
  paidAmount,
  onPaidAmountChange,
  onConfirm,
  isConfirming,
  paidAmountError,
  previousCredit,
  newCredit,
}: PosPaymentPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold">{t("staff.pos.payment.title")}</h3>

      {previousCredit !== undefined && newCredit !== undefined && (
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">
            {t("staff.pos.payment.creditPreviewLabel")}
          </span>
          <CreditMovementPreview previousCredit={previousCredit} newCredit={newCredit} />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="pos-paid-amount">{t("staff.pos.payment.paidAmountLabel")}</Label>
        <Input
          id="pos-paid-amount"
          type="number"
          min={0}
          step="0.01"
          value={paidAmount ?? ""}
          onChange={(e) =>
            onPaidAmountChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
        {paidAmountError && <FieldError>{paidAmountError}</FieldError>}
      </div>

      <Button className="w-full" onClick={onConfirm} disabled={isConfirming}>
        {t("staff.pos.payment.confirm")}
      </Button>
    </div>
  );
}
