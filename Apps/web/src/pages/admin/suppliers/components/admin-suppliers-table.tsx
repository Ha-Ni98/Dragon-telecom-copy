/**
 * Admin Suppliers Table Component
 * Displays suppliers in a data table with search, filtering, and pagination
 */

import { memo, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimplePagination } from '@/components/shared/SimplePagination';
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
  AdminSuppliersPaginatedResponse
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
 * Loading skeleton for table rows
 */
const TableLoadingSkeleton = memo(function TableLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-8 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
});

/**
 * Error state component
 */
const TableErrorState = memo(function TableErrorState({ 
  error, 
  onRetry 
}: { 
  error: string; 
  onRetry?: () => void; 
}) {
  const { t } = useTranslation();

  return (
    <TableRow>
      <TableCell colSpan={8} className="text-center py-8">
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
      </TableCell>
    </TableRow>
  );
});

/**
 * Empty state component
 */
const TableEmptyState = memo(function TableEmptyState() {
  const { t } = useTranslation();

  return (
    <TableRow>
      <TableCell colSpan={8} className="text-center py-8">
        <div className="flex flex-col items-center space-y-2">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('admin.suppliers.table.noSuppliers')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin.suppliers.table.noSuppliersDescription')}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
});

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
        <div className="overflow-x-auto">
          <Table className="min-w-4xl">
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.suppliers.table.supplier')}</TableHead>
                <TableHead>{t('admin.suppliers.table.person')}</TableHead>
                <TableHead>{t('admin.suppliers.table.contact')}</TableHead>
                <TableHead>{t('admin.suppliers.table.location')}</TableHead>
                <TableHead>{t('admin.suppliers.table.credit')}</TableHead>
                <TableHead>{t('admin.suppliers.table.products')}</TableHead>
                <TableHead>{t('admin.suppliers.table.invoices')}</TableHead>
                <TableHead>{t('admin.suppliers.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoadingSkeleton />
              ) : error ? (
                <TableErrorState error={error} onRetry={onRetry} />
              ) : formattedSuppliers.length === 0 ? (
                <TableEmptyState />
              ) : (
                formattedSuppliers.map((supplier) => (
                  <TableRow key={supplier.idSupplier} className="h-10">
                    <TableCell className="font-medium max-w-[150px]">
                      <div className="break-words">
                        {supplier.supplierName}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[120px]">
                      <div className="break-words">
                        {supplier.supplierPersonName || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="space-y-1">
                        {supplier.supplierPhone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{supplier.supplierPhone}</span>
                          </div>
                        )}
                        {supplier.supplierEmail && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{supplier.supplierEmail}</span>
                          </div>
                        )}
                        {!supplier.supplierPhone && !supplier.supplierEmail && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[100px]">
                      {supplier.supplierLocation ? (
                        <div className="flex items-center gap-1 text-sm break-words">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="break-words">{supplier.supplierLocation}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {supplier.formattedCredit}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due: {supplier.formattedTotalDue}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{formatNumber(supplier.productsSuppliedCount)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{formatNumber(supplier.invoicesCount)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(supplier.idSupplier)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAddInvoice(supplier.idSupplier)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(supplier.idSupplier)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
