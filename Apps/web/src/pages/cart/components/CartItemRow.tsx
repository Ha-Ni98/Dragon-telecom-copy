import { Heart, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { CartItemDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPrice } from "@/lib/price-format";
import { FieldError } from "@/components/shared/FieldError";

// S16 — no longer a per-row single-product order (that flow moved to the page-level
// OrderPlacementSection, D1: one order, N lines). This row is now a selectable checkout line:
// a checkbox (included in the next order), a local quantity stepper (R1 — ClientCart has no
// quantity column, so this is checkout-only state the parent owns), and, when the row can't be
// ordered (out of stock / no price for this viewer), a greyed-out reason (R2).
interface CartItemRowProps {
  item: CartItemDto;
  onRemove: () => void;
  isRemoving?: boolean;
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  blockedReason?: string;
}

// Same 99 ceiling the product page's stepper uses — the public DTO exposes only
// `inStock: boolean`, so the server's 409 is still the authoritative bound (S15/§5.1).
const MAX_ORDER_QUANTITY = 99;

export function CartItemRow({
  item,
  onRemove,
  isRemoving = false,
  included,
  onIncludedChange,
  quantity,
  onQuantityChange,
  blockedReason,
}: CartItemRowProps) {
  const { t } = useTranslation();
  const { product } = item;
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const isPriceable = !product.priceHidden && resolvedPrice !== undefined;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:gap-4">
      <Checkbox
        checked={included}
        onCheckedChange={(v) => onIncludedChange(v === true)}
        disabled={!!blockedReason}
        aria-label={t("cart.includeInOrder")}
      />

      <div className="flex items-center gap-4 sm:min-w-0 sm:flex-1">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {primaryImage && (
            <img
              src={primaryImage.thumbnailUrl ?? primaryImage.url}
              alt={primaryImage.alt ?? product.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className={`min-w-0 flex-1 space-y-1 ${blockedReason ? "opacity-60" : ""}`}>
          <p className="truncate font-medium text-foreground">{product.name}</p>
          <div className="flex items-center gap-2">
            {isPriceable ? (
              <span className="font-semibold text-primary">{formatPrice(resolvedPrice)}</span>
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
          {blockedReason && <FieldError className="text-xs">{blockedReason}</FieldError>}
          {!blockedReason && isPriceable && (
            <p className="text-sm text-muted-foreground">{formatPrice(resolvedPrice * quantity)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 sm:shrink-0">
        {!blockedReason && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label={t("product.decreaseQuantity")}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onQuantityChange(Math.min(MAX_ORDER_QUANTITY, quantity + 1))}
              disabled={quantity >= MAX_ORDER_QUANTITY}
              aria-label={t("product.increaseQuantity")}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label={t("cart.remove")}
          className="text-destructive hover:text-destructive/80 disabled:opacity-50"
        >
          <Heart className="h-5 w-5 fill-current" />
        </button>
      </div>
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
