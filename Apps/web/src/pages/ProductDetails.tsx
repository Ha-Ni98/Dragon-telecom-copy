import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProduct } from "@/hooks/useCatalogProducts";
import { useWilayas, usePlatformDeliveryFee } from "@/hooks/usePlatform";
import { usePlaceOrder } from "@/hooks/useOrdersPortal";
import { useClientMe } from "@/hooks/useClientPortal";
import { useSession } from "@/hooks/useSession";
import { useSendClientActivity } from "@/hooks/useObservability";
import { ProductImageGallery } from "@/components/sections/product-details/ProductImageGallery";
import { ProductCategoryTags } from "@/components/shared/ProductCategoryTags";
import { ProductPricingSection } from "@/components/sections/product-details/ProductPricingSection";
import { ProductOrderModal } from "@/components/shared/ProductOrderModal";
import { ProductErrorBoundary } from "@/components/shared/ProductErrorBoundary";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { RelatedProductsStrip } from "@/pages/product-detail/components/RelatedProductsStrip";
import { toast } from "sonner";
import { ClientActivityType, UserType, OrderType, type PlaceOrderCommand } from "@dragon-telecom/contract";
import type { OrderFormValues } from "@/pages/product-detail/order.schema";

interface DeliveryParams {
  wilayaId: string;
  communeId: string;
  orderType: OrderType;
}

export default function ProductDetails() {
  // PUB-03: routes "by id — never by name" (D1).
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [deliveryParams, setDeliveryParams] = useState<DeliveryParams | null>(null);

  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useCatalogProduct(id ?? "");
  const { data: wilayas } = useWilayas();
  const { data: fee, isLoading: isFeeLoading } = usePlatformDeliveryFee({
    wilayaId: deliveryParams?.wilayaId ?? "",
    communeId: deliveryParams?.communeId,
  });
  // Prefill (PUB-03: "prefilled from the profile, editable") — client viewers only; calling
  // this unconditionally for a guest would fire a doomed 401 straight into the axios
  // interceptor's redirect-to-login.
  const { data: clientMe } = useClientMe({ enabled: isClient });
  const placeOrderMutation = usePlaceOrder();
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
        sendActivity.mutate({ type: ClientActivityType.PRODUCT_VIEW, productId: id, durationSeconds });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle order now (ProductPricingSection's stepper hands off the chosen quantity)
  const handleOrderNow = (newQuantity: number) => {
    setQuantity(newQuantity);
    setDeliveryParams(null);
    setIsOrderModalOpen(true);
  };

  const handleOrderModalClose = () => {
    setIsOrderModalOpen(false);
  };

  // Real submission (D6: placeOrder already carries an Idempotency-Key, orders.service.ts).
  // Errors (incl. 409 INSUFFICIENT_STOCK / 403 GUEST_PRICE_HIDDEN) are interpreted by the
  // modal's own submit handler (Sprint 3) — this just needs to let them propagate.
  const handleOrderSubmit = async (data: OrderFormValues) => {
    const command: PlaceOrderCommand = {
      ...data,
      clientId: isClient ? (session?.clientId ?? null) : null,
    };
    await placeOrderMutation.mutateAsync(command);
    toast.success(t("product.orderSuccess"));
    setIsOrderModalOpen(false);
    navigate("/orders");
  };

  const prefill = clientMe
    ? {
        fullName: `${clientMe.firstName} ${clientMe.lastName}`,
        phone: clientMe.phone,
        wilayaId: clientMe.wilayaId,
        communeId: clientMe.communeId,
      }
    : undefined;

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
                  <Link to="/products">
                    {t("product.browseProducts")}
                  </Link>
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
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4 mb-2">
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
            <ProductPricingSection
              product={product}
              onOrderNow={handleOrderNow}
            />
                            </div>
                          </div>

        {/* Related Products */}
        <div className="mt-12">
          <RelatedProductsStrip relatedIds={product.relatedIds} />
        </div>

        {/* Order Modal */}
        <ProductOrderModal
          isOpen={isOrderModalOpen}
          onClose={handleOrderModalClose}
          product={product}
          quantity={quantity}
          wilayas={wilayas ?? []}
          fee={fee}
          isFeeLoading={isFeeLoading}
          onDeliveryParamsChange={setDeliveryParams}
          prefill={prefill}
          onSubmit={handleOrderSubmit}
          isSubmitting={placeOrderMutation.isPending}
        />
          </div>
        </main>
      </div>
    </ProductErrorBoundary>
  );
}
