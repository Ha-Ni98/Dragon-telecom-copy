import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useAddToCart, useRemoveFromCart } from "@/hooks/useClientPortal";
import { UserType, type ProductWithPricingDto } from "@dragon-telecom/contract";
import { formatPrice } from "@/lib/price-format";
import { toast } from "sonner";

/**
 * ProductCard component props
 */
interface ProductCardProps {
  /** Product data to display */
  product: ProductWithPricingDto;
  /** Custom className for styling */
  className?: string;
}

/**
 * Product card — heart toggles the server favorites/cart (clients only, PUB-01/02 D2); ordering
 * itself happens on the product detail page's Order Now flow, so this card has no separate
 * "add to cart" action.
 */
// Default shallow compare on props: react-query returns a stable `product` reference when nothing
// changed, and hands a *new* object when it did (including the inCart patch in useClientPortal.ts).
// The previous hand-written comparator ignored name/description/images, so a renamed or re-imaged
// product kept rendering its old content until the component happened to unmount (S20).
export const ProductCard = React.memo(function ProductCard({
  product,
  className = "",
}: ProductCardProps) {
  const { t } = useTranslation();
  // Heart visibility is client-only (plan.md D2) — read straight from the session for `type`.
  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;
  const addToCartMutation = useAddToCart();
  const removeFromCartMutation = useRemoveFromCart();
  const isTogglingCart = addToCartMutation.isPending || removeFromCartMutation.isPending;

  const navigate = useNavigate();

  // Price resolution mirrors PUB-02/PUB-03: currentPrice (tier) wins, then guestPrice, else
  // hidden. priceHidden is server-resolved per viewer — this only reads it, never overrides it.
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const shouldShowPrice = !product.priceHidden && resolvedPrice !== undefined;

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  /**
   * Handle viewing product details
   */
  const handleViewDetails = () => {
    // PUB-03: routes "by id — never by name" (D1).
    navigate(`/products/${product.id}`);
  };

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
      className={`group product-card border-0 shadow-card hover:ring-2 hover:ring-highlight focus-within:ring-2 focus-within:ring-highlight transition-all duration-300 ${className}`}
    >
      <CardContent className="p-0">
        <div className="relative">
          {/* Product Image */}
          <div
            className="aspect-square bg-gradient-to-br from-primary/5 to-accent/5 rounded-t-lg flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={handleViewDetails}
          >
            {primaryImage ? (
              <img
                // S26.1 — thumbnailUrl is the 400px grid derivative; falls back to the full-size
                // url for rows written before S26.1, which have no derivative.
                src={primaryImage.thumbnailUrl ?? primaryImage.url}
                alt={primaryImage.alt ?? product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <span className="text-4xl">📱</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {!product.inStock && (
              <Badge variant="highlightOutline" className="text-xs">
                {t("products.outStock")}
              </Badge>
            )}
            {product.inCart && (
              <Badge variant="highlight" className="text-xs">
                {t("cart.inCart")}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex gap-2">
            {isClient && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-white/80 hover:bg-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleWishlistToggle}
                disabled={isTogglingCart}
                aria-label={t(
                  product.inCart ? "wishlist.removeFromWishlist" : "wishlist.addToWishlist",
                )}
              >
                <Heart
                  className={`h-4 w-4 text-black-500   ${product.inCart ? "fill-red-500 text-red-500" : ""}`}
                />
              </Button>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-muted-foreground">{product.brand.name}</p>
            </div>
            <h3 className="font-semibold text-lg leading-tight line-clamp-2 mb-2">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {product.description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{product.family.name}</span>
              {product.model && <span>{product.model.name}</span>}
            </div>
          </div>

          {/* Price */}
          {shouldShowPrice && resolvedPrice !== undefined ? (
            <div className="text-lg font-bold text-primary">{formatPrice(resolvedPrice)}</div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              <span
                className="text-primary font-medium cursor-pointer hover:underline"
                onClick={() => navigate("/login")}
              >
                {t("products.signIn")}
              </span>{" "}
              {t("products.viewPrices")}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleViewDetails} className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              {t("products.viewDetails")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
