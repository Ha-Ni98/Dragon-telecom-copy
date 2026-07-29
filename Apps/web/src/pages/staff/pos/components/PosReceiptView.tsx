import { Printer, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface PosReceiptViewProps {
  total: number;
  previousCredit: number;
  grandTotal: number;
  paid: number;
  newCredit: number;
  onPrint: () => void;
  /** Returns to a fresh, empty ticket (S6/I2) — the receipt view's own draft has already become
   *  the completed sale, so this never deletes anything, unlike the ticket's Clear button. */
  onNewSale: () => void;
}

// Dumb, props-only (Sprint 4) — Sprint 7 renders this from the useConfirmSale() result
// (STF-02 §Interactions: "receipt view (total · previous credit · grand total · paid · new
// credit) with print"). Not built on CreditMovementPreview — the receipt is a fixed 5-row
// layout, not a 2-value prev→new preview. S6/I2 adds a "New sale" action beside Print.
export function PosReceiptView({
  total,
  previousCredit,
  grandTotal,
  paid,
  newCredit,
  onPrint,
  onNewSale,
}: PosReceiptViewProps) {
  const { t, language } = useTranslation();

  const row = (label: string, value: number, emphasis = false) => (
    <div
      className={`flex items-center justify-between ${emphasis ? "text-lg font-bold" : "text-sm"}`}
    >
      <span className={emphasis ? "" : "text-muted-foreground"}>{label}</span>
      <span className={emphasis ? "" : "font-medium"}>{formatDZD(value, language)}</span>
    </div>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold">{t("staff.pos.receipt.title")}</h3>
      {row(t("staff.pos.ticket.total"), total)}
      {row(t("staff.pos.receipt.previousCredit"), previousCredit)}
      <Separator />
      {row(t("staff.pos.receipt.grandTotal"), grandTotal, true)}
      {row(t("staff.pos.receipt.paid"), paid)}
      {row(t("staff.pos.receipt.newCredit"), newCredit)}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          {t("staff.pos.receipt.print")}
        </Button>
        <Button className="flex-1" onClick={onNewSale}>
          <Plus className="mr-2 h-4 w-4" />
          {t("staff.pos.receipt.newSale")}
        </Button>
      </div>
    </div>
  );
}
