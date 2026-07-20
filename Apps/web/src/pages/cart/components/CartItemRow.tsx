import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CartItemDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Dumb, props-only (Sprint 4 — primitives before wiring, Sprint 5 wires useClientCart/
// useRemoveFromCart/ProductOrderModal around this). "Price on request" + disabled Order
// mirrors PUB-04's requirement verbatim: a product no longer priced for this viewer shows that
// copy with Order disabled, distinct from priceOnRequest — availability (in/out of stock) is a
// separate chip.
interface CartItemRowProps {
  item: CartItemDto;
  onOrder: () => void;
  onRemove: () => void;
  isRemoving?: boolean;
}

export function CartItemRow({ item, onOrder, onRemove, isRemoving = false }: CartItemRowProps) {
  const { t } = useTranslation();
  const { product } = item;
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const isPriceable = !product.priceHidden && resolvedPrice !== undefined;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {primaryImage && (
          <img
            src={primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-foreground">{product.name}</p>
        <div className="flex items-center gap-2">
          {isPriceable ? (
            <span className="font-semibold text-primary">{formatDZD(resolvedPrice)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t("cart.priceOnRequest")}</span>
          )}
          <span
            className={
              product.inStock
                ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {t(product.inStock ? "product.inStock" : "cart.outOfStock")}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        aria-label={t("cart.remove")}
        className="shrink-0 text-destructive hover:text-destructive/80 disabled:opacity-50"
      >
        <Heart className="h-5 w-5 fill-current" />
      </button>

      <Button
        onClick={onOrder}
        disabled={!isPriceable || !product.inStock}
        size="sm"
        className="shrink-0"
      >
        {t("cart.order")}
      </Button>
    </div>
  );
}

export function CartItemRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
    </div>
  );
}
