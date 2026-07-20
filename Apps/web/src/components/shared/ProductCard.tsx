import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/components/providers/AuthProvider';
import type { ProductWithPricingDto } from '@dragon-telecom/contract';
import { formatDZD } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * ProductCard component props
 */
interface ProductCardProps {
  /** Product data to display */
  product: ProductWithPricingDto;
  /** Whether to show price (overrides authentication check) */
  showPrice?: boolean;
  /** Callback when product is added to cart */
  onAddToCart?: (productId: string) => void;
  /** Callback when product details are viewed */
  onViewDetails?: (productId: string) => void;
  /** Whether user is authenticated (overrides auth context) */
  isAuthenticated?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string;
  /** Custom className for styling */
  className?: string;
  /** Whether to show wishlist button */
  showWishlist?: boolean;
  /** Whether to show quick view button */
  showQuickView?: boolean;
}

/**
 * Enhanced ProductCard component with cart integration and authentication-based features
 */
export const ProductCard: React.FC<ProductCardProps> = React.memo(({
  product,
  showPrice,
  onAddToCart,
  onViewDetails,
  isAuthenticated,
  isLoading = false,
  error,
  className = '',
  showWishlist = true,
  showQuickView = false
}) => {
  const { t } = useTranslation();
  const { isAuthenticated: authStatus } = useAuth();
  // Cart mutations (useAddToCart/useRemoveFromCart) aren't wired yet (deferred to the pub-pages
  // Sprint 5/6 assembly) — `inCart` itself is real (server-resolved on the DTO), only the toggle
  // action is still an inert placeholder. Heart visibility is client-only per plan.md D2, but
  // useAuth() doesn't expose session `type` — narrowing "client" vs "authenticated" is a Sprint
  // 5/6 concern; this stays gated on plain authentication for now, matching prior behavior.
  const addToCart = async (_productId: string) => {};
  const removeFromCart = (_productId: string) => {};

  const navigate = useNavigate();

  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Determine if user is authenticated (use prop or context)
  const userIsAuthenticated = isAuthenticated ?? authStatus;

  // Price resolution mirrors PUB-02/PUB-03: currentPrice (tier) wins, then guestPrice, else
  // hidden. priceHidden is server-resolved per viewer — trust it over the showPrice override
  // except when a caller explicitly forces it off.
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const shouldShowPrice = (showPrice ?? true) && !product.priceHidden && resolvedPrice !== undefined;

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  /**
   * Handle adding product to cart
   */
  const handleAddToCart = async () => {
    if (!userIsAuthenticated) {
      toast.error(t('cart.signInRequired'));
      navigate('/login');
      return;
    }

    if (!product.inStock) {
      toast.error(t('cart.outOfStock'));
      return;
    }

    try {
      setIsAddingToCart(true);
      if (!product.inCart) {
        await addToCart(product.id);
        toast.success(t('cart.addSuccess'));
        onAddToCart?.(product.id);
      } else {
        toast.success(t('cart.removeSuccess'));
        removeFromCart(product.id);
      }
    } catch (error) {
      toast.error(t('cart.addError'));
      console.error('Add to cart error:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  /**
   * Handle viewing product details
   */
  const handleViewDetails = () => {
    // PUB-03: routes "by id — never by name" (D1).
    navigate(`/products/${product.id}`);
    onViewDetails?.(product.id);
  };

  /**
   * Handle wishlist toggle
   */
  const handleWishlistToggle = () => {
    if (!userIsAuthenticated) {
      toast.error(t('wishlist.signInRequired'));
      navigate('/login');
      return;
    }

    try {
      const wasAdded = !product.inCart;
      if (wasAdded) {
        toast.success(t('wishlist.addSuccess'));
        addToCart(product.id);
      } else {
        toast.success(t('wishlist.removeSuccess'));
        removeFromCart(product.id);
      }
    } catch (error) {
      toast.error(t('cart.addError'));
      console.error('Wishlist toggle error:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={`product-card border-0 shadow-card ${className}`}>
        <CardContent className="p-0">
          <Skeleton className="aspect-square rounded-t-lg" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`product-card border-0 shadow-card ${className}`}>
        <CardContent className="p-4">
          <div className="text-center text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`group product-card border-0 shadow-card hover:shadow-elegant transition-all duration-300 ${className}`}>
      <CardContent className="p-0">
        <div className="relative">
          {/* Product Image */}
          <div
            className="aspect-square bg-gradient-to-br from-primary/5 to-accent/5 rounded-t-lg flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={handleViewDetails}
          >
            {primaryImage ? (
              <img
                src={primaryImage.url}
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
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                {t('products.outStock')}
              </Badge>
            )}
            {product.inCart && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                {t('cart.inCart')}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex gap-2">
            {showWishlist && userIsAuthenticated && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-white/80 hover:bg-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleWishlistToggle}
              >
                <Heart className={`h-4 w-4 text-black-500   ${product.inCart ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
            )}
            {showQuickView && (
              <Button
                size="icon"
                variant="ghost"
                className="bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleViewDetails}
              >
                <Eye className="h-4 w-4" />
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
            <h3 className="font-semibold text-lg leading-tight line-clamp-2 mb-2">{product.name}</h3>
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
            <div className="text-lg font-bold text-primary">
              {formatDZD(resolvedPrice)}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              <span
                className="text-primary font-medium cursor-pointer hover:underline"
                onClick={() => navigate('/login')}
              >
                {t('products.signIn')}
              </span> {t('products.viewPrices')}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {userIsAuthenticated ? (
              <>
                <Button
                  className="flex-1"
                  size="sm"
                  disabled={!product.inStock || isAddingToCart}
                  onClick={handleAddToCart}
                >
                  {isAddingToCart ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : product.inCart ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      In Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {product.inStock ? t('products.addCart') : t('products.outStock')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewDetails}
                  className="px-3"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewDetails}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                {t('products.viewDetails')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.inStock === nextProps.product.inStock &&
    prevProps.product.inCart === nextProps.product.inCart &&
    prevProps.product.currentPrice === nextProps.product.currentPrice &&
    prevProps.product.guestPrice === nextProps.product.guestPrice &&
    prevProps.showPrice === nextProps.showPrice &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.error === nextProps.error &&
    prevProps.showWishlist === nextProps.showWishlist &&
    prevProps.showQuickView === nextProps.showQuickView
  );
});

export default ProductCard;
