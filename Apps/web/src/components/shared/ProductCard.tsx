import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetTile } from "@/components/shared/AssetTile";
import { useTranslation } from "@/hooks/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useLongPress } from "@/hooks/use-long-press";
import { useAddToCart, useRemoveFromCart } from "@/hooks/useClientPortal";
import { UserType, type ProductWithPricingDto } from "@dragon-telecom/contract";
import { formatPrice } from "@/lib/price-format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * ProductCard component props
 */
interface ProductCardProps {
  /** Product data to display */
  product: ProductWithPricingDto;
  /** Custom className for styling */
  className?: string;
  /** Optional marker badge on the card's top-left ("Featured" / "New" on the home rows). */
  label?: string;
}

/**
 * Product card — heart toggles the server favorites/cart (clients only, PUB-01/02 D2); ordering
 * itself happens on the product detail page's Order Now flow, so this card has no separate
 * "add to cart" action.
 *
 * S39 rebuild, sized for a 2.3-per-row strip on a phone:
 * - The WHOLE card is the link (stretched link on the name); the heart and the guest "sign in"
 *   link sit above it with z-10. No "View details" button, description or family line — on a
 *   ~150px card only the image, brand, name and price fit, and the price is meant to dominate.
 * - The name renders exactly as stored — no CSS text transform (it cannot recover "normal"
 *   capitalisation without breaking "iPhone"/"LG"). Two-line clamp; the full name is the native
 *   tooltip on hover and expands in place on a touch long-press (the click that follows is
 *   swallowed, so it does not navigate).
 * - The image box is the light AssetTile in both themes, with object-contain + padding, so
 *   transparent or light-background photos look the same in dark mode and a part is never cropped.
 * - The price is text-foreground, never the brand highlight: dominance comes from size and
 *   weight (the accent is for markers, not text).
 */
// Default shallow compare on props: react-query returns a stable `product` reference when nothing
// changed, and hands a *new* object when it did (including the inCart patch in useClientPortal.ts).
// The previous hand-written comparator ignored name/description/images, so a renamed or re-imaged
// product kept rendering its old content until the component happened to unmount (S20).
export const ProductCard = React.memo(function ProductCard({
  product,
  className = "",
  label,
}: ProductCardProps) {
  const { t } = useTranslation();
  // Heart visibility is client-only (plan.md D2) — read straight from the session for `type`.
  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;
  const addToCartMutation = useAddToCart();
  const removeFromCartMutation = useRemoveFromCart();
  const isTogglingCart = addToCartMutation.isPending || removeFromCartMutation.isPending;

  const [nameExpanded, setNameExpanded] = useState(false);
  const longPress = useLongPress(() => setNameExpanded(true));

  // Price resolution mirrors PUB-02/PUB-03: currentPrice (tier) wins, then guestPrice, else
  // hidden. priceHidden is server-resolved per viewer — this only reads it, never overrides it.
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const shouldShowPrice = !product.priceHidden && resolvedPrice !== undefined;

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  /**
   * Handle wishlist/cart toggle — global mutationCache already toasts on failure
   * (query-client.ts), so only the success path needs a local toast here.
   */
  const handleWishlistToggle = () => {
    if (product.inCart) {
      removeFromCartMutation.mutate(product.id, {
        onSuccess: () => toast.success(t("wishlist.removeSuccess")),
      });
    } else {
      addToCartMutation.mutate(
        { productId: product.id },
        {
          onSuccess: () => toast.success(t("wishlist.addSuccess")),
        },
      );
    }
  };

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden transition-shadow hover:ring-2 hover:ring-highlight focus-within:ring-2 focus-within:ring-highlight",
        className,
      )}
    >
      {/* Image — the light tile, both themes */}
      <AssetTile className="relative aspect-square rounded-none border-0 border-b">
        {primaryImage ? (
          <img
            // S26.1 — thumbnailUrl is the 400px grid derivative; falls back to the full-size
            // url for rows written before S26.1, which have no derivative.
            src={primaryImage.thumbnailUrl ?? primaryImage.url}
            alt={primaryImage.alt ?? product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <Package className="h-10 w-10" aria-hidden="true" />
        )}

        {/* Badges (S37: highlight markers, never a status colour) */}
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {!product.inStock ? (
            // Out of stock is the ONLY badge shown (owner request): no "Featured" / "New" marker
            // and no "In cart" on a product that cannot be bought. The light outlined style is
            // kept. (The heart still shows the favourite state for a signed-in client.)
            <Badge variant="highlightOutline" className="text-xs">
              {t("products.outStock")}
            </Badge>
          ) : (
            <>
              {/* The row's own marker ("Featured" / "New"), first so it stays top-left. Filled
                  highlight pairs with highlight-foreground (never white — S37). */}
              {label && (
                <Badge variant="highlight" className="text-xs">
                  {label}
                </Badge>
              )}
              {product.inCart && (
                <Badge variant="highlight" className="text-xs">
                  {t("cart.inCart")}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Heart — clients only; always visible on touch, revealed on hover from md up */}
        {isClient && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-asset-tile/90 text-asset-tile-foreground shadow-sm hover:bg-asset-tile hover:text-asset-tile-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            onClick={handleWishlistToggle}
            disabled={isTogglingCart}
            aria-label={t(
              product.inCart ? "wishlist.removeFromWishlist" : "wishlist.addToWishlist",
            )}
          >
            <Heart className={cn("h-4 w-4", product.inCart && "fill-highlight text-highlight")} />
          </Button>
        )}
      </AssetTile>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-xs text-muted-foreground">{product.brand.name}</p>
        <h3 className="min-h-[2.5em] text-sm font-medium leading-snug" title={product.name}>
          <Link
            to={`/products/${product.id}`}
            // Stretched link: the ::after covers the whole card. -webkit-touch-callout keeps iOS
            // from opening its link sheet on the long-press that expands the name instead.
            className={cn(
              "[-webkit-touch-callout:none] after:absolute after:inset-0 focus-visible:outline-none",
              !nameExpanded && "line-clamp-2",
            )}
            {...longPress}
          >
            {product.name}
          </Link>
        </h3>

        {/* Price — the dominant element */}
        <div className="mt-auto pt-1">
          {shouldShowPrice && resolvedPrice !== undefined ? (
            <p className="text-lg font-extrabold leading-tight text-foreground sm:text-xl">
              {formatPrice(resolvedPrice)}
            </p>
          ) : (
            <p className="relative z-10 text-xs text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("products.signIn")}
              </Link>{" "}
              {t("products.viewPrices")}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
});
