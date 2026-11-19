import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { OrderCard } from "@/components/shared/OrderCard";
import { OrderCardSkeleton } from "@/pages/my-orders/components/OrderCardSkeleton";
import {
  OrderStatusFilters,
  type OrderFilterValue,
} from "@/pages/my-orders/components/OrderStatusFilters";
import { useMyOrders, useCancelMyOrder } from "@/hooks/useOrdersPortal";
import { useTranslation } from "@/hooks/useTranslation";
import { OrderStatus } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";

// PUB-09 — rewired off the Sub-01 stub (OrdersListSection/use-orders.ts, numeric ids). Status
// filter is URL-bound (?status=); counts come from a *separate* unfiltered useMyOrders({})
// query — distinct query keys (qk.orders.mine({}) vs qk.orders.mine({status})) so the chips
// always reflect every status, not just the active filter (plan.md D6, sprints.md Sprint 5 risk).
// OrderCard owns its own confirm dialog (Sprint 3) — its `onCancel` prop only fires once the
// user has already confirmed inside that dialog, so this page needs no cancel-target state of
// its own, just the mutation to trigger.
function isOrderStatus(value: string | null): value is OrderStatus {
  return !!value && (Object.values(OrderStatus) as string[]).includes(value);
}

export default function OrdersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get("status");
  const activeFilter: OrderFilterValue = isOrderStatus(statusParam) ? statusParam : "all";

  const {
    data: filteredOrders,
    isLoading,
    isError,
    refetch,
  } = useMyOrders(activeFilter === "all" ? {} : { status: activeFilter });
  const { data: allOrders } = useMyOrders({});
  const cancelMutation = useCancelMyOrder();

  const counts = useMemo(() => {
    const result: Partial<Record<OrderFilterValue, number>> = { all: allOrders?.length ?? 0 };
    for (const status of Object.values(OrderStatus)) {
      result[status] = allOrders?.filter((o) => o.status === status).length ?? 0;
    }
    return result;
  }, [allOrders]);

  const handleFilterChange = useCallback(
    (value: OrderFilterValue) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === "all") next.delete("status");
          else next.set("status", value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <SectionTitle as="h1" className="text-2xl font-bold">
          {t("orders.title")}
        </SectionTitle>
        <p className="text-muted-foreground">{t("orders.description")}</p>
      </div>

      <OrderStatusFilters value={activeFilter} onChange={handleFilterChange} counts={counts} />

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <NotFoundState
          title={t("orders.errorLoading")}
          body={t("orders.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      ) : !filteredOrders || filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={t("orders.noOrders")}
          body={
            activeFilter === "all" ? t("orders.noOrdersDescription") : t("orders.emptyFiltered")
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={() => cancelMutation.mutate(order.id)}
              isCancelling={cancelMutation.isPending && cancelMutation.variables === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
