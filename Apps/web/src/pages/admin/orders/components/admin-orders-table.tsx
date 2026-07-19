/**
 * Admin Orders Table Component
 * Displays orders in a data table with search, filtering, and pagination
 */

import React, { memo, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { 
  ShoppingCart, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Filter,
  Eye,
  Edit,
  Package,
  Truck
} from 'lucide-react';
import { AdminOrderWithDetails, AdminOrderShowDialogProps, AdminOrderEditDialogProps } from '@/types/draft-types/order.types';
import { OrderStatusCode } from '@/types/draft-types/enums.types';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDZD } from '@/lib/utils';

interface AdminOrdersTableProps {
  /** Paginated orders data */
  data?: {
    orders: AdminOrderWithDetails[];
    total: number;
    totalPages: number;
  };
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
  /** Search term */
  searchTerm?: string;
  /** Search change handler */
  onSearchChange?: (term: string) => void;
  /** Status filter */
  statusFilter?: OrderStatusCode | 'all';
  /** Status filter change handler */
  onStatusFilterChange?: (status: OrderStatusCode | 'all') => void;
  /** Current page */
  currentPage?: number;
  /** Page change handler */
  onPageChange?: (page: number) => void;
  /** Show order dialog handler */
  onShowOrder?: (order: AdminOrderWithDetails) => void;
  /** Edit order dialog handler */
  onEditOrder?: (order: AdminOrderWithDetails) => void;
  /** Custom className for styling */
  className?: string;
}

/**
 * Get status badge variant and color
 */
function getStatusBadgeVariant(status: OrderStatusCode) {
  switch (status) {
    case OrderStatusCode.pending:
      return 'secondary';
    case OrderStatusCode.confirmed:
      return 'default';
    case OrderStatusCode.delivery:
      return 'outline';
    case OrderStatusCode.completed:
      return 'default';
    case OrderStatusCode.canceled:
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Get status badge color class
 */
function getStatusBadgeColor(status: OrderStatusCode) {
  switch (status) {
    case OrderStatusCode.pending:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case OrderStatusCode.confirmed:
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case OrderStatusCode.delivery:
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case OrderStatusCode.completed:
      return 'bg-green-100 text-green-800 border-green-200';
    case OrderStatusCode.canceled:
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Get order type icon
 */
function getOrderTypeIcon(orderType: number) {
  switch (orderType) {
    case 0: // pick-up
      return <Package className="h-4 w-4" />;
    case 1: // delivry-home
    case 2: // delivry-office
      return <Truck className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

/**
 * Truncate products list for display
 */
function truncateProducts(products: string[], maxLength: number = 2): string {
  if (products.length <= maxLength) {
    return products.join(', ');
  }
  const visible = products.slice(0, maxLength);
  const remaining = products.length - maxLength;
  return `${visible.join(', ')} +${remaining} more`;
}

/**
 * Loading skeleton for orders table
 */
function OrdersTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      
      {/* Table skeleton */}
      <div className="border rounded-lg">
        <div className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Error state for orders table
 */
function OrdersTableError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="space-y-4">
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-700">
          {error}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-2 text-red-600 border-red-300 hover:bg-red-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Empty state for orders table
 */
function OrdersTableEmpty() {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-12">
      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
        {t('admin.orders.table.noOrdersFound')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('admin.orders.table.noOrdersDescription')}
      </p>
    </div>
  );
}

/**
 * Action buttons for order table rows
 */
function OrderActions({ 
  order, 
  onShow, 
  onEdit 
}: { 
  order: AdminOrderWithDetails; 
  onShow: (order: AdminOrderWithDetails) => void;
  onEdit: (order: AdminOrderWithDetails) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onShow(order)}
        className="flex items-center gap-1"
        aria-label={`Show details for order ${order.orderCode}`}
      >
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">{t('admin.orders.table.show')}</span>
      </Button>
      
      {order.canBeEdited && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(order)}
          className="flex items-center gap-1"
          aria-label={`Edit order ${order.orderCode}`}
        >
          <Edit className="h-4 w-4" />
          <span className="hidden sm:inline">{t('admin.orders.table.edit')}</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Main AdminOrdersTable component
 */
export const AdminOrdersTable = memo(function AdminOrdersTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  searchTerm = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusFilterChange,
  currentPage = 1,
  onPageChange,
  onShowOrder,
  onEditOrder,
  className = ''
}: AdminOrdersTableProps) {
  const { t } = useTranslation();

  // Extract orders and pagination from data
  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  // Memoize formatted orders to avoid recalculation on every render
  const formattedOrders = useMemo(() => {
    return orders.map(order => ({
      ...order,
      productsList: order.orderLines.map(line => line.product.productName),
    }));
  }, [orders]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t('admin.orders.table.title')}
              </CardTitle>
              <CardDescription>{t('admin.orders.table.description')}</CardDescription>
            </div>
            {showRefresh && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('common.refresh')}</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <OrdersTableSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {t('admin.orders.table.title')}
              </CardTitle>
              <CardDescription>{t('admin.orders.table.description')}</CardDescription>
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
          <OrdersTableError error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {t('admin.orders.table.title')}
            </CardTitle>
            <CardDescription>{t('admin.orders.table.description')}</CardDescription>
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
      
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.orders.table.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-10"
              aria-label="Search orders by client name"
            />
          </div>
          
          <Select
            value={String(statusFilter)}
            onValueChange={(v) => onStatusFilterChange?.(v === 'all' ? 'all' : (Number(v) as OrderStatusCode))}
          >
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('admin.orders.table.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.orders.table.allStatuses')}</SelectItem>
              <SelectItem value={String(OrderStatusCode.pending)}>{t('orders.pending')}</SelectItem>
              <SelectItem value={String(OrderStatusCode.confirmed)}>{t('orders.confirmed')}</SelectItem>
              <SelectItem value={String(OrderStatusCode.delivery)}>{t('orders.delivery')}</SelectItem>
              <SelectItem value={String(OrderStatusCode.completed)}>{t('orders.completed')}</SelectItem>
              <SelectItem value={String(OrderStatusCode.canceled)}>{t('orders.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        {formattedOrders.length === 0 ? (
          <OrdersTableEmpty />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.orders.table.orderId')}</TableHead>
                  <TableHead>{t('admin.orders.table.client')}</TableHead>
                  <TableHead>{t('admin.orders.table.products')}</TableHead>
                  <TableHead>{t('admin.orders.table.type')}</TableHead>
                  <TableHead>{t('admin.orders.table.wilaya')}</TableHead>
                  <TableHead>{t('admin.orders.table.total')}</TableHead>
                  <TableHead>{t('admin.orders.table.date')}</TableHead>
                  <TableHead>{t('admin.orders.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedOrders.map((order) => (
                  <TableRow key={order.idOrder} role="row">
                    <TableCell className="font-medium" role="cell">
                      <span className="font-mono text-sm">{order.orderCode}</span>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {order.client.clientFirstName} {order.client.clientLastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.client.clientPhoneNumber}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="text-sm max-w-xs">
                        {truncateProducts(order.productsList)}
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="flex items-center gap-2">
                        {getOrderTypeIcon(order.orderType)}
                        <span className="text-sm">{order.typeLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="text-sm">
                        {order.client.clientWilaya}
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="font-medium">
                        {formatDZD(order.orderGrandTotal)}
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <div className="text-sm text-muted-foreground">
                        {order.formattedDate}
                      </div>
                    </TableCell>
                    <TableCell role="cell">
                      <OrderActions
                        order={order}
                        onShow={onShowOrder || (() => {})}
                        onEdit={onEditOrder || (() => {})}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t pt-4">
            <SimplePagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange || (() => {})}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
