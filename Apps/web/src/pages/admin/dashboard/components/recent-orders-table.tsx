/**
 * Recent Orders Table Component
 * Displays the last 8 submitted orders in a read-only table
 */

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { RecentOrder } from "@/types/draft-types/dashboard.types";
import { OrderStatusCode, OrderTypeCode } from "@/types/draft-types/enums.types";
import { useTranslation } from "@/hooks/useTranslation";

interface RecentOrdersTableProps {
  /** Recent orders data */
  orders?: RecentOrder[];
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Retry function for error handling */
  onRetry?: () => void;
  /** Refresh function */
  onRefresh?: () => void;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Maximum number of orders to display */
  limit?: number;
}

/**
 * Get status badge variant and color
 */
function getStatusBadgeVariant(status: OrderStatusCode) {
  switch (status) {
    case OrderStatusCode.pending:
      return "secondary" as const;
    case OrderStatusCode.confirmed:
      return "default" as const;
    case OrderStatusCode.delivery:
      return "outline" as const;
    case OrderStatusCode.completed:
      return "default" as const;
    case OrderStatusCode.canceled:
      return "destructive" as const;
    case OrderStatusCode.whishlist:
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

/**
 * Get status badge color class
 */
function getStatusBadgeColor(status: OrderStatusCode) {
  switch (status) {
    case OrderStatusCode.pending:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case OrderStatusCode.confirmed:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case OrderStatusCode.delivery:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case OrderStatusCode.completed:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case OrderStatusCode.canceled:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case OrderStatusCode.whishlist:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Get order type badge color class
 */
function getOrderTypeBadgeColor(orderType: OrderTypeCode) {
  switch (orderType) {
    case OrderTypeCode["pick-up"]:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case OrderTypeCode["delivry-home"]:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case OrderTypeCode["delivry-office"]:
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Error state component
 */
function OrdersErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main Recent Orders Table Component
 */
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

  const columns = useMemo<ColumnDef<RecentOrder>[]>(() => [
    {
      accessorKey: 'orderCode',
      header: t('admin.dashboard.orderCode'),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.orderCode}</span>,
    },
    {
      accessorKey: 'orderLines',
      header: t('admin.dashboard.orderLines'),
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <p className="text-sm truncate" title={row.original.orderLines}>{row.original.orderLines}</p>
        </div>
      ),
    },
    {
      accessorKey: 'clientName',
      header: t('admin.dashboard.clientName'),
      cell: ({ row }) => <span className="text-sm">{row.original.clientName}</span>,
    },
    {
      accessorKey: 'orderType',
      header: t('admin.dashboard.orderType'),
      cell: ({ row }) => (
        <Badge variant="outline" className={getOrderTypeBadgeColor(row.original.orderType)}>
          {row.original.orderTypeLabel}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalPrice',
      header: t('admin.dashboard.totalPrice'),
      cell: ({ row }) => <span className="font-medium text-sm">{formatCurrency(row.original.totalPrice)}</span>,
    },
    {
      accessorKey: 'orderDate',
      header: t('admin.dashboard.orderDate'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.orderDate}</span>,
    },
    {
      accessorKey: 'orderStatus',
      header: t('admin.dashboard.status'),
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.orderStatus)} className={getStatusBadgeColor(row.original.orderStatus)}>
          {row.original.statusLabel}
        </Badge>
      ),
    },
  ], [t]);

  const renderMobileRow = (order: RecentOrder) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{order.orderCode}</span>
        <Badge variant={getStatusBadgeVariant(order.orderStatus)} className={getStatusBadgeColor(order.orderStatus)}>
          {order.statusLabel}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground truncate" title={order.orderLines}>{order.orderLines}</p>
      <div className="flex items-center justify-between text-sm">
        <span>{order.clientName}</span>
        <span className="font-medium">{formatCurrency(order.totalPrice)}</span>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={getOrderTypeBadgeColor(order.orderType)}>
          {order.orderTypeLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">{order.orderDate}</span>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{t('admin.dashboard.recentOrders')}</CardTitle>
        <CardDescription>{t('admin.dashboard.lastOrders')}</CardDescription>
      </div>
      {showRefresh && onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('common.refresh')}</span>
        </Button>
      )}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={7} />
        </CardContent>
      </Card>
    );
  }

  // Error state
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

  // Limit orders to specified number
  const displayOrders = (orders ?? []).slice(0, limit);

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={displayOrders}
          getRowKey={(order) => String(order.idOrder)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title={t('orders.noOrders')}
              body={t('orders.noOrdersDescription')}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
