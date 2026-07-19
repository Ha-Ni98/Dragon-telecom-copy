/**
 * Admin Clients Table Component
 * Displays clients in a data table with search, filtering, and pagination
 */

import { memo, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { SimplePagination } from '@/components/shared/SimplePagination';
import {
  Users,
  RefreshCw,
  AlertTriangle,
  Edit,
  Phone,
  Mail,
  Calendar,
  CreditCard
} from 'lucide-react';
import { AdminClientWithDetails, PaginationInfo } from '@/types/draft-types/client.types';
import { useTranslation } from '@/hooks/useTranslation';
import { formatAdminDate } from '@/lib/date-utils';

/**
 * Props for AdminClientsTable component
 */
interface AdminClientsTableProps {
  /** Paginated clients data */
  data?: {
    clients: AdminClientWithDetails[];
    pagination: PaginationInfo;
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
  /** Callback when edit button is clicked */
  onEdit: (clientId: number) => void;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Custom className for styling */
  className?: string;
}

type FormattedClient = AdminClientWithDetails & { formattedDate: string };

/**
 * Get status badge variant and color
 */
function getStatusBadgeVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'disabled':
      return 'destructive';
    case 'refused':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get status badge color
 */
function getStatusBadgeColor(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'disabled':
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    case 'refused':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Error state component
 */
function ClientsTableError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/**
 * Main AdminClientsTable component
 */
export const AdminClientsTable = memo(function AdminClientsTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onEdit,
  onPageChange,
  className = '',
}: AdminClientsTableProps) {
  const { t, language } = useTranslation();

  // Extract clients and pagination from data
  const clients = data?.clients || [];
  const pagination = data?.pagination;

  // Memoize formatted clients to avoid recalculation on every render
  const formattedClients = useMemo(() => {
    return clients.map(client => ({
      ...client,
      formattedDate: formatAdminDate(client.clientCreatedDate, language as 'en' | 'fr'),
    }));
  }, [clients, language]);

  const columns = useMemo<ColumnDef<FormattedClient>[]>(() => [
    {
      accessorKey: 'fullName',
      header: t('admin.clients.table.name'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-semibold text-sm leading-tight">{row.original.fullName}</div>
          <div className="text-xs text-muted-foreground">ID: {row.original.idClient}</div>
        </div>
      ),
    },
    {
      id: 'contact',
      header: t('admin.clients.table.contact'),
      cell: ({ row }) => (
        <div className="space-y-1">
          {row.original.clientEmail && (
            <div className="flex items-start gap-1 text-xs">
              <Mail className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span className="break-words">{row.original.clientEmail}</span>
            </div>
          )}
          <div className="flex items-start gap-1 text-xs">
            <Phone className="h-3 w-3 flex-shrink-0 mt-0.5" />
            <span className="break-words">{row.original.clientPhoneNumber}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: () => <div className="text-center">{t('admin.clients.table.orders')}</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-semibold text-sm">{row.original.totalOrders}</span>
        </div>
      ),
    },
    {
      accessorKey: 'clientCredit',
      header: t('admin.clients.table.credit'),
      cell: ({ row }) => (
        <div className="flex items-start gap-1">
          <CreditCard className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className={`font-semibold text-sm break-words ${row.original.clientCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(row.original.clientCredit)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'displayStatus',
      header: t('admin.clients.table.status'),
      cell: ({ row }) => (
        <Badge
          variant={getStatusBadgeVariant(row.original.displayStatus)}
          className={`${getStatusBadgeColor(row.original.displayStatus)} text-xs`}
          aria-label={t('admin.clients.table.statusAria', { status: row.original.displayStatus })}
        >
          {row.original.displayStatus}
        </Badge>
      ),
    },
    {
      accessorKey: 'formattedDate',
      header: t('admin.clients.table.createdDate'),
      cell: ({ row }) => (
        <div className="flex items-start gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span className="text-xs break-words" aria-label={t('admin.clients.table.createdDateAria', { date: row.original.formattedDate })}>
            {row.original.formattedDate}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-center">{t('admin.clients.table.actions')}</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(row.original.idClient)}
            aria-label={t('admin.clients.table.editAria', { name: row.original.fullName })}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, onEdit]);

  const renderMobileRow = (client: FormattedClient) => (
    <div className="p-4 space-y-3">
      {/* Header with name and status */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{client.fullName}</h3>
          <p className="text-sm text-muted-foreground">ID: {client.idClient}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={getStatusBadgeVariant(client.displayStatus)}
            className={`${getStatusBadgeColor(client.displayStatus)} text-xs`}
          >
            {client.displayStatus}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(client.idClient)}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4" />
          <span>{client.clientPhoneNumber}</span>
        </div>
        {client.clientEmail && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" />
            <span className="break-words">{client.clientEmail}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 pt-2 border-t">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t('admin.clients.table.orders')}</p>
          <p className="font-semibold">{client.totalOrders}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t('admin.clients.table.credit')}</p>
          <p className={`font-semibold ${client.clientCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(client.clientCredit)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t('admin.clients.table.created')}</p>
          <p className="text-xs">{client.formattedDate}</p>
        </div>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t('admin.clients.table.title')}
        </CardTitle>
        <CardDescription>
          {pagination ? t('admin.clients.table.itemsFound', { count: pagination.totalItems }) : t('admin.clients.table.description')}
        </CardDescription>
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
          <TableSkeleton rows={5} columns={7} />
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
          <ClientsTableError error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={formattedClients}
          getRowKey={(client) => String(client.idClient)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={t('admin.clients.table.noClientsFound')}
              body={t('admin.clients.table.noClientsDescription')}
            />
          }
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t mt-4 pt-4">
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
