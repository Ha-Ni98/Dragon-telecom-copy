/**
 * ProductPricingSection Component
 * Handles product pricing display based on user rights and category
 */

import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, ShoppingCart, Heart, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useProductOrder } from "@/hooks/use-product-order";
import { useAuth } from '@/components/providers/AuthProvider';
import type { ProductDetails } from "@/types/draft-types";

interface ProductPricingSectionProps {
  product: ProductDetails;
  className?: string;
  onAddToCart?: (productId: number) => void;
  onAddToWishlist?: (productId: number) => void;
  onOrderNow?: (productId: number, quantity: number, price: number) => void;
}

export const ProductPricingSection = memo(function ProductPricingSection({
  product,
  className,
  onAddToCart,
  onAddToWishlist,
  onOrderNow
}: ProductPricingSectionProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const { isAuthenticated: authStatus } = useAuth();
  // Cart isn't wired yet (deferred to Sub-02, decision #2) — these are the typed empty
  // defaults that keep the add-to-cart UI rendering without persisting anything.
  const isProductInCart = (_productId: number) => false;
  const addToCart = async (_product: ProductDetails, _quantity: number) => {};
  const removeFromCart = (_productId: number) => {};
  const isLoading = false;
  const userCategory = null;
  const error = false;

  const {
    createOrder,
    isCreatingOrder,
    orderError,
    clearError
  } = useProductOrder();

  // Handle quantity changes
  const handleQuantityChange = useCallback((newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= product.stockQuantity) {
      setQuantity(newQuantity);
    }
  }, [product.stockQuantity]);

  const incrementQuantity = useCallback(() => {
    handleQuantityChange(quantity + 1);
  }, [quantity, handleQuantityChange]);

  const decrementQuantity = useCallback(() => {
    handleQuantityChange(quantity - 1);
  }, [quantity, handleQuantityChange]);

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!authStatus) {
      toast.error('Please sign in to add items to cart');
      //navigate('/login');
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

  // Handle order now
  const handleOrderNow = async () => {
    if (!onOrderNow) return;
    
    setIsOrdering(true);
    try {
      await onOrderNow(product.idProduct, quantity, product.currentPrice ?? 0);
    } finally {
      setIsOrdering(false);
    }
  };

  // Calculate total price
  const totalPrice = useMemo(() => {
    return product.currentPrice ? product.currentPrice * quantity : 0;
  }, [product.currentPrice ?? 0, quantity]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("product.title")}</span>
          {product.isNew && (
            <Badge variant="destructive" className="ml-2">
              {t("products.new")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Price Display */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-muted-foreground">{t("common.loading")}</span>
            </div>
          ) : error ? (
            <div className="text-destructive text-sm">
              {t("common.error")}: {error}
            </div>
          ) : authStatus ? (
            <div className="space-y-1">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-primary">
                  {product.currentPrice?.toLocaleString()} DA
                </span>
                {userCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {userCategory}
                  </Badge>
                )}
              </div>
              
              {/* {priceBreakdown && (
                <div className="text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span>{priceBreakdown.basePrice.toLocaleString()} DA</span>
                  </div>
                  {priceBreakdown.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({priceBreakdown.discountPercentage}%):</span>
                      <span>-{priceBreakdown.discount.toLocaleString()} DA</span>
                    </div>
                  )}
                </div>
              )} */}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-lg font-medium text-muted-foreground">
                  {t("product.signInToSeePrice")}
                </span>
              </div>
              {product.noUserPrice && (
                <div className="text-sm text-muted-foreground">
                  {t("product.publicPrice")}: {product.noUserPrice.toLocaleString()} DA
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Stock Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("product.stock")}:</span>
            <div className="flex items-center space-x-2">
              {product.inStock ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">
                    {t("product.inStock")} 
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-600">
                    {t("products.outStock")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quantity Selector */}
        {product.inStock && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("product.quantity")}:</label>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                aria-label={t("product.decreaseQuantity")}
              >
                <Minus className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center justify-center w-16 h-10 border rounded-md">
                <span className="text-lg font-medium">{quantity}</span>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={incrementQuantity}
                disabled={quantity >= product.stockQuantity}
                aria-label={t("product.increaseQuantity")}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {quantity > 1 && product.currentPrice && (
              <div className="text-sm text-muted-foreground">
                {t("product.totalPrice")}: {totalPrice.toLocaleString()} DA
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          {product.inStock ? (
            <>
              {/* Order Now Button */}
              <Button
                onClick={handleOrderNow}
                disabled={isOrdering || !authStatus}
                className="w-full"
                size="lg"
              >
                {isOrdering ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("common.processing")}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t("product.orderNow")}
                  </>
                )}
              </Button>

              {/* Add to Cart Button 
              {onAddToCart && (
                <Button
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart || !authStatus}
                  className="w-full"
                >
                  {isAddingToCart ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      {t("common.adding")}
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t("products.addCart")}
                    </>
                  )}
                </Button>
              )} */}

                </>
              ) : (
                <Button
                  disabled
                  className="w-full"
                  size="lg"
                >
                  {t("products.outStock")}
                </Button>
              )}

              
            </div>

        {/* Product Information */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>{t("product.brand")}:</span>
            <span>{product.brand.brandName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("product.model")}:</span>
            <span>{product.model.modelName}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("product.family")}:</span>
            <span>{product.family.familyName}</span>
          </div>
        </div>

        {/* Features Preview 
        {product.features && product.features.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("product.keyFeatures")}:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {product.features.slice(0, 3).map((feature, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>{feature}</span>
                </li>
              ))}
              {product.features.length > 3 && (
                <li className="text-xs text-muted-foreground">
                  +{product.features.length - 3} {t("product.moreFeatures")}
                </li>
              )}
            </ul>
          </div>
        )} */}

        {/* Error Messages */}
        {orderError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{orderError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="mt-2 text-red-600 hover:text-red-700"
            >
              {t("common.dismiss")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
