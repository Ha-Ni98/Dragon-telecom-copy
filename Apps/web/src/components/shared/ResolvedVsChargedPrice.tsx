import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, cn } from "@/lib/utils";

interface ResolvedVsChargedPriceProps {
  /** The system-computed price (category/default resolution) — SaleDto.lines[].resolvedPrice, OrderDto.resolvedPrice. */
  resolvedPrice: number;
  /** The actual charged price — SaleDto.lines[].unitPrice, OrderDto.unitPrice (may be staff-overridden). */
  unitPrice: number;
  className?: string;
}

// Shared by the POS ticket (a draft line's live resolution, before any Sale exists), the sale
// detail drawer (SaleDto.lines, STF-05/ADM-10), and the order show/confirm dialogs (OrderDto,
// STF-04/ADM-09) — every place a resolved-vs-overridden price pair appears. Takes the two raw
// numbers rather than a whole DTO since the POS ticket's lines are client-side draft state, not
// yet a persisted SaleDto — the field *names* still mirror the contract exactly.
// Invoice snapshot lines carry no resolvedPrice (frozen at unitPrice only) — not a caller here.
export function ResolvedVsChargedPrice({
  resolvedPrice,
  unitPrice,
  className,
}: ResolvedVsChargedPriceProps) {
  const { t, language } = useTranslation();
  const overridden = unitPrice !== resolvedPrice;

  return (
    <div className={cn("text-sm", className)}>
      <div className={cn("font-medium", overridden && "text-warning-foreground")}>
        {formatDZD(unitPrice, language)}
      </div>
      {overridden && (
        <div className="text-xs text-muted-foreground line-through">
          <span>{t("common.pricing.resolvedPrice")}</span>: {formatDZD(resolvedPrice, language)}
        </div>
      )}
    </div>
  );
}
