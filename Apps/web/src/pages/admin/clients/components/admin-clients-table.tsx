/**
 * Admin Clients Table Component
 * Displays clients in a data table with search, filtering, and pagination
 */

import React, { memo, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { 
  Users, 
  RefreshCw, 
  AlertTriangle, 
  Edit, 
  Phone, 
  Mail, 
  Calendar,
  DollarSign,
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
 * Loading state component
 */
function ClientsTableLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
 * Empty state component
 */
function ClientsEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12">
      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">{t('admin.clients.table.noClientsFound')}</h3>
      <p className="text-muted-foreground">
        {t('admin.clients.table.noClientsDescription')}
      </p>
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

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('admin.clients.table.title')}
              </CardTitle>
              <CardDescription>{t('admin.clients.table.description')}</CardDescription>
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
        </CardHeader>
        <CardContent>
          {/* Desktop loading */}
          <div className="hidden lg:block">
            <ClientsTableLoading />
          </div>
          {/* Mobile loading */}
          <div className="lg:hidden space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('admin.clients.table.title')}
              </CardTitle>
              <CardDescription>{t('admin.clients.table.description')}</CardDescription>
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
          <ClientsTableError error={error} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (clients.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('admin.clients.table.title')}
              </CardTitle>
              <CardDescription>{t('admin.clients.table.description')}</CardDescription>
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
          <ClientsEmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients Management
            </CardTitle>
            <CardDescription>
              {pagination ? `${pagination.totalItems} clients found` : 'Manage your customer database'}
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
              <span>Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">{t('admin.clients.table.name')}</TableHead>
                <TableHead className="min-w-[150px]">{t('admin.clients.table.contact')}</TableHead>
                <TableHead className="min-w-[80px] text-center">{t('admin.clients.table.orders')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.clients.table.credit')}</TableHead>
                <TableHead className="min-w-[100px]">{t('admin.clients.table.status')}</TableHead>
                <TableHead className="min-w-[120px]">{t('admin.clients.table.createdDate')}</TableHead>
                <TableHead className="min-w-[80px] text-center">{t('admin.clients.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formattedClients.map((client) => (
                <TableRow key={client.idClient} role="row">
                  <TableCell className="font-medium max-w-[150px]" role="cell">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm leading-tight">{client.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {client.idClient}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[150px]" role="cell">
                    <div className="space-y-1">
                      {client.clientEmail && (
                        <div className="flex items-start gap-1 text-xs">
                          <Mail className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{client.clientEmail}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-1 text-xs">
                        <Phone className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{client.clientPhoneNumber}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center max-w-[80px]" role="cell">
                    <span className="font-semibold text-sm">{client.totalOrders}</span>
                  </TableCell>
                  <TableCell className="max-w-[100px]" role="cell">
                    <div className="flex items-start gap-1">
                      <CreditCard className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className={`font-semibold text-sm break-words ${client.clientCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(client.clientCredit)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[100px]" role="cell">
                    <Badge 
                      variant={getStatusBadgeVariant(client.displayStatus)}
                      className={`${getStatusBadgeColor(client.displayStatus)} text-xs`}
                      aria-label={`Status: ${client.displayStatus}`}
                    >
                      {client.displayStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[120px]" role="cell">
                    <div className="flex items-start gap-1">
                      <Calendar className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className="text-xs break-words" aria-label={`Created date: ${client.formattedDate}`}>
                        {client.formattedDate}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center max-w-[80px]" role="cell">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(client.idClient)}
                      aria-label={`Edit client ${client.fullName}`}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {formattedClients.map((client) => (
            <Card key={client.idClient} className="p-4">
              <div className="space-y-3">
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
            </Card>
          ))}
        </div>
        
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
