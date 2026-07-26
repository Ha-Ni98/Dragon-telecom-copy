import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, cn } from "@/lib/utils";

interface CreditMovementPreviewProps {
  /** ClientDto/SupplierDto credit before the movement (POS confirm, payment dialogs, sale/invoice snapshots). */
  previousCredit: number;
  /** Credit after the movement — same call previews it before submit and echoes it after (spec: "previews ... before submit and echoes it after"). */
  newCredit: number;
  className?: string;
}

// Shared by every screen that previews-then-echoes a credit movement: POS payment panel +
// receipt (STF-02), RecordPaymentDialog (STF-06/ADM-14), RecordSupplierPaymentDialog (ADM-14),
// the admin sale detail credit snapshot (ADM-10). Pure presentational — the caller always
// already has both numbers (either from a live computation or a persisted DTO field), so this
// never fetches. Reuses invoices.detail.previousCredit/newCredit (existing keys, same meaning).
export function CreditMovementPreview({
  previousCredit,
  newCredit,
  className,
}: CreditMovementPreviewProps) {
  const { t, language } = useTranslation();
  const increased = newCredit > previousCredit;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm",
        className,
      )}
    >
      <div>
        <div className="text-muted-foreground">{t("invoices.detail.previousCredit")}</div>
        <div className="font-medium">{formatDZD(previousCredit, language)}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="text-right">
        <div className="text-muted-foreground">{t("invoices.detail.newCredit")}</div>
        <div className={cn("font-semibold", increased ? "text-destructive" : "text-success")}>
          {formatDZD(newCredit, language)}
        </div>
      </div>
    </div>
  );
}
