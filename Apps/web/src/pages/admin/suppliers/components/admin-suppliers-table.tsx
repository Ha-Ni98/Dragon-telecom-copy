/**
 * Admin Suppliers Table Component
 * Displays suppliers in a data table with search, filtering, and pagination
 */

import { memo, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Truck,
  RefreshCw,
  AlertTriangle,
  Edit,
  Plus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Package,
  FileText,
  Search
} from 'lucide-react';
import {
  AdminSuppliersPaginatedResponse,
  SupplierWithDetails
} from '@/types/draft-types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminSuppliersTable component
 */
interface AdminSuppliersTableProps {
  /** Paginated suppliers data */
  data?: AdminSuppliersPaginatedResponse;
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
  onEdit: (supplierId: number) => void;
  /** Callback when add invoice button is clicked */
  onAddInvoice: (supplierId: number) => void;
  /** Callback when delete button is clicked */
  onDelete: (supplierId: number) => void;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Search query */
  searchQuery?: string;
  /** Callback when search changes */
  onSearchChange?: (query: string) => void;
  /** Custom className for styling */
  className?: string;
}

type FormattedSupplier = SupplierWithDetails & {
  formattedCredit: string;
  formattedTotalDue: string;
  formattedTotalPaid: string;
  formattedTotalCredit: string;
};

/**
 * Format currency value for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Error state component
 */
function TableErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-center space-x-4">
        <span>{error}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            {t('common.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Main AdminSuppliersTable component
 */
export const AdminSuppliersTable = memo(function AdminSuppliersTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onEdit,
  onAddInvoice,
  onDelete,
  onPageChange,
  searchQuery = '',
  onSearchChange,
  className = '',
}: AdminSuppliersTableProps) {
  const { t } = useTranslation();

  // Extract suppliers and pagination from data
  const suppliers = data?.suppliers || [];
  const pagination = data?.pagination;

  // Memoize formatted suppliers to avoid recalculation on every render
  const formattedSuppliers = useMemo(() => {
    return suppliers.map(supplier => ({
      ...supplier,
      formattedCredit: formatCurrency(supplier.supplierCredit),
      formattedTotalDue: formatCurrency(supplier.totalDue),
      formattedTotalPaid: formatCurrency(supplier.totalPaid),
      formattedTotalCredit: formatCurrency(supplier.totalCredit),
    }));
  }, [suppliers]);

  const columns = useMemo<ColumnDef<FormattedSupplier>[]>(() => [
    {
      accessorKey: 'supplierName',
      header: t('admin.suppliers.table.supplier'),
      cell: ({ row }) => <div className="break-words max-w-[150px] font-medium">{row.original.supplierName}</div>,
    },
    {
      accessorKey: 'supplierPersonName',
      header: t('admin.suppliers.table.person'),
      cell: ({ row }) => <div className="break-words max-w-[120px]">{row.original.supplierPersonName || '-'}</div>,
    },
    {
      id: 'contact',
      header: t('admin.suppliers.table.contact'),
      cell: ({ row }) => (
        <div className="space-y-1 max-w-[200px]">
          {row.original.supplierPhone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{row.original.supplierPhone}</span>
            </div>
          )}
          {row.original.supplierEmail && (
            <div className="flex items-center gap-1 text-sm">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{row.original.supplierEmail}</span>
            </div>
          )}
          {!row.original.supplierPhone && !row.original.supplierEmail && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'supplierLocation',
      header: t('admin.suppliers.table.location'),
      cell: ({ row }) => (
        row.original.supplierLocation ? (
          <div className="flex items-center gap-1 text-sm break-words max-w-[100px]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="break-words">{row.original.supplierLocation}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      ),
    },
    {
      accessorKey: 'formattedCredit',
      header: t('admin.suppliers.table.credit'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.formattedCredit}</div>
          <div className="text-xs text-muted-foreground">
            {t('admin.suppliers.table.due')}: {row.original.formattedTotalDue}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'productsSuppliedCount',
      header: t('admin.suppliers.table.products'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          <span>{formatNumber(row.original.productsSuppliedCount)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'invoicesCount',
      header: t('admin.suppliers.table.invoices'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          <span>{formatNumber(row.original.invoicesCount)}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('admin.suppliers.table.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row.original.idSupplier)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddInvoice(row.original.idSupplier)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(row.original.idSupplier)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, onEdit, onAddInvoice, onDelete]);

  const renderMobileRow = (supplier: FormattedSupplier) => (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{supplier.supplierName}</div>
          <div className="text-sm text-muted-foreground">{supplier.supplierPersonName || '-'}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(supplier.idSupplier)} className="h-8 w-8 p-0">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddInvoice(supplier.idSupplier)} className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(supplier.idSupplier)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        {supplier.supplierPhone && (
          <div className="flex items-center gap-1 text-sm">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{supplier.supplierPhone}</span>
          </div>
        )}
        {supplier.supplierEmail && (
          <div className="flex items-center gap-1 text-sm">
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{supplier.supplierEmail}</span>
          </div>
        )}
        {supplier.supplierLocation && (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{supplier.supplierLocation}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-2 border-t text-sm">
        <div>
          <div className="font-medium">{supplier.formattedCredit}</div>
          <div className="text-xs text-muted-foreground">{t('admin.suppliers.table.due')}: {supplier.formattedTotalDue}</div>
        </div>
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          <span>{formatNumber(supplier.productsSuppliedCount)}</span>
        </div>
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          <span>{formatNumber(supplier.invoicesCount)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Card className={`${className} `}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t('admin.suppliers.table.title')}</CardTitle>
            <CardDescription className="text-sm">{t('admin.suppliers.table.description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Search Bar */}
        {onSearchChange && (
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.suppliers.table.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : error ? (
          <TableErrorState error={error} onRetry={onRetry} />
        ) : (
          <DataTable
            columns={columns}
            data={formattedSuppliers}
            getRowKey={(supplier) => String(supplier.idSupplier)}
            renderMobileRow={renderMobileRow}
            emptyState={
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title={t('admin.suppliers.table.noSuppliers')}
                body={t('admin.suppliers.table.noSuppliersDescription')}
              />
            }
          />
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-3">
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

export default AdminSuppliersTable;
