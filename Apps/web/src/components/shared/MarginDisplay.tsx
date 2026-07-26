import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export function marginPercent(price?: number | null, cost?: number | null): number | undefined {
  if (price == null || Number.isNaN(price) || !cost) return undefined;
  return ((price - cost) / cost) * 100;
}

interface MarginDisplayProps {
  /** The sale price being evaluated. Undefined/null/NaN renders nothing. */
  price?: number | null;
  /** The cost basis — always avgStockPrice per D10 (or, on Add Product, the initial unit cost). */
  cost?: number | null;
  className?: string;
}

// RC-2 shared margin display: one place for the value + colour rule (> 0 green, <= 0 red) and
// the "no cost basis yet" fallback (a product with no stock has avgStockPrice = 0, and dividing
// by that must never print Infinity%/NaN%). A plain function of props, so it recomputes on every
// render of its parent — the fix for "margin goes stale as the price changes" is simply that the
// parent passes a live (watched) value here instead of a fetched one.
export function MarginDisplay({ price, cost, className }: MarginDisplayProps) {
  const { t } = useTranslation();

  if (price == null || Number.isNaN(price)) return null;

  if (cost == null || !cost) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {t("common.margin.noCostBasis")}
      </p>
    );
  }

  const value = marginPercent(price, cost)!;
  return (
    <p className={cn("text-xs", value > 0 ? "text-success" : "text-destructive", className)}>
      {t("common.margin.label")}: {value.toFixed(1)}%
    </p>
  );
}
