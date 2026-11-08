import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { OrderStatsRow } from "@/pages/staff/orders/components/OrderStatsRow";
import { OrderStatusTabs } from "@/pages/staff/orders/components/OrderStatusTabs";
import { OrdersTable } from "@/pages/staff/orders/components/OrdersTable";
import { OrderShowDialog } from "@/pages/staff/orders/components/OrderShowDialog";
import { OrderStatusDialog } from "@/pages/staff/orders/components/OrderStatusDialog";
import { AdminCancelOrderDialog } from "@/pages/admin/orders/components/cancel-order-dialog";
import { ReturnOrderDialog } from "@/pages/admin/orders/components/return-order-dialog";
import {
  useOrdersList,
  useOrderStats,
  useUpdateOrderStatus,
  useCancelBackofficeOrder,
  useReturnOrder,
} from "@/hooks/useOrdersDirectory";
import { useAdminCatalogProduct } from "@/hooks/useCatalogProducts";
import { useSendStaffSearch } from "@/hooks/useObservability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { apiErrorMessage } from "@/lib/query-client";
import { ORDER_SEARCH_DEEP_LINK_PARAM } from "@/lib/deep-links";
import { OrderStatus, type OrderDto, type BackofficeOrdersQuery } from "@dragon-telecom/contract";
import type { OrderStatusFormValues } from "@/pages/staff/orders/order-status.schema";
import type { CancelOrderFormValues } from "@/pages/admin/orders/components/cancel-order.schema";
import type { ReturnOrderFormValues } from "@/pages/admin/orders/components/return-order.schema";

interface Props {
  scope?: "staff" | "admin";
}

// STF-04 `/staff/orders` = ADM-09 `/admin/orders` (scope-driven twin). set-03 Sprint 6 wiring —
// OrderShowDialog (opened on row click) is one of two places Update status/Cancel/Return can be
// launched from, the other being OrdersTable's per-row action menu (S11). S10/R3 — confirm is
// folded into "Update status": there is no separate confirm dialog/mutation any more. Default
// tab is PENDING (STF-04 §UI); filters are plain local state, not URL-backed — unlike ADM-02's
// products list, there's no "share this filtered view" requirement documented for orders.
// S18/D-1 — cancel/return used to be admin-only; staff holding the orders page gets the same
// action menu, show-dialog buttons and dialogs now, gated only on `handleRowAction`/
// `onCancel`/`onReturn` being wired (which they always are), not on `scope`.
export default function StaffOrders({ scope = "staff" }: Props) {
  const { t } = useTranslation();

  // S36 — ?search=<reference> (lib/deep-links.ts) opens the list on All, searched to that order.
  const [searchParams] = useSearchParams();
  const linkedSearch = searchParams.get(ORDER_SEARCH_DEEP_LINK_PARAM) ?? "";
  const [status, setStatus] = useState<OrderStatus | undefined>(
    linkedSearch ? undefined : OrderStatus.PENDING,
  );
  const [searchInput, setSearchInput] = useState(linkedSearch);
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
  const [statusOrder, setStatusOrder] = useState<OrderDto | null>(null);
  const [presetStatus, setPresetStatus] = useState<OrderStatus | undefined>();
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderDto | null>(null);
  const [returnOrderTarget, setReturnOrderTarget] = useState<OrderDto | null>(null);

  const statusMutation = useUpdateOrderStatus();
  const cancelMutation = useCancelBackofficeOrder();
  const returnMutation = useReturnOrder();

  // Live availability re-check (STF-04 §UI) — admin scope only: staff has no single-product
  // numeric-quantity read (useStaffProducts is list-only, no by-id query); documented gap,
  // report-sprint-06.md. D1 (S9) — orders are multi-line; this still checks only the first
  // line's product (S11 revisits this now that an order can carry more than one product).
  const { data: liveProduct } = useAdminCatalogProduct(
    scope === "admin" ? (showOrder?.lines[0]?.productId ?? "") : "",
  );

  const openShow = useCallback((order: OrderDto) => {
    setShowOrder(order);
  }, []);

  // S11/R2 — the action column never applies a transition directly; each target opens the dialog
  // that owns it. CANCELLED goes to the admin cancel dialog (it needs a reason and hits the
  // dedicated cancel endpoint); RETURNED on a COMPLETED order is the return *document*
  // (S10/R1 — FIFO restock + refund), while RETURNED from IN_DELIVERY is a plain machine
  // transition that only releases the reservation, so it goes through the status dialog.
  const handleRowAction = useCallback((order: OrderDto, target: OrderStatus) => {
    if (target === OrderStatus.CANCELLED) {
      setCancelOrderTarget(order);
    } else if (target === OrderStatus.RETURNED && order.status === OrderStatus.COMPLETED) {
      setReturnOrderTarget(order);
    } else {
      setPresetStatus(target);
      setStatusOrder(order);
    }
  }, []);

  const handleStatusSubmit = (values: OrderStatusFormValues) => {
    if (!statusOrder) return;
    statusMutation.mutate(
      { scope, id: statusOrder.id, command: values },
      {
        onSuccess: () => {
          setStatusOrder(null);
          setPresetStatus(undefined);
        },
        onError: (err) => {
          const code = apiErrorMessage(err);
          if (code === "CREDIT_REQUIRES_CLIENT") {
            toast.error(t("staff.orders.statusDialog.creditRequiresClient"));
          } else if (code === "INSUFFICIENT_STOCK") {
            toast.error(t("staff.orders.confirmDialog.insufficientStock"));
          }
        },
      },
    );
  };

  const handleCancelSubmit = (values: CancelOrderFormValues) => {
    if (!cancelOrderTarget) return;
    cancelMutation.mutate(
      { scope, id: cancelOrderTarget.id, command: values },
      { onSuccess: () => setCancelOrderTarget(null) },
    );
  };

  const handleReturnSubmit = (values: ReturnOrderFormValues) => {
    if (!returnOrderTarget) return;
    returnMutation.mutate(
      { scope, id: returnOrderTarget.id, command: values },
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
        onAction={handleRowAction}
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
        onUpdateStatus={
          showOrder
            ? () => {
                setPresetStatus(undefined);
                setStatusOrder(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
        onCancel={
          showOrder
            ? () => {
                setCancelOrderTarget(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
        onReturn={
          showOrder
            ? () => {
                setReturnOrderTarget(showOrder);
                setShowOrder(null);
              }
            : undefined
        }
      />

      <OrderStatusDialog
        // `key` forces a fresh mount per order — OrderStatusDialog's useForm captures
        // `order`-derived defaultValues once at mount, and this component never actually
        // unmounts on its own (it just renders null via `if (!order) return null` while
        // staying in the same tree position), so without a key the fields would stay blank/
        // stale for the entire session after the very first open (real bug, found writing
        // this sprint's tests — same fix applied to every dialog below with this shape).
        // S11 — the key also folds in `presetStatus` so a second action-column click on the same
        // order (a different target) still recomputes defaultValues instead of reusing the first.
        key={statusOrder ? `${statusOrder.id}-${presetStatus ?? "any"}` : "none"}
        open={!!statusOrder}
        onOpenChange={(open) => {
          if (!open) {
            setStatusOrder(null);
            setPresetStatus(undefined);
          }
        }}
        order={statusOrder}
        onSubmit={handleStatusSubmit}
        isSubmitting={statusMutation.isPending}
        presetStatus={presetStatus}
      />

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
    </div>
  );
}
