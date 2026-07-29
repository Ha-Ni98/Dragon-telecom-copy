import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { OrderPlacementSection } from "@/components/shared/OrderPlacementSection";
import { CartItemRow, CartItemRowSkeleton } from "@/pages/cart/components/CartItemRow";
import { useClientCart, useRemoveFromCart } from "@/hooks/useClientPortal";
import { useTranslation } from "@/hooks/useTranslation";
import type { CartItemDto } from "@dragon-telecom/contract";

// PUB-04 — favorites list with a single multi-line checkout (S16/D1: one order, N lines, one
// delivery fee, one reservation per line — reuses S15's OrderPlacementSection, the same
// component the product page uses). Route is CLIENT-scoped (App.tsx), so no guest branch is
// needed here the way ProductDetails.tsx has one.
export default function Cart() {
  const { t } = useTranslation();

  const { data: items, isLoading, isError, refetch } = useClientCart();
  const removeMutation = useRemoveFromCart();

  // Checkout state is local and unpersisted (S16/R1): ClientCart has no quantity column, and a
  // favorites row is not a commitment to order that many. Keyed by productId; a row absent from
  // the map is "included, quantity 1".
  const [selection, setSelection] = useState<
    Record<string, { included: boolean; quantity: number }>
  >({});

  const blockedReasonFor = (item: CartItemDto): string | undefined => {
    const price = item.product.currentPrice ?? item.product.guestPrice;
    if (item.product.priceHidden || price === undefined) return t("cart.blockedNoPrice");
    if (!item.product.inStock) return t("cart.blockedOutOfStock");
    return undefined;
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

  const rows = items.map((item) => {
    const blockedReason = blockedReasonFor(item);
    const state = selection[item.productId] ?? { included: true, quantity: 1 };
    return {
      item,
      blockedReason,
      included: !blockedReason && state.included,
      quantity: state.quantity,
    };
  });

  const orderLines = rows
    .filter((row) => row.included)
    .map((row) => ({ product: row.item.product, quantity: row.quantity }));

  const excludedCount = rows.filter((row) => row.blockedReason).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("cart.pageTitle")}</h1>
        <p className="text-muted-foreground">{t("cart.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {rows.map(({ item, blockedReason, included, quantity }) => (
          <CartItemRow
            key={item.productId}
            item={item}
            blockedReason={blockedReason}
            included={included}
            onIncludedChange={(next) =>
              setSelection((prev) => ({ ...prev, [item.productId]: { included: next, quantity } }))
            }
            quantity={quantity}
            onQuantityChange={(next) =>
              setSelection((prev) => ({ ...prev, [item.productId]: { included, quantity: next } }))
            }
            onRemove={() => removeMutation.mutate(item.productId)}
            isRemoving={removeMutation.isPending && removeMutation.variables === item.productId}
          />
        ))}
      </div>

      {excludedCount > 0 && (
        <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {t("cart.excludedNotice")}
        </p>
      )}

      {/* D1 — one order, N lines, one delivery fee, one reservation per line. The section is
          the same component the product page uses; only the lines array differs. Not cleared on
          success (R4) — the cart is a favorites list, not a one-shot order builder. */}
      <OrderPlacementSection
        lines={orderLines}
        disabled={orderLines.length === 0}
        submitLabel={t("cart.orderAll")}
      />

      {orderLines.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("cart.nothingSelected")}</p>
      )}
    </div>
  );
}
