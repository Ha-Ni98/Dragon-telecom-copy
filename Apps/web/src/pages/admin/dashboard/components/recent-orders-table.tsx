/**
 * Recent Orders Table Component
 * Displays the last 8 submitted orders in a read-only table
 */

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

// set-02 Sprint 3 retype — was RecentOrder (draft view-model: orderCode, orderLines as a joined
// string, clientName, orderType+orderTypeLabel, totalPrice, orderDate, orderStatus+statusLabel).
// AdminDashboardDto['recentOrders'] (DashboardOrderSummarySchema) is genuinely thinner —
// {id, reference, totalAmount, placedAt} only, no client/type/status fields — so the table
// drops to 3 columns. The old status/type badge-color helpers have nothing left to key off and
// are dropped with it; formatCurrency's USD bug (see dashboard-stats-cards.tsx) is fixed to the
// shared formatDZD.
type RecentOrder = AdminDashboardDto["recentOrders"][number];

interface RecentOrdersTableProps {
  orders?: RecentOrder[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  limit?: number;
}

function OrdersErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function RecentOrdersTable({
  orders,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  limit = 8,
}: RecentOrdersTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<RecentOrder>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("admin.dashboard.orderCode"),
        cell: ({ row }) => <span className="text-sm font-medium">{row.original.reference}</span>,
      },
      {
        accessorKey: "totalAmount",
        header: t("admin.dashboard.totalPrice"),
        cell: ({ row }) => (
          <span className="font-medium text-sm">{formatDZD(row.original.totalAmount)}</span>
        ),
      },
      {
        accessorKey: "placedAt",
        header: t("admin.dashboard.orderDate"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.placedAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const renderMobileRow = (order: RecentOrder) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{order.reference}</span>
        <span className="font-medium text-sm">{formatDZD(order.totalAmount)}</span>
      </div>
      <span className="text-xs text-muted-foreground">{formatDateTime(order.placedAt)}</span>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{t("admin.dashboard.recentOrders")}</CardTitle>
        <CardDescription>{t("admin.dashboard.lastOrders")}</CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t("common.refresh")}</span>
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={3} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <OrdersErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  const displayOrders = (orders ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={displayOrders}
          getRowKey={(order) => order.id}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title={t("orders.noOrders")}
              body={t("orders.noOrdersDescription")}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
