import { forwardRef } from "react";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { resolvePosPrice, posPriceBreakdown } from "@/pages/staff/pos/pos-pricing";
import type { StaffProductDto } from "@dragon-telecom/contract";

interface PosProductSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  products?: StaffProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (product: StaffProductDto) => void;
  /** The attached POS client's category, if any — the card's right-hand price resolves to this
   *  category's price when one exists (S6/I1); the four-price breakdown beneath is unchanged. */
  attachedCategoryId?: string;
  /** Enter in the search box (a barcode scanner sends one after the digits) — the page adds the
   *  product whose barcode matches exactly. Optional: without it Enter does nothing, as before. */
  onSubmitCode?: (code: string) => void;
}

// Dumb, props-only (Sprint 4). Ref forwarded so Sprint 7 can wire the F2 barcode-scanner
// focus shortcut (STF-02 §UI) onto the input without this component owning key handling.
// S6/I1/I8: each card shows the price the attached client would actually be charged on the
// right, and a secondary, visually muted breakdown of the default plus every category price
// beneath it. S29: both the name and the breakdown line stay on one line and ellipsise at
// narrower widths (the ticket pane got more room, §6 of the S29 plan), with the full text in a
// native `title` tooltip — not a styled Radix tooltip, since a hover-delay popover on up to 20
// rapidly scanned/tapped cards would fight the scan-and-tap rhythm this page is built around.
// Owner change: Enter in the input calls `onSubmitCode` — the scanner's trailing Enter now adds the
// exact barcode match straight to the ticket instead of only filtering this list.
export const PosProductSearch = forwardRef<HTMLInputElement, PosProductSearchProps>(
  function PosProductSearch(
    {
      query,
      onQueryChange,
      products,
      isLoading,
      isError,
      onRetry,
      onSelect,
      attachedCategoryId,
      onSubmitCode,
    },
    ref,
  ) {
    const { t, language } = useTranslation();

    return (
      <div className="space-y-3">
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={ref}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !onSubmitCode || !query.trim()) return;
              e.preventDefault();
              onSubmitCode(query.trim());
            }}
            placeholder={t("staff.pos.search.placeholder")}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <NotFoundState
            icon={<Search className="h-5 w-5" />}
            title={t("staff.pos.search.error")}
            body=""
            action={
              onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  {t("common.actions.tryAgain")}
                </Button>
              )
            }
          />
        )}

        {!isLoading && !isError && (products?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title={t("staff.pos.search.empty")}
            body=""
          />
        )}

        {!isLoading && !isError && products && products.length > 0 && (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {products.map((product) => {
              const resolvedPrice = resolvePosPrice(
                product.categoryPrices,
                product.defaultSalePrice ?? 0,
                attachedCategoryId,
              );
              const breakdown = posPriceBreakdown(product);
              const breakdownTitle = [
                `${t("staff.pos.search.defaultPriceLabel")} ${formatDZD(product.defaultSalePrice ?? 0, language)}`,
                ...breakdown.map((entry) => `${entry.label} ${formatDZD(entry.price, language)}`),
              ].join(" · ");
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  disabled={product.availableQuantity <= 0}
                  className="flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left text-sm hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-medium" title={product.name}>
                      {product.name}
                    </div>
                    <div className="shrink-0 font-semibold">
                      {formatDZD(resolvedPrice, language)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {product.brand.name} · {product.availableQuantity} {t("common.units.inStock")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground" title={breakdownTitle}>
                    {t("staff.pos.search.defaultPriceLabel")}{" "}
                    {formatDZD(product.defaultSalePrice ?? 0, language)}
                    {breakdown.map((entry) => (
                      <span key={entry.label}>
                        {" · "}
                        {entry.label} {formatDZD(entry.price, language)}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
