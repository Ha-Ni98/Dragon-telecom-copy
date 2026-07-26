/**
 * ProductPricingSection Component
 * Displays the price block by viewer, a quantity stepper, and the Order Now entry point
 * into ProductOrderModal (which owns the actual order form — see plan.md PUB-03 §4).
 */

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, ShoppingCart, EyeOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ProductDetailDto } from "@dragon-telecom/contract";

interface ProductPricingSectionProps {
  product: ProductDetailDto;
  className?: string;
  onOrderNow?: (quantity: number) => void;
}

// The public/client detail DTO deliberately has no exact stock count (catalog.dtos.ts: "no cost,
// no exact quantities, boolean inStock only") — this bounds the stepper's UI to a sane ceiling.
// The server remains the authoritative check (409 INSUFFICIENT_STOCK on submit, plan.md D6/PUB-03).
const MAX_ORDER_QUANTITY = 99;

export const ProductPricingSection = ({
  product,
  className,
  onOrderNow,
}: ProductPricingSectionProps) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const { isAuthenticated: authStatus } = useAuth();

  // Server-resolved per viewer (catalog.dtos.ts) — currentPrice covers the approved-client tier,
  // guestPrice covers both the guest fallback and the "else guestPrice" client fallback (PUB-03).
  const resolvedPrice = product.currentPrice ?? product.guestPrice;
  const priceAvailable = resolvedPrice !== undefined;

  const handleQuantityChange = useCallback((newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= MAX_ORDER_QUANTITY) {
      setQuantity(newQuantity);
    }
  }, []);

  const incrementQuantity = useCallback(() => {
    handleQuantityChange(quantity + 1);
  }, [quantity, handleQuantityChange]);

  const decrementQuantity = useCallback(() => {
    handleQuantityChange(quantity - 1);
  }, [quantity, handleQuantityChange]);

  const handleOrderNow = () => {
    onOrderNow?.(quantity);
  };

  const totalPrice = useMemo(() => {
    return priceAvailable ? resolvedPrice * quantity : 0;
  }, [priceAvailable, resolvedPrice, quantity]);

  // Guest with no guestPrice exposed (priceHidden) can't order (PUB-03: "Order disabled").
  const orderDisabled = !product.inStock || (!authStatus && !priceAvailable);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{t("product.title")}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price Display */}
        <div className="space-y-2">
          {priceAvailable ? (
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold text-primary">
                {resolvedPrice.toLocaleString()} DA
              </span>
            </div>
          ) : authStatus ? (
            <div className="text-lg font-medium text-muted-foreground">
              {t("product.publicPrice")}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <EyeOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-lg font-medium text-muted-foreground">
                  {t("product.signInToSeePrice")}
                </span>
              </div>
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
                disabled={quantity >= MAX_ORDER_QUANTITY}
                aria-label={t("product.increaseQuantity")}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {quantity > 1 && priceAvailable && (
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
            <Button
              onClick={handleOrderNow}
              disabled={orderDisabled}
              className="w-full"
              size="lg"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t("product.orderNow")}
            </Button>
          ) : (
            <Button disabled className="w-full" size="lg">
              {t("products.outStock")}
            </Button>
          )}
        </div>

        {/* Product Information */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>{t("product.brand")}:</span>
            <span>{product.brand.name}</span>
          </div>
          {product.model && (
            <div className="flex justify-between">
              <span>{t("product.model")}:</span>
              <span>{product.model.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t("product.family")}:</span>
            <span>{product.family.name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
