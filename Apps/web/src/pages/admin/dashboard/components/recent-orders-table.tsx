/**
 * Recent Orders Table Component
 * Displays the last 8 submitted orders in a read-only table
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * Loading skeleton for table rows
 */
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
    </TableRow>
  );
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
 * Empty state component
 */
function OrdersEmptyState() {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-8">
      <div className="text-muted-foreground">
        <p className="text-lg font-medium">{t('orders.noOrders')}</p>
        <p className="text-sm">{t('orders.noOrdersDescription')}</p>
      </div>
    </div>
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

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
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
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.dashboard.orderCode')}</TableHead>
                  <TableHead>{t('admin.dashboard.orderLines')}</TableHead>
                  <TableHead>{t('admin.dashboard.clientName')}</TableHead>
                  <TableHead>{t('admin.dashboard.orderType')}</TableHead>
                  <TableHead>{t('admin.dashboard.totalPrice')}</TableHead>
                  <TableHead>{t('admin.dashboard.orderDate')}</TableHead>
                  <TableHead>{t('admin.dashboard.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <TableRowSkeleton key={index} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.recentOrders')}</CardTitle>
          <CardDescription>{t('admin.dashboard.lastOrders')}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersErrorState error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.dashboard.recentOrders')}</CardTitle>
          <CardDescription>{t('admin.dashboard.lastOrders')}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Limit orders to specified number
  const displayOrders = orders.slice(0, limit);

  return (
    <Card>
      <CardHeader>
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
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">{t('admin.dashboard.orderCode')}</TableHead>
                <TableHead className="min-w-[200px]">{t('admin.dashboard.orderLines')}</TableHead>
                <TableHead className="min-w-[150px]">{t('admin.dashboard.clientName')}</TableHead>
                <TableHead className="min-w-[120px]">{t('admin.dashboard.orderType')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.totalPrice')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.orderDate')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.dashboard.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrders.map((order) => (
                <TableRow key={order.idOrder} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <span className="text-sm">{order.orderCode}</span>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate" title={order.orderLines}>
                        {order.orderLines}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{order.clientName}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={getOrderTypeBadgeColor(order.orderType)}
                    >
                      {order.orderTypeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">
                      {formatCurrency(order.totalPrice)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {order.orderDate}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getStatusBadgeVariant(order.orderStatus)}
                      className={getStatusBadgeColor(order.orderStatus)}
                    >
                      {order.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
