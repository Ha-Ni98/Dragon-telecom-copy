import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, ShoppingCart, Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ProductWithDetails } from '@/types/draft-types/main-page.types';
import { formatDZD } from '@/lib/utils';
import { productNameToKebabCase } from '@/lib/utils/product-utils';
import { toast } from 'sonner';

/**
 * ProductCard component props
 */
interface ProductCardProps {
  /** Product data to display */
  product: ProductWithDetails;
  /** Whether to show price (overrides authentication check) */
  showPrice?: boolean;
  /** Callback when product is added to cart */
  onAddToCart?: (productId: number) => void;
  /** Callback when product details are viewed */
  onViewDetails?: (productId: number) => void;
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
  // Cart isn't wired yet (deferred to Sub-02, decision #2) — these are the typed empty
  // defaults that keep the add-to-cart UI rendering without persisting anything.
  const isProductInCart = (_productId: number) => false;
  const getProductQuantity = (_productId: number) => 0;
  const addToCart = async (_product: ProductWithDetails, _quantity: number) => {};
  const removeFromCart = (_productId: number) => {};

  const navigate = useNavigate();
  
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  // Determine if user is authenticated (use prop or context)
  const userIsAuthenticated = isAuthenticated ?? authStatus;
  
  // Determine if price should be shown
  const shouldShowPrice = showPrice ?? userIsAuthenticated;
  
  // Check if product is in cart and wishlist
  const inCart = isProductInCart(product.idProduct);
  const cartQuantity = getProductQuantity(product.idProduct);
  const isWishlisted = isProductInCart(product.idProduct);

  /**
   * Handle adding product to cart
   */
  const handleAddToCart = async () => {
    if (!userIsAuthenticated) {
      toast.error('Please sign in to add items to cart');
      navigate('/login');
      return;
    }

    if (!product.inStock) {
      toast.error('Product is out of stock');
      return;
    }

    try {
      setIsAddingToCart(true);
      if (!isProductInCart(product.idProduct)) {
      await addToCart(product, 1);
      toast.success(t('cart.addSuccess'));
      onAddToCart?.(product.idProduct);
      } else {
        toast.success(t('cart.removeSuccess'));
        removeFromCart(product.idProduct);
      }
    } catch (error) {
      toast.error('Failed to add product to cart');
      console.error('Add to cart error:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  /**
   * Handle viewing product details
   */
  const handleViewDetails = () => {
    const productSlug = productNameToKebabCase(product.productName);
    navigate(`/products/${productSlug}`);
    onViewDetails?.(product.idProduct);
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
      const wasAdded = !isProductInCart(product.idProduct);
      if (wasAdded) {
        toast.success(t('wishlist.addSuccess'));
        addToCart(product, 1);
      } else {
        toast.success(t('wishlist.removeSuccess'));
        removeFromCart(product.idProduct);
      }
    } catch (error) {
      toast.error('Failed to update wishlist');
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
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.productName}
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
            {inCart && (
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
                <Heart className={`h-4 w-4 text-black-500   ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
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
              <p className="text-sm text-muted-foreground">{product.brand.brandName}</p>
              {product.isNew && (
                <Badge variant="destructive" className="text-xs">
                  {t('products.new')}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-lg leading-tight line-clamp-2 mb-2">{product.productName}</h3>
            {product.productDescription && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {product.productDescription}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{product.family.familyName}</span>
              <span>{product.model.modelName}</span>
            </div>
          </div>

          {/* Rating 
          {product.rating && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-medium ml-1">{product.rating}</span>
              </div>
              {product.reviews && (
                <span className="text-sm text-muted-foreground">
                  ({product.reviews} {t('products.reviews')})
                </span>
              )}
            </div>
          )}*/}

          {/* Features 
          {product.features && product.features.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {product.features.slice(0, 2).map((feature, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {feature}
                  </Badge>
                ))}
                {product.features.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{product.features.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )}*/}

          {/* Price */}
          {shouldShowPrice && product.price ? (
            <div className="text-lg font-bold text-primary">
              {formatDZD(product.price)}
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
                  ) : inCart ? (
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
    prevProps.product.idProduct === nextProps.product.idProduct &&
    prevProps.product.inStock === nextProps.product.inStock &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.showPrice === nextProps.showPrice &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.error === nextProps.error &&
    prevProps.showWishlist === nextProps.showWishlist &&
    prevProps.showQuickView === nextProps.showQuickView
  );
});

export default ProductCard;
