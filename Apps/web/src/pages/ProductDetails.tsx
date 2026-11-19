import React, { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProduct } from "@/hooks/useCatalogProducts";
import { useSession } from "@/hooks/useSession";
import { useSendClientActivity } from "@/hooks/useObservability";
import { ProductImageGallery } from "@/components/sections/product-details/ProductImageGallery";
import { ProductCategoryTags } from "@/components/shared/ProductCategoryTags";
import { ProductPricingSection } from "@/components/sections/product-details/ProductPricingSection";
import { ProductErrorBoundary } from "@/components/shared/ProductErrorBoundary";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { RelatedProductsStrip } from "@/pages/product-detail/components/RelatedProductsStrip";
import { ClientActivityType, UserType } from "@dragon-telecom/contract";

export default function ProductDetails() {
  // PUB-03: routes "by id — never by name" (D1).
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;

  const { data: product, isLoading, isError, error } = useCatalogProduct(id ?? "");
  const sendActivity = useSendClientActivity();

  // Beacon: product-view duration, signed-in clients only. Resets on every id change (not just
  // true unmount) so navigating between two product pages via the related strip still reports
  // each product's own view time correctly.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    mountedAt.current = Date.now();
    return () => {
      if (isClient && id) {
        const durationSeconds = Math.round((Date.now() - mountedAt.current) / 1000);
        sendActivity.mutate({
          type: ClientActivityType.PRODUCT_VIEW,
          productId: id,
          durationSeconds,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  // Error state — local NotFoundState (never a global redirect) for an unknown/disabled id or a
  // failed fetch, so the public shell stays mounted around it.
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

            <NotFoundState
              icon={<AlertCircle className="h-6 w-6" />}
              title={t("product.notFound")}
              body={error?.message || t("product.notFoundMessage")}
              action={
                <Button asChild>
                  <Link to="/products">{t("product.browseProducts")}</Link>
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <ProductErrorBoundary resetKeys={[id ?? ""]}>
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
                  productName={product.name}
                  className="rounded-lg"
                />
              </div>

              {/* Product Info */}
              <div className="space-y-6">
                {/* Product Header */}
                <div>
                  <ProductCategoryTags
                    categories={[product.family.name, product.brand.name]}
                    className="mb-3"
                    variant="secondary"
                    size="sm"
                  />
                  <h1 className="text-3xl font-bold mb-2 break-words [overflow-wrap:anywhere]">
                    {product.name}
                  </h1>
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-lg text-muted-foreground">{product.brand.name}</span>
                    {product.model && (
                      <span className="text-sm text-muted-foreground">
                        {t("product.model")}: {product.model.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {product.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t("product.description")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-mdleading-relaxed">
                        {product.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Pricing Section */}
                <ProductPricingSection product={product} />
              </div>
            </div>

            {/* Related Products */}
            <div className="mt-12">
              <RelatedProductsStrip relatedIds={product.relatedIds} />
            </div>
          </div>
        </main>
      </div>
    </ProductErrorBoundary>
  );
}
