import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { OrderStatsRow } from "@/pages/staff/orders/components/OrderStatsRow";
import { OrderStatusTabs } from "@/pages/staff/orders/components/OrderStatusTabs";
import { OrdersTable } from "@/pages/staff/orders/components/OrdersTable";
import { OrderShowDialog } from "@/pages/staff/orders/components/OrderShowDialog";
import { OrderConfirmDialog } from "@/pages/staff/orders/components/OrderConfirmDialog";
import { OrderStatusDialog } from "@/pages/staff/orders/components/OrderStatusDialog";
import { AdminCancelOrderDialog } from "@/pages/admin/orders/components/cancel-order-dialog";
import { ReturnOrderDialog } from "@/pages/admin/orders/components/return-order-dialog";
import {
  useOrdersList,
  useOrderStats,
  useConfirmOrder,
  useUpdateOrderStatus,
  useAdminCancelOrder,
  useReturnOrder,
} from "@/hooks/useOrdersDirectory";
import { useAdminCatalogProduct } from "@/hooks/useCatalogProducts";
import { useSendStaffSearch } from "@/hooks/useObservability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { apiErrorMessage } from "@/lib/query-client";
import { OrderStatus, type OrderDto, type BackofficeOrdersQuery } from "@dragon-telecom/contract";
import type { ConfirmOrderFormValues } from "@/pages/staff/orders/confirm-order.schema";
import type { OrderStatusFormValues } from "@/pages/staff/orders/order-status.schema";
import type { CancelOrderFormValues } from "@/pages/admin/orders/components/cancel-order.schema";
import type { ReturnOrderFormValues } from "@/pages/admin/orders/components/return-order.schema";

interface Props {
  scope?: "staff" | "admin";
}

// STF-04 `/staff/orders` = ADM-09 `/admin/orders` (scope-driven twin). set-03 Sprint 6 wiring —
// OrdersTable has no per-row action column, so OrderShowDialog (opened on row click) is the one
// place Confirm/Update status/Cancel/Return get launched from (mirrors SaleDetailDrawer's own
// action-footer, built the same sprint). Default tab is PENDING (STF-04 §UI); filters are plain
// local state, not URL-backed — unlike ADM-02's products list, there's no "share this filtered
// view" requirement documented for orders.
export default function StaffOrders({ scope = "staff" }: Props) {
  const { t } = useTranslation();

  const [status, setStatus] = useState<OrderStatus | undefined>(OrderStatus.PENDING);
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // ADM-02's precedent (Sprint 5) — admin searches are audited too (Sprint 8 #polish).
  const sendStaffSearch = useSendStaffSearch();
  useEffect(() => {
    if (debouncedSearch.trim()) sendStaffSearch.mutate({ query: debouncedSearch.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const query: BackofficeOrdersQuery = useMemo(
    () => ({ status, search: debouncedSearch || undefined, from, to, page, limit: 20 }),
    [status, debouncedSearch, from, to, page],
  );

  const {
    data: ordersResult,
    isLoading: ordersLoading,
    isError: ordersIsError,
    refetch: refetchOrders,
  } = useOrdersList(scope, query);
  const { data: stats, isLoading: statsLoading } = useOrderStats(scope);

  const changeStatus = useCallback((next?: OrderStatus) => {
    setStatus(next);
    setPage(1);
  }, []);
  const changeSearch = useCallback((next: string) => {
    setSearchInput(next);
    setPage(1);
  }, []);
  const changeFrom = useCallback((next: string) => {
    setFrom(next || undefined);
    setPage(1);
  }, []);
  const changeTo = useCallback((next: string) => {
    setTo(next || undefined);
    setPage(1);
  }, []);

  const [showOrder, setShowOrder] = useState<OrderDto | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<OrderDto | null>(null);
  const [statusOrder, setStatusOrder] = useState<OrderDto | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderDto | null>(null);
  const [returnOrderTarget, setReturnOrderTarget] = useState<OrderDto | null>(null);
  const [stockError, setStockError] = useState<string>();

  const confirmMutation = useConfirmOrder();
  const statusMutation = useUpdateOrderStatus();
  const cancelMutation = useAdminCancelOrder();
  const returnMutation = useReturnOrder();

  // Live availability re-check (STF-04 §UI) — admin scope only: staff has no single-product
  // numeric-quantity read (useStaffProducts is list-only, no by-id query); documented gap,
  // report-sprint-06.md.
  const { data: liveProduct } = useAdminCatalogProduct(
    scope === "admin" ? (showOrder?.productId ?? "") : "",
  );

  const openShow = useCallback((order: OrderDto) => {
    setStockError(undefined);
    setShowOrder(order);
  }, []);

  const handleConfirmSubmit = (values: ConfirmOrderFormValues) => {
    if (!confirmOrder) return;
    setStockError(undefined);
    confirmMutation.mutate(
      { scope, id: confirmOrder.id, command: values },
      {
        onSuccess: () => {
          setConfirmOrder(null);
          toast.success(t("staff.orders.confirmDialog.submit"));
        },
        onError: (err) => {
          if (apiErrorMessage(err) === "INSUFFICIENT_STOCK") {
            setStockError(t("staff.orders.confirmDialog.insufficientStock"));
          }
        },
      },
    );
  };

  const handleStatusSubmit = (values: OrderStatusFormValues) => {
    if (!statusOrder) return;
    statusMutation.mutate(
      { scope, id: statusOrder.id, command: values },
      { onSuccess: () => setStatusOrder(null) },
    );
  };

  const handleCancelSubmit = (values: CancelOrderFormValues) => {
    if (!cancelOrderTarget) return;
    cancelMutation.mutate(
      { id: cancelOrderTarget.id, command: values },
      { onSuccess: () => setCancelOrderTarget(null) },
    );
  };

  const handleReturnSubmit = (values: ReturnOrderFormValues) => {
    if (!returnOrderTarget) return;
    returnMutation.mutate(
      { id: returnOrderTarget.id, command: values },
      { onSuccess: () => setReturnOrderTarget(null) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "admin" ? t("admin.orders.pageTitle") : t("staff.orders.pageTitle")}
      />

      <OrderStatsRow stats={stats} isLoading={statsLoading} />

      <OrderStatusTabs
        status={status}
        onStatusChange={changeStatus}
        search={searchInput}
        onSearchChange={changeSearch}
        from={from}
        onFromChange={changeFrom}
        to={to}
        onToChange={changeTo}
      />

      <OrdersTable
        orders={ordersResult?.items}
        isLoading={ordersLoading}
        isError={ordersIsError}
        onRetry={() => refetchOrders()}
        onRowClick={openShow}
      />

      {ordersResult && ordersResult.meta.totalPages > 1 && (
        <SimplePagination
          page={ordersResult.meta.page}
          totalPages={ordersResult.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <OrderShowDialog
        open={!!showOrder}
        onOpenChange={(open) => !open && setShowOrder(null)}
        order={showOrder}
        liveAvailableQuantity={scope === "admin" ? liveProduct?.quantityOnHand : undefined}
        scope={scope}
        onConfirm={
          showOrder
            ? () => {
                setConfirmOrder(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
        onUpdateStatus={
          showOrder
            ? () => {
                setStatusOrder(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
        onCancel={
          scope === "admin" && showOrder
            ? () => {
                setCancelOrderTarget(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
        onReturn={
          scope === "admin" && showOrder
            ? () => {
                setReturnOrderTarget(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
      />

      <OrderConfirmDialog
        // `key` forces a fresh mount per order — OrderConfirmDialog's useForm captures
        // `order`-derived defaultValues once at mount, and this component never actually
        // unmounts on its own (it just renders null via `if (!order) return null` while
        // staying in the same tree position), so without a key the fields would stay blank/
        // stale for the entire session after the very first open (real bug, found writing
        // this sprint's tests — same fix applied to every dialog below with this shape).
        key={confirmOrder?.id ?? "none"}
        open={!!confirmOrder}
        onOpenChange={(open) => !open && setConfirmOrder(null)}
        order={confirmOrder}
        onSubmit={handleConfirmSubmit}
        isSubmitting={confirmMutation.isPending}
        stockError={stockError}
      />

      <OrderStatusDialog
        open={!!statusOrder}
        onOpenChange={(open) => !open && setStatusOrder(null)}
        order={statusOrder}
        onSubmit={handleStatusSubmit}
        isSubmitting={statusMutation.isPending}
      />

      {scope === "admin" && (
        <>
          <AdminCancelOrderDialog
            open={!!cancelOrderTarget}
            onOpenChange={(open) => !open && setCancelOrderTarget(null)}
            order={cancelOrderTarget}
            onSubmit={handleCancelSubmit}
            isSubmitting={cancelMutation.isPending}
          />
          <ReturnOrderDialog
            key={returnOrderTarget?.id ?? "none"}
            open={!!returnOrderTarget}
            onOpenChange={(open) => !open && setReturnOrderTarget(null)}
            order={returnOrderTarget}
            onSubmit={handleReturnSubmit}
            isSubmitting={returnMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
