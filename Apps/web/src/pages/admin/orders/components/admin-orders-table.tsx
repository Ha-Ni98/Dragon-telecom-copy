/**
 * Admin Orders Table Component
 * Displays orders in a data table with search, filtering, and pagination
 */

import { memo, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { AdminOrderWithDetails } from '@/types/draft-types/order.types';
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

type FormattedOrder = AdminOrderWithDetails & { productsList: string[] };

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
 * Error state for orders table
 */
function OrdersTableError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
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
              {t('common.retry')}
            </Button>
          )}
        </AlertDescription>
      </Alert>
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
        aria-label={t('admin.orders.table.showAria', { code: order.orderCode })}
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
          aria-label={t('admin.orders.table.editAria', { code: order.orderCode })}
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
  const totalPages = data?.totalPages || 0;

  // Memoize formatted orders to avoid recalculation on every render
  const formattedOrders = useMemo(() => {
    return orders.map(order => ({
      ...order,
      productsList: order.orderLines.map(line => line.product.productName),
    }));
  }, [orders]);

  const truncateProducts = (products: string[], maxLength: number = 2): string => {
    if (products.length <= maxLength) {
      return products.join(', ');
    }
    const visible = products.slice(0, maxLength);
    const remaining = products.length - maxLength;
    return `${visible.join(', ')} ${t('admin.orders.table.moreProducts', { count: remaining })}`;
  };

  const columns = useMemo<ColumnDef<FormattedOrder>[]>(() => [
    {
      accessorKey: 'orderCode',
      header: t('admin.orders.table.orderId'),
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.orderCode}</span>,
    },
    {
      id: 'client',
      header: t('admin.orders.table.client'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">
            {row.original.client.clientFirstName} {row.original.client.clientLastName}
          </div>
          <div className="text-sm text-muted-foreground">{row.original.client.clientPhoneNumber}</div>
        </div>
      ),
    },
    {
      accessorKey: 'productsList',
      header: t('admin.orders.table.products'),
      cell: ({ row }) => <div className="text-sm max-w-xs">{truncateProducts(row.original.productsList)}</div>,
    },
    {
      id: 'type',
      header: t('admin.orders.table.type'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getOrderTypeIcon(row.original.orderType)}
          <span className="text-sm">{row.original.typeLabel}</span>
        </div>
      ),
    },
    {
      id: 'wilaya',
      header: t('admin.orders.table.wilaya'),
      cell: ({ row }) => <div className="text-sm">{row.original.client.clientWilaya}</div>,
    },
    {
      accessorKey: 'orderGrandTotal',
      header: t('admin.orders.table.total'),
      cell: ({ row }) => <div className="font-medium">{formatDZD(row.original.orderGrandTotal)}</div>,
    },
    {
      accessorKey: 'formattedDate',
      header: t('admin.orders.table.date'),
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.original.formattedDate}</div>,
    },
    {
      id: 'actions',
      header: t('admin.orders.table.actions'),
      cell: ({ row }) => (
        <OrderActions
          order={row.original}
          onShow={onShowOrder || (() => {})}
          onEdit={onEditOrder || (() => {})}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, onShowOrder, onEditOrder]);

  const renderMobileRow = (order: FormattedOrder) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{order.orderCode}</span>
        <div className="font-medium">{formatDZD(order.orderGrandTotal)}</div>
      </div>
      <div className="text-sm">
        <div className="font-medium">{order.client.clientFirstName} {order.client.clientLastName}</div>
        <div className="text-muted-foreground">{order.client.clientPhoneNumber}</div>
      </div>
      <div className="text-sm">{truncateProducts(order.productsList)}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {getOrderTypeIcon(order.orderType)}
          <span>{order.typeLabel}</span>
        </div>
        <span className="text-xs text-muted-foreground">{order.formattedDate}</span>
      </div>
      <OrderActions
        order={order}
        onShow={onShowOrder || (() => {})}
        onEdit={onEditOrder || (() => {})}
      />
    </div>
  );

  const header = (
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
  );

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <TableSkeleton rows={5} columns={8} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>{header}</CardHeader>
        <CardContent>
          <OrdersTableError error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>{header}</CardHeader>

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
              aria-label={t('admin.orders.searchAria')}
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
        <DataTable
          columns={columns}
          data={formattedOrders}
          getRowKey={(order) => String(order.idOrder)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title={t('admin.orders.table.noOrdersFound')}
              body={t('admin.orders.table.noOrdersDescription')}
            />
          }
        />

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
