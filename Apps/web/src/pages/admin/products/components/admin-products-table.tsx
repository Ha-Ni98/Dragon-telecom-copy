/**
 * Admin Products Table Component
 * Displays products in a data table with all required columns and actions
 */

import { memo, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { AdminProductWithDetails, AdminProductsPaginatedResponse } from '@/types/draft-types/admin.types';
import { AdminProductActions } from './admin-product-actions';
import { useTranslation } from '@/hooks/useTranslation';
import { formatAdminDate } from '@/lib/date-utils';
import { SimplePagination } from '@/components/shared/SimplePagination';

interface AdminProductsTableProps {
  /** Paginated products data */
  data?: AdminProductsPaginatedResponse;
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
  /** Callback when edit button is clicked */
  onEdit: (productId: number) => void;
  /** Callback when add to stock button is clicked */
  onAddStock: (productId: number) => void;
  /** Callback when delete button is clicked */
  onDelete: (productId: number) => void;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
}

type FormattedProduct = AdminProductWithDetails & { formattedDate: string };

/**
 * Get stock status badge variant and color
 */
function getStockStatusBadgeVariant(status: 'in_stock' | 'low_stock' | 'out_of_stock') {
  switch (status) {
    case 'in_stock':
      return 'default' as const;
    case 'low_stock':
      return 'secondary' as const;
    case 'out_of_stock':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

/**
 * Get stock status badge color class
 */
function getStockStatusBadgeColor(status: 'in_stock' | 'low_stock' | 'out_of_stock') {
  switch (status) {
    case 'in_stock':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'low_stock':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'out_of_stock':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

/**
 * Format stock quantity with appropriate styling
 */
function formatStockQuantity(quantity: number, status: 'in_stock' | 'low_stock' | 'out_of_stock') {
  const formatted = quantity.toString();

  if (status === 'out_of_stock') {
    return <span className="text-destructive font-medium">{formatted}</span>;
  } else if (status === 'low_stock') {
    return <span className="text-yellow-600 font-medium">{formatted}</span>;
  }

  return <span className="text-green-600 font-medium">{formatted}</span>;
}

/**
 * Error state component
 */
function ProductsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="col-span-full">
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
    </div>
  );
}

/**
 * Main Admin Products Table Component
 */
export const AdminProductsTable = memo(function AdminProductsTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onEdit,
  onAddStock,
  onDelete,
  onPageChange,
}: AdminProductsTableProps) {
  const { t, language } = useTranslation();

  // Extract products and pagination from data
  const products = data?.products || [];
  const pagination = data?.pagination;

  // Memoize formatted products to avoid recalculation on every render
  const formattedProducts = useMemo(() => {
    return products.map(product => ({
      ...product,
      formattedDate: formatAdminDate(product.createdDate, language as 'en' | 'fr'),
    }));
  }, [products, language]);

  const statusLabel = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    if (status === 'in_stock') return t('admin.products.statusInStock');
    if (status === 'low_stock') return t('admin.products.statusLowStock');
    return t('admin.products.statusOutOfStock');
  };

  const columns = useMemo<ColumnDef<FormattedProduct>[]>(() => [
    {
      accessorKey: 'productCodeBar',
      header: t('admin.products.productCode'),
      cell: ({ row }) => (
        <span className="font-mono text-sm" aria-label={t('admin.products.table.productCodeAria', { code: row.original.productCodeBar })}>
          {row.original.productCodeBar}
        </span>
      ),
    },
    {
      accessorKey: 'productName',
      header: t('admin.products.name'),
      cell: ({ row }) => (
        <span className="font-medium" aria-label={t('admin.products.table.productNameAria', { name: row.original.productName })}>
          {row.original.productName}
        </span>
      ),
    },
    {
      id: 'category',
      header: t('admin.products.category'),
      cell: ({ row }) => (
        <span aria-label={t('admin.products.table.categoryAria', { category: row.original.family.familyName })}>
          {row.original.family.familyName}
        </span>
      ),
    },
    {
      id: 'brand',
      header: t('admin.products.brand'),
      cell: ({ row }) => (
        <span aria-label={t('admin.products.table.brandAria', { brand: row.original.brand.brandName })}>
          {row.original.brand.brandName}
        </span>
      ),
    },
    {
      accessorKey: 'stockQuantity',
      header: t('admin.products.stock'),
      cell: ({ row }) => (
        <span aria-label={t('admin.products.table.stockQuantityAria', { quantity: row.original.stockQuantity })}>
          {formatStockQuantity(row.original.stockQuantity, row.original.status)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('admin.products.status'),
      cell: ({ row }) => (
        <Badge
          variant={getStockStatusBadgeVariant(row.original.status)}
          className={getStockStatusBadgeColor(row.original.status)}
          aria-label={t('admin.products.table.stockStatusAria', { status: row.original.status })}
        >
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'formattedDate',
      header: t('admin.products.createdDate'),
      cell: ({ row }) => (
        <span className="text-muted-foreground" aria-label={t('admin.products.table.createdDateAria', { date: row.original.formattedDate })}>
          {row.original.formattedDate}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('admin.products.actions'),
      cell: ({ row }) => (
        <AdminProductActions
          productId={row.original.idProduct}
          productName={row.original.productName}
          onEdit={onEdit}
          onAddStock={onAddStock}
          onDelete={onDelete}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, onEdit, onAddStock, onDelete]);

  const renderMobileRow = (product: FormattedProduct) => (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{product.productName}</div>
          <div className="font-mono text-xs text-muted-foreground">{product.productCodeBar}</div>
        </div>
        <Badge
          variant={getStockStatusBadgeVariant(product.status)}
          className={getStockStatusBadgeColor(product.status)}
        >
          {statusLabel(product.status)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
        <span>{product.family.familyName}</span>
        <span>{product.brand.brandName}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        {formatStockQuantity(product.stockQuantity, product.status)}
        <span className="text-muted-foreground">{product.formattedDate}</span>
      </div>
      <AdminProductActions
        productId={product.idProduct}
        productName={product.productName}
        onEdit={onEdit}
        onAddStock={onAddStock}
        onDelete={onDelete}
      />
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>{t('admin.products.title')}</CardTitle>
        <CardDescription>
          {pagination ? `${t('admin.products.description')} (${pagination.totalItems} ${t('common.items')})` : t('admin.products.description')}
        </CardDescription>
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
          <TableSkeleton rows={5} columns={8} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return <ProductsErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={formattedProducts}
          getRowKey={(product) => String(product.idProduct)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t('admin.products.noProducts')}
              body={t('admin.products.noProductsDescription')}
            />
          }
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t">
            <SimplePagination
              page={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});
