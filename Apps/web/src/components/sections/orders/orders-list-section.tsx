import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Filter, ShoppingBag, Calendar, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useOrders } from "@/hooks/use-orders";
import { OrderStatusCode } from "@/types/draft-types/enums.types";
import type { OrderWithDetails } from "@/types/draft-types/order.types";
import { formatDZD } from "@/lib/utils";

// set-02 Sprint 3: OrderCard/CancelOrderDialog (components/shared) were retyped to the real
// contract OrderDto (uuid id, single product, 7-value OrderStatus) — incompatible with this
// stub's OrderWithDetails (numeric idOrder, orderLines[], 5-value OrderStatusCode). This whole
// section is retired in Sprint 5 when Orders.tsx rewires onto useMyOrders/useCancelMyOrder, so
// rather than bridge the two shapes it gets its own compact, self-contained card for its
// remaining lifetime — no separate confirm dialog (this is throwaway scaffolding, not the real
// PUB-09 cancel flow Sprint 5 builds).
function LegacyOrderCard({
  order,
  onCancel,
}: {
  order: OrderWithDetails;
  onCancel: (orderId: number) => void;
}) {
  const { t } = useTranslation();
  const totalItems = order.orderLines.reduce((total, line) => total + line.orderQuantity, 0);

  return (
    <Card className="border-0 shadow-card">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">{order.orderCode}</h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {order.formattedDate}
              </span>
              <span>
                {totalItems} {t("orders.items")}
              </span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="font-semibold text-primary">{formatDZD(order.orderGrandTotal)}</div>
            <Badge variant="outline">
              <CreditCard className="h-3 w-3 mr-1" />
              {order.statusLabel}
            </Badge>
          </div>
        </div>
        {order.canBeCancelled && (
          <div className="flex justify-end border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(order.idOrder)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              {t("orders.cancelOrder")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface OrdersListSectionProps {
  className?: string;
  onOrderCancelled?: (orderId: number) => void;
}

export const OrdersListSection: React.FC<OrdersListSectionProps> = ({
  className = "",
  onOrderCancelled,
}) => {
  const { t } = useTranslation();
  const {
    orders,
    loading,
    error,
    selectedStatus,
    filterOrdersByStatus,
    getOrdersStatistics,
    cancelOrder,
  } = useOrders();
  const navigate = useNavigate();

  const statistics = getOrdersStatistics();

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    if (status === "all") {
      filterOrdersByStatus("all" as OrderStatusCode | "all");
    } else {
      filterOrdersByStatus(Number(status) as OrderStatusCode);
    }
  };

  // Handle order cancellation — calls the stub mutation directly now that LegacyOrderCard
  // doesn't own it (Sprint 5 replaces this whole flow with the real useCancelMyOrder()).
  const handleCancel = async (orderId: number) => {
    const success = await cancelOrder(orderId);
    if (success) {
      onOrderCancelled?.(orderId);
    }
  };

  // Get status filter options
  const getStatusFilterOptions = () => {
    return [
      { value: "all", label: t("orders.allOrders") },
      { value: OrderStatusCode.pending.toString(), label: t("orders.pending") },
      { value: OrderStatusCode.confirmed.toString(), label: t("orders.confirmed") },
      { value: OrderStatusCode.delivery.toString(), label: t("orders.delivery") },
      { value: OrderStatusCode.completed.toString(), label: t("orders.completed") },
      { value: OrderStatusCode.canceled.toString(), label: t("orders.cancelled") },
    ];
  };

  // Loading state
  if (loading) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("orders.title")}
          </CardTitle>
          <CardDescription>{t("orders.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("orders.title")}
          </CardTitle>
          <CardDescription>{t("orders.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-red-600 mb-2">{t("orders.errorLoading")}</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>{t("common.actions.tryAgain")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <Card className={`orders-list-section ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t("orders.title")}
          </CardTitle>
          <CardDescription>{t("orders.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full flex items-center justify-center">
              <Package className="h-12 w-12 text-primary/60" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              {t("orders.noOrders")}
            </h3>
            <p className="text-muted-foreground mb-6">{t("orders.noOrdersDescription")}</p>
            <Button onClick={() => navigate("/products")}>
              <ShoppingBag className="h-4 w-4 mr-2" />
              {t("orders.startShopping")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`orders-list-section ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("orders.title")}
            </CardTitle>
            <CardDescription>{t("orders.description")}</CardDescription>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedStatus === "all" ? "all" : selectedStatus.toString()}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("orders.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                {getStatusFilterOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{statistics.totalOrders}</div>
            <div className="text-sm text-muted-foreground">{t("orders.totalOrders")}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{statistics.pendingOrders}</div>
            <div className="text-sm text-muted-foreground">{t("orders.pending")}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{statistics.confirmedOrders}</div>
            <div className="text-sm text-muted-foreground">{t("orders.confirmed")}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.completedOrders}</div>
            <div className="text-sm text-muted-foreground">{t("orders.completed")}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => (
            <LegacyOrderCard key={order.idOrder} order={order} onCancel={handleCancel} />
          ))}
        </div>

        {/* Load More Button (for future pagination) */}
        {orders.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" disabled>
              Load More Orders
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
