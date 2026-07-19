import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FileText, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Eye, 
  Download,
  Calendar,
  DollarSign,
  CreditCard,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { SupplierInvoice } from '@/types/draft-types/supplier.types';

interface SupplierInvoicesTableProps {
  invoices: SupplierInvoice[];
  isLoading?: boolean;
  onDeleteInvoice: (invoiceId: number) => Promise<void>;
  onViewInvoice?: (invoiceId: number) => void;
  onExportInvoice?: (invoiceId: number) => void;
}

/**
 * Supplier Invoices Table Component
 * Displays supplier invoices with pagination, search, and delete functionality
 */
export function SupplierInvoicesTable({
  invoices,
  isLoading = false,
  onDeleteInvoice,
  onViewInvoice,
  onExportInvoice,
}: SupplierInvoicesTableProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  // State for search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [sortField, setSortField] = useState<keyof SupplierInvoice>('idInvoice');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const searchLower = searchQuery.toLowerCase();
      return (
        invoice.idInvoice.toString().includes(searchLower) ||
        invoice.Due.toString().includes(searchLower) ||
        invoice.paid.toString().includes(searchLower) ||
        invoice.credit.toString().includes(searchLower) ||
        invoice.invoiceCreatedDate.toLowerCase().includes(searchLower)
      );
    });

    // Sort invoices
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
  }, [invoices, searchQuery, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Handle sort
  const handleSort = (field: keyof SupplierInvoice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async (invoiceId: number) => {
    try {
      await onDeleteInvoice(invoiceId);
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.invoiceDeleteSuccess'),
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.suppliers.invoiceDeleteError'),
        variant: 'destructive',
      });
    }
  };

  // Handle view invoice
  const handleViewInvoice = (invoiceId: number) => {
    if (onViewInvoice) {
      onViewInvoice(invoiceId);
    } else {
      toast({
        title: t('common.info'),
        description: 'View invoice functionality will be implemented in a future sprint',
        variant: 'default',
      });
    }
  };

  // Handle export invoice
  const handleExportInvoice = (invoiceId: number) => {
    if (onExportInvoice) {
      onExportInvoice(invoiceId);
    } else {
      toast({
        title: t('common.info'),
        description: 'Export invoice functionality will be implemented in a future sprint',
        variant: 'default',
      });
    }
  };

  // Get invoice status
  const getInvoiceStatus = (invoice: SupplierInvoice) => {
    if (invoice.paid >= invoice.Due) {
      return { status: 'paid', color: 'green', text: t('admin.suppliers.invoiceStatus.paid') };
    }
    if (invoice.paid > 0) {
      return { status: 'partial', color: 'yellow', text: t('admin.suppliers.invoiceStatus.partial') };
    }
    return { status: 'unpaid', color: 'red', text: t('admin.suppliers.invoiceStatus.unpaid') };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return (amount || 0).toLocaleString() + ' DZD';
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('admin.suppliers.invoices')}
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
    <Card role="region" aria-labelledby="invoices-title">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle id="invoices-title" className="flex items-center gap-2">
              <FileText className="h-5 w-5" aria-hidden="true" />
              {t('admin.suppliers.invoices')}
            </CardTitle>
            <CardDescription>
              {t('admin.suppliers.invoicesDescription')} ({filteredInvoices.length} {t('common.total')})
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={t('admin.suppliers.searchInvoices')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search invoices"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2" aria-label="Filter invoices">
            <Filter className="h-4 w-4" aria-hidden="true" />
            {t('common.filter')}
          </Button>
        </div>

        {/* Invoices Table */}
        {paginatedInvoices.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table role="table" aria-label="Supplier invoices">
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('idInvoice')}
                      role="columnheader"
                      aria-sort={sortField === 'idInvoice' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSort('idInvoice')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.invoiceId')}
                        {sortField === 'idInvoice' && (
                          <span className="text-xs" aria-hidden="true">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('Due')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.due')}
                        {sortField === 'Due' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('paid')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.paid')}
                        {sortField === 'paid' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('credit')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.credit')}
                        {sortField === 'credit' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSort('invoiceCreatedDate')}
                    >
                      <div className="flex items-center gap-2">
                        {t('admin.suppliers.date')}
                        {sortField === 'invoiceCreatedDate' && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead>{t('admin.suppliers.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const status = getInvoiceStatus(invoice);
                    return (
                      <TableRow key={invoice.idInvoice}>
                        <TableCell className="font-medium">
                          #{invoice.idInvoice}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {formatCurrency(invoice.Due)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {formatCurrency(invoice.paid)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-500" />
                            {formatCurrency(invoice.credit)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(invoice.invoiceCreatedDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`${
                              status.status === 'paid' ? 'bg-green-100 text-green-800' :
                              status.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            {status.text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewInvoice(invoice.idInvoice)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('common.view')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportInvoice(invoice.idInvoice)}>
                                <Download className="h-4 w-4 mr-2" />
                                {t('common.export')}
                              </DropdownMenuItem>
                              <Separator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.suppliers.deleteInvoice')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('admin.suppliers.deleteInvoiceConfirm').replace('{invoiceId}', invoice.idInvoice.toString())}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteInvoice(invoice.idInvoice)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {t('common.delete')}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                  {t('common.showing')} {startIndex + 1} - {Math.min(endIndex, filteredInvoices.length)} {t('common.of')} {filteredInvoices.length} {t('common.results')}
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
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('admin.suppliers.noInvoices')}</h3>
            <p className="text-muted-foreground">{t('admin.suppliers.noInvoicesDescription')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
