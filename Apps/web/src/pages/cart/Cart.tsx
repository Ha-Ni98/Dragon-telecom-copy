import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { ProductOrderModal } from "@/components/shared/ProductOrderModal";
import { CartItemRow, CartItemRowSkeleton } from "@/pages/cart/components/CartItemRow";
import { useClientCart, useRemoveFromCart } from "@/hooks/useClientPortal";
import { useWilayas, usePlatformDeliveryFee } from "@/hooks/usePlatform";
import { usePlaceOrder } from "@/hooks/useOrdersPortal";
import { useTranslation } from "@/hooks/useTranslation";
import type { CartItemDto, OrderType } from "@dragon-telecom/contract";
import { toPlaceOrderCommand, type OrderFormValues } from "@/pages/product-detail/order.schema";

interface DeliveryParams {
  wilayaId: string;
  communeId: string;
  orderType: OrderType;
}

// PUB-04 — favorites list with a per-row single-product order (reuses PUB-03's ProductOrderModal
// + order.schema.ts wholesale, plan.md D8/D13). Route is CLIENT-scoped (App.tsx), so no guest
// branch is needed here the way ProductDetails.tsx has one.
export default function Cart() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: items, isLoading, isError, refetch } = useClientCart();
  const removeMutation = useRemoveFromCart();
  const placeOrderMutation = usePlaceOrder();
  const { data: wilayas } = useWilayas();

  const [selectedItem, setSelectedItem] = useState<CartItemDto | null>(null);
  const [deliveryParams, setDeliveryParams] = useState<DeliveryParams | null>(null);

  const { data: fee, isLoading: isFeeLoading } = usePlatformDeliveryFee({
    wilayaId: deliveryParams?.wilayaId ?? "",
    communeId: deliveryParams?.communeId,
  });

  const handleOrder = (item: CartItemDto) => {
    setDeliveryParams(null);
    setSelectedItem(item);
  };

  const handleOrderSubmit = async (data: OrderFormValues) => {
    const command = toPlaceOrderCommand(data, null);
    const order = await placeOrderMutation.mutateAsync(command);
    setSelectedItem(null);
    navigate("/order-confirmation", { state: { order } });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {[0, 1, 2].map((i) => (
          <CartItemRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <NotFoundState
          title={t("cart.errorLoading")}
          body={t("cart.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title={t("cart.empty")}
          body={t("cart.emptyBody")}
          decoration={
            <Button asChild className="mt-3">
              <Link to="/products">{t("orders.startShopping")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("cart.pageTitle")}</h1>
        <p className="text-muted-foreground">{t("cart.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <CartItemRow
            key={item.productId}
            item={item}
            onOrder={() => handleOrder(item)}
            onRemove={() => removeMutation.mutate(item.productId)}
            isRemoving={removeMutation.isPending && removeMutation.variables === item.productId}
          />
        ))}
      </div>

      {selectedItem && (
        <ProductOrderModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          product={selectedItem.product}
          quantity={1}
          wilayas={wilayas ?? []}
          fee={fee}
          isFeeLoading={isFeeLoading}
          onDeliveryParamsChange={setDeliveryParams}
          onSubmit={handleOrderSubmit}
          isSubmitting={placeOrderMutation.isPending}
        />
      )}
    </div>
  );
}
