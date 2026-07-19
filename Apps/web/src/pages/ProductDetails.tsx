import React, { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Star, Package, Truck, Store, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import { useProductDetails } from "@/hooks/use-product-details";
import { useProductOrder } from "@/hooks/use-product-order";
import { ProductImageGallery } from "@/components/sections/product-details/ProductImageGallery";
import { ProductCategoryTags } from "@/components/shared/ProductCategoryTags";
import { ProductPricingSection } from "@/components/sections/product-details/ProductPricingSection";
import { ProductOrderModal } from "@/components/shared/ProductOrderModal";
import { ProductErrorBoundary } from "@/components/shared/ProductErrorBoundary";
import { kebabCaseToProductName } from "@/lib/utils/product-utils";
import { toast } from "sonner";
import type { OrderData } from "@/types/draft-types";

export default function ProductDetails() {
  const { productName } = useParams<{ productName: string }>();
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [currentProductPrice, setCurrentProductPrice] = useState(0);

  // Convert kebab-case product name back to display name
  const displayProductName = productName ? kebabCaseToProductName(productName) : "";

  // Fetch product details by name
  const {
    data: product,
    isLoading,
    isError,
    error
  } = useProductDetails(displayProductName);

  const {
    createOrder,
    isCreatingOrder,
    orderError,
    lastOrderId,
    clearError
  } = useProductOrder();

  // Handle add to cart
  const handleAddToCart = async (productId: number, quantity: number) => {
    try {
      // This would integrate with the cart system
      toast.success(t("cart.addSuccess"));
      console.log(`Added ${quantity} of product ${productId} to cart`);
    } catch (error) {
      toast.error(t("cart.addError"));
      console.error("Add to cart error:", error);
    }
  };

  // Handle order now
  const handleOrderNow = async (productId: number, quantity: number, price: number) => {
    if (!product) return;
    
    setQuantity(quantity);
    setCurrentProductPrice(price);
    setIsOrderModalOpen(true);
  };

  // Handle order modal close
  const handleOrderModalClose = () => {
    setIsOrderModalOpen(false);
    clearError();
  };

  // Handle order submission
  const handleOrderSubmit = async (orderData: OrderData) => {
    try {
      const orderId = await createOrder(orderData);
      toast.success(t("product.orderSuccess"));
      console.log("Order created:", orderId);
      setIsOrderModalOpen(false);
    } catch (error) {
      toast.error(t("product.orderError"));
      console.error("Order error:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <main>
          <div className="container mx-auto px-4 py-8">
          {/* Back Button Skeleton */}
          <div className="mb-6">
            <Skeleton className="h-10 w-32" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Gallery Skeleton */}
            <div className="space-y-4">
              <Skeleton className="aspect-square rounded-lg" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-20 h-20 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Product Info Skeleton */}
            <div className="space-y-6">
              <div>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-4 rounded" />
                  ))}
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (isError || !product) {
    return (
      <div>
        <main>
          <div className="container mx-auto px-4 py-8">
            {/* Back Button */}
            <Button variant="ghost" asChild className="mb-6">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.backToHome")}
              </Link>
            </Button>

            <div className="max-w-2xl mx-auto">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error?.message || t("product.notFound")}
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 text-center">
                <Button asChild>
                  <Link to="/products">
                    {t("product.browseProducts")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ProductErrorBoundary resetKeys={[productName ?? ""]}>
      <div>
        <main>
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.backToHome")}
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <ProductImageGallery
              images={product.images}
              productName={product.productName}
              className="rounded-lg"
            />
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Product Header */}
            <div>
              <ProductCategoryTags
                categories={[product.family.familyName, product.brand.brandName]}
                className="mb-3"
                variant="secondary"
                size="sm"
              />
              <h1 className="text-3xl font-bold mb-2">{product.productName}</h1>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-lg text-muted-foreground">{product.brand.brandName}</span>
                <span className="text-sm text-muted-foreground">
                  {t("product.model")}: {product.model.modelName}
                </span>
              </div>
              
              {/* Rating 
              {product.rating && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                          i < Math.floor(product.rating!)
                          ? "text-yellow-400 fill-current"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                    {product.rating} ({product.reviewCount} {t("product.reviews")})
                </span>
              </div>
              )}*/}
            </div>

            {/* Description */}
            {product.productDescription && (
              <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("product.description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-mdleading-relaxed">
                  {product.productDescription}
                </p>
              </CardContent>
            </Card>
              
            )}

            {/* Features 
            {product.features && product.features.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("product.keyFeatures")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {product.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
                </CardContent>
              </Card>
            )}*/}

            {/* Specifications 
            {product.specifications && Object.keys(product.specifications).length > 0 && (
            <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("product.specifications")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm font-medium">{key}:</span>
                        <span className="text-sm text-muted-foreground">{value}</span>
                      </div>
                    ))}
                    </div>
                </CardContent>
              </Card>
            )} */}

            {/* Pricing Section */}
            <ProductPricingSection
              product={product}
              onOrderNow={handleOrderNow}
            />

            {/* Error Messages */}
            {orderError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{orderError}</AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearError}
                  className="mt-2"
                >
                  {t("common.dismiss")}
                </Button>
              </Alert>
            )}
                            </div>
                          </div>

        {/* Order Modal */}
        {product && (
          <ProductOrderModal
            isOpen={isOrderModalOpen}
            onClose={handleOrderModalClose}
            product={product}
            quantity={quantity}
            unitPrice={currentProductPrice}
            onConfirmOrder={handleOrderSubmit}
          />
        )}
          </div>
        </main>
      </div>
    </ProductErrorBoundary>
  );
}