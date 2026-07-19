import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SimplePagination } from '@/components/shared/SimplePagination';
import {
  Package,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Download,
  Eye,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductSupplyHistory } from '@/types/draft-types';

interface SupplierProductHistoryTableProps {
  productHistory: ProductSupplyHistory[];
  isLoading?: boolean;
  onViewProduct?: (productId: number) => void;
  onExportHistory?: () => void;
}

/**
 * Supplier Product History Table Component
 * Displays product supply history with pagination, search, and filtering
 */
export function SupplierProductHistoryTable({
  productHistory,
  isLoading = false,
  onViewProduct,
  onExportHistory,
}: SupplierProductHistoryTableProps) {
  const { t } = useTranslation();

  // State for search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [sortField, setSortField] = useState<keyof ProductSupplyHistory>('supplyDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter and search product history
  const filteredHistory = useMemo(() => {
    let filtered = productHistory.filter(item => {
      const searchLower = searchQuery.toLowerCase();
      return (
        item.productName.toLowerCase().includes(searchLower) ||
        item.quantitySupplied.toString().includes(searchLower) ||
        item.supplyDate.toLowerCase().includes(searchLower)
      );
    });

    // Sort product history
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [productHistory, searchQuery, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // Handle view product
  const handleViewProduct = (productId: number) => {
    if (onViewProduct) {
      onViewProduct(productId);
    } else {
      console.log('View product functionality will be implemented in a future sprint');
    }
  };

  // Handle export history
  const handleExportHistory = () => {
    if (onExportHistory) {
      onExportHistory();
    } else {
      console.log('Export history functionality will be implemented in a future sprint');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Get supply trend indicator
  const getSupplyTrend = (quantity: number) => {
    if (quantity >= 100) {
      return { icon: TrendingUp, color: 'text-green-500', badgeClass: 'bg-green-100 text-green-800', text: t('admin.suppliers.trend.high') };
    }
    if (quantity >= 50) {
      return { icon: TrendingUp, color: 'text-blue-500', badgeClass: 'bg-blue-100 text-blue-800', text: t('admin.suppliers.trend.medium') };
    }
    return { icon: TrendingDown, color: 'text-amber-500', badgeClass: 'bg-amber-100 text-amber-800', text: t('admin.suppliers.trend.low') };
  };

  // Calculate total quantities
  const totalQuantitySupplied = productHistory.reduce((sum, item) => sum + (item.quantitySupplied || 0), 0);
  const averageQuantity = productHistory.length > 0 ? totalQuantitySupplied / productHistory.length : 0;

  const columns = useMemo<ColumnDef<ProductSupplyHistory>[]>(() => [
    {
      accessorKey: 'productName',
      header: t('admin.suppliers.productName'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <Package className="h-4 w-4 text-muted-foreground" />
          {row.original.productName}
        </div>
      ),
    },
    {
      accessorKey: 'quantitySupplied',
      header: t('admin.suppliers.quantitySupplied'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{(row.original.quantitySupplied || 0).toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">{t('common.units')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'supplyDate',
      header: t('admin.suppliers.supplyDate'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(row.original.supplyDate)}
        </div>
      ),
    },
    {
      id: 'trend',
      header: t('admin.suppliers.supplyTrend'),
      cell: ({ row }) => {
        const trend = getSupplyTrend(row.original.quantitySupplied);
        const TrendIcon = trend.icon;
        return (
          <div className="flex items-center gap-2">
            <TrendIcon className={`h-4 w-4 ${trend.color}`} />
            <Badge variant="outline" className={trend.badgeClass}>
              {trend.text}
            </Badge>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">{t('common.actions')}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewProduct(row.original.idProduct)}>
                <Eye className="h-4 w-4 mr-2" />
                {t('common.view')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  const renderMobileRow = (item: ProductSupplyHistory) => {
    const trend = getSupplyTrend(item.quantitySupplied);
    const TrendIcon = trend.icon;
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Package className="h-4 w-4 text-muted-foreground" />
            {item.productName}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewProduct(item.idProduct)}>
                <Eye className="h-4 w-4 mr-2" />
                {t('common.view')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>{(item.quantitySupplied || 0).toLocaleString()} {t('common.units')}</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(item.supplyDate)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={`h-4 w-4 ${trend.color}`} />
          <Badge variant="outline" className={trend.badgeClass}>{trend.text}</Badge>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.suppliers.productHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={5} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card role="region" aria-labelledby="product-history-title">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle id="product-history-title" className="flex items-center gap-2">
              <Package className="h-5 w-5" aria-hidden="true" />
              {t('admin.suppliers.productHistory')}
            </CardTitle>
            <CardDescription>
              {t('admin.suppliers.productHistoryDescription')} ({filteredHistory.length} {t('common.total')})
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHistory}
              className="gap-2"
              aria-label={t("admin.suppliers.exportHistoryAria")}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('common.export')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg" role="region" aria-label={t("admin.suppliers.historyStatsAria")}>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary" aria-label={t('admin.suppliers.totalProductsAria', { count: productHistory.length })}>
              {productHistory.length}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.totalProducts')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600" aria-label={t('admin.suppliers.totalQuantityAria', { count: (totalQuantitySupplied || 0).toLocaleString() })}>
              {(totalQuantitySupplied || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.totalQuantity')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600" aria-label={t('admin.suppliers.averageQuantityAria', { count: Math.round(averageQuantity || 0).toLocaleString() })}>
              {Math.round(averageQuantity || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.averageQuantity')}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.suppliers.searchProducts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortField} onValueChange={(v) => setSortField(v as keyof ProductSupplyHistory)}>
            <SelectTrigger className="w-full sm:w-44" aria-label={t('admin.suppliers.sortBy')}>
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('admin.suppliers.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="productName">{t('admin.suppliers.productName')}</SelectItem>
              <SelectItem value="quantitySupplied">{t('admin.suppliers.quantitySupplied')}</SelectItem>
              <SelectItem value="supplyDate">{t('admin.suppliers.supplyDate')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            aria-label={t('admin.suppliers.sortBy')}
          >
            <ArrowUpDown className="h-4 w-4" />
            {sortDirection === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        {/* Product History Table */}
        <DataTable
          columns={columns}
          data={paginatedHistory}
          getRowKey={(item) => `${item.idProduct}-${item.supplyDate}`}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t('admin.suppliers.noProductHistory')}
              body={t('admin.suppliers.noProductHistoryDescription')}
            />
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <SimplePagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </CardContent>
    </Card>
  );
}
