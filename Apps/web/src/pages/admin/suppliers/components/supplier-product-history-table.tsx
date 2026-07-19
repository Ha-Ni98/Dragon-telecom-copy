import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Package, 
  Search, 
  Filter, 
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreVertical
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

  // Handle sort
  const handleSort = (field: keyof ProductSupplyHistory) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
      return { icon: TrendingUp, color: 'text-green-500', text: 'High' };
    }
    if (quantity >= 50) {
      return { icon: TrendingUp, color: 'text-blue-500', text: 'Medium' };
    }
    return { icon: TrendingDown, color: 'text-amber-500', text: 'Low' };
  };

  // Calculate total quantities
  const totalQuantitySupplied = productHistory.reduce((sum, item) => sum + (item.quantitySupplied || 0), 0);
  const averageQuantity = productHistory.length > 0 ? totalQuantitySupplied / productHistory.length : 0;

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
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
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
              aria-label="Export product history"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('common.export')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg" role="region" aria-label="Product history statistics">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary" aria-label={`${productHistory.length} total products`}>
              {productHistory.length}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.totalProducts')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600" aria-label={`${(totalQuantitySupplied || 0).toLocaleString()} total quantity`}>
              {(totalQuantitySupplied || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.totalQuantity')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600" aria-label={`${Math.round(averageQuantity || 0).toLocaleString()} average quantity`}>
              {Math.round(averageQuantity || 0).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('admin.suppliers.averageQuantity')}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.suppliers.searchProducts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            {t('common.filter')}
          </Button>
        </div>

        {/* Product History Table */}
        {paginatedHistory.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('productName')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.productName')}
                        {sortField === 'productName' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('quantitySupplied')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.quantitySupplied')}
                        {sortField === 'quantitySupplied' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('supplyDate')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.supplyDate')}
                        {sortField === 'supplyDate' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead>{t('admin.suppliers.supplyTrend')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((item) => {
                    const trend = getSupplyTrend(item.quantitySupplied);
                    const TrendIcon = trend.icon;
                    return (
                      <TableRow key={`${item.idProduct}-${item.supplyDate}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {item.productName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {(item.quantitySupplied || 0).toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {t('common.units')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(item.supplyDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TrendIcon className={`h-4 w-4 ${trend.color}`} />
                            <Badge 
                              variant="outline"
                              className={`${
                                trend.text === 'High' ? 'bg-green-100 text-green-800' :
                                trend.text === 'Medium' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {trend.text}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('common.showing')} {startIndex + 1} - {Math.min(endIndex, filteredHistory.length)} {t('common.of')} {filteredHistory.length} {t('common.results')}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('common.previous')}
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {t('common.next')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('admin.suppliers.noProductHistory')}</h3>
            <p className="text-muted-foreground">{t('admin.suppliers.noProductHistoryDescription')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
