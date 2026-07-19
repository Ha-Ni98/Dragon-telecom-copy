/**
 * Admin Products Table Component
 * Displays products in a data table with all required columns and actions
 */

import React, { memo, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-8 w-24" /></TableCell>
    </TableRow>
  );
}

/**
 * Empty state component
 */
function ProductsEmptyState() {
  const { t } = useTranslation();
  
  return (
    <div className="text-center py-12">
      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">{t('admin.products.noProducts')}</h3>
      <p className="text-muted-foreground">{t('admin.products.noProductsDescription')}</p>
    </div>
  );
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

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('admin.products.title')}</CardTitle>
              <CardDescription>{t('admin.products.description')}</CardDescription>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.products.productCode')}</TableHead>
                  <TableHead>{t('admin.products.name')}</TableHead>
                  <TableHead>{t('admin.products.category')}</TableHead>
                  <TableHead>{t('admin.products.brand')}</TableHead>
                  <TableHead>{t('admin.products.stock')}</TableHead>
                  <TableHead>{t('admin.products.status')}</TableHead>
                  <TableHead>{t('admin.products.createdDate')}</TableHead>
                  <TableHead>{t('admin.products.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
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
    return <ProductsErrorState error={error} onRetry={onRetry} />;
  }

  // Empty state
  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('admin.products.title')}</CardTitle>
              <CardDescription>{t('admin.products.description')}</CardDescription>
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
          <ProductsEmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('admin.products.title')}</CardTitle>
            <CardDescription>
              {t('admin.products.description')} ({pagination?.totalItems || 0} {t('common.items')})
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
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table role="table" aria-label={t('admin.products.title')}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('admin.products.productCode')}</TableHead>
                <TableHead scope="col">{t('admin.products.name')}</TableHead>
                <TableHead scope="col">{t('admin.products.category')}</TableHead>
                <TableHead scope="col">{t('admin.products.brand')}</TableHead>
                <TableHead scope="col">{t('admin.products.stock')}</TableHead>
                <TableHead scope="col">{t('admin.products.status')}</TableHead>
                <TableHead scope="col">{t('admin.products.createdDate')}</TableHead>
                <TableHead scope="col">{t('admin.products.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formattedProducts.map((product) => (
                <TableRow key={product.idProduct} role="row">
                  <TableCell className="font-mono text-sm" role="cell">
                    <span aria-label={`Product code: ${product.productCodeBar}`}>
                      {product.productCodeBar}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium" role="cell">
                    <span aria-label={`Product name: ${product.productName}`}>
                      {product.productName}
                    </span>
                  </TableCell>
                  <TableCell role="cell">
                    <span aria-label={`Category: ${product.family.familyName}`}>
                      {product.family.familyName}
                    </span>
                  </TableCell>
                  <TableCell role="cell">
                    <span aria-label={`Brand: ${product.brand.brandName}`}>
                      {product.brand.brandName}
                    </span>
                  </TableCell>
                  <TableCell role="cell">
                    <span aria-label={`Stock quantity: ${product.stockQuantity}`}>
                      {formatStockQuantity(product.stockQuantity, product.status)}
                    </span>
                  </TableCell>
                  <TableCell role="cell">
                    <Badge 
                      variant={getStockStatusBadgeVariant(product.status)}
                      className={getStockStatusBadgeColor(product.status)}
                      aria-label={`Stock status: ${product.status}`}
                    >
                      {product.status === 'in_stock' && t('admin.products.statusInStock')}
                      {product.status === 'low_stock' && t('admin.products.statusLowStock')}
                      {product.status === 'out_of_stock' && t('admin.products.statusOutOfStock')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground" role="cell">
                    <span aria-label={`Created date: ${product.formattedDate}`}>
                      {product.formattedDate}
                    </span>
                  </TableCell>
                  <TableCell role="cell">
                    <AdminProductActions
                      productId={product.idProduct}
                      productName={product.productName}
                      onEdit={onEdit}
                      onAddStock={onAddStock}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
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
