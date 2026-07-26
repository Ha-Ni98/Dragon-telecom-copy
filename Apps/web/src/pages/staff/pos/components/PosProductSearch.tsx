import { forwardRef } from "react";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { StaffProductDto } from "@dragon-telecom/contract";

interface PosProductSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  products?: StaffProductDto[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelect: (product: StaffProductDto) => void;
}

// Dumb, props-only (Sprint 4). Ref forwarded so Sprint 7 can wire the F2 barcode-scanner
// focus shortcut (STF-02 §UI) onto the input without this component owning key handling.
export const PosProductSearch = forwardRef<HTMLInputElement, PosProductSearchProps>(
  function PosProductSearch(
    { query, onQueryChange, products, isLoading, isError, onRetry, onSelect },
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
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                disabled={product.availableQuantity <= 0}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.brand.name} · {product.availableQuantity} {t("common.units.inStock")}
                  </div>
                </div>
                <div className="shrink-0 font-semibold">
                  {formatDZD(product.defaultSalePrice ?? 0, language)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
