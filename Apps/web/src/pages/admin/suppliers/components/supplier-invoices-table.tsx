import { useState, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SimplePagination } from '@/components/shared/SimplePagination';
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
  ArrowUpDown
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
        description: t('admin.suppliers.viewInvoiceComingSoon'),
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
        description: t('admin.suppliers.exportInvoiceComingSoon'),
        variant: 'default',
      });
    }
  };

  // Get invoice status
  const getInvoiceStatus = (invoice: SupplierInvoice) => {
    if (invoice.paid >= invoice.Due) {
      return { status: 'paid', text: t('admin.suppliers.invoiceStatus.paid') };
    }
    if (invoice.paid > 0) {
      return { status: 'partial', text: t('admin.suppliers.invoiceStatus.partial') };
    }
    return { status: 'unpaid', text: t('admin.suppliers.invoiceStatus.unpaid') };
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

  const actionsMenu = (invoice: SupplierInvoice) => (
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
  );

  const columns = useMemo<ColumnDef<SupplierInvoice>[]>(() => [
    {
      accessorKey: 'idInvoice',
      header: t('admin.suppliers.invoiceId'),
      cell: ({ row }) => <span className="font-medium">#{row.original.idInvoice}</span>,
    },
    {
      accessorKey: 'Due',
      header: t('admin.suppliers.due'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {formatCurrency(row.original.Due)}
        </div>
      ),
    },
    {
      accessorKey: 'paid',
      header: t('admin.suppliers.paid'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          {formatCurrency(row.original.paid)}
        </div>
      ),
    },
    {
      accessorKey: 'credit',
      header: t('admin.suppliers.credit'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-500" />
          {formatCurrency(row.original.credit)}
        </div>
      ),
    },
    {
      accessorKey: 'invoiceCreatedDate',
      header: t('admin.suppliers.date'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(row.original.invoiceCreatedDate)}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('admin.suppliers.status'),
      cell: ({ row }) => {
        const status = getInvoiceStatus(row.original);
        return (
          <Badge
            variant="outline"
            className={
              status.status === 'paid' ? 'bg-green-100 text-green-800' :
              status.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }
          >
            {status.text}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right">{t('common.actions')}</div>,
      cell: ({ row }) => <div className="text-right">{actionsMenu(row.original)}</div>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  const renderMobileRow = (invoice: SupplierInvoice) => {
    const status = getInvoiceStatus(invoice);
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">#{invoice.idInvoice}</span>
          <Badge
            variant="outline"
            className={
              status.status === 'paid' ? 'bg-green-100 text-green-800' :
              status.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }
          >
            {status.text}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {formatCurrency(invoice.Due)}
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            {formatCurrency(invoice.paid)}
          </div>
          <div className="flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-blue-500" />
            {formatCurrency(invoice.credit)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(invoice.invoiceCreatedDate)}
          </div>
          {actionsMenu(invoice)}
        </div>
      </div>
    );
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
          <TableSkeleton rows={3} columns={7} />
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={t('admin.suppliers.searchInvoices')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label={t("admin.suppliers.searchInvoicesAria")}
            />
          </div>
          <Select value={sortField} onValueChange={(v) => setSortField(v as keyof SupplierInvoice)}>
            <SelectTrigger className="w-full sm:w-44" aria-label={t('admin.suppliers.sortBy')}>
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('admin.suppliers.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="idInvoice">{t('admin.suppliers.invoiceId')}</SelectItem>
              <SelectItem value="Due">{t('admin.suppliers.due')}</SelectItem>
              <SelectItem value="paid">{t('admin.suppliers.paid')}</SelectItem>
              <SelectItem value="credit">{t('admin.suppliers.credit')}</SelectItem>
              <SelectItem value="invoiceCreatedDate">{t('admin.suppliers.date')}</SelectItem>
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

        {/* Invoices Table */}
        <DataTable
          columns={columns}
          data={paginatedInvoices}
          getRowKey={(invoice) => String(invoice.idInvoice)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t('admin.suppliers.noInvoices')}
              body={t('admin.suppliers.noInvoicesDescription')}
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
