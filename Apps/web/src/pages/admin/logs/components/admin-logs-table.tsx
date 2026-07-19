/**
 * Admin Logs Table Component
 * Displays system logs in a data table with all required columns and states
 */

import { memo, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimplePagination } from '@/components/shared/SimplePagination';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  FileText,
  RefreshCw,
  AlertTriangle,
  User,
  Calendar,
  Activity,
  MessageSquare
} from 'lucide-react';
import { AdminLogWithDetails, AdminLogsPaginatedResponse } from '@/types/draft-types/logs.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminLogsTable component
 */
interface AdminLogsTableProps {
  /** Paginated logs data */
  data?: AdminLogsPaginatedResponse;
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
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Custom className for styling */
  className?: string;
}

/**
 * Get action type badge variant and color
 */
const getActionTypeBadgeVariant = (actionType: string) => {
  switch (actionType.toLowerCase()) {
    case 'modify client status':
      return 'default';
    case 'modify order status':
      return 'secondary';
    case 'add product':
      return 'outline';
    case 'add supplier product':
      return 'outline';
    case 'add invoice':
      return 'destructive';
    default:
      return 'secondary';
  }
};

/**
 * Error state component
 */
function LogsErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{t('admin.logs.title')}</span>
            </CardTitle>
            <CardDescription>{t('admin.logs.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="ml-2"
              >
                {t('common.retry')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

/**
 * Main Admin Logs Table Component
 */
export const AdminLogsTable = memo(function AdminLogsTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  showRefresh = true,
  onPageChange,
  className = '',
}: AdminLogsTableProps) {
  const { t } = useTranslation();

  // Extract logs and pagination from data
  const logs = data?.logs || [];
  const pagination = data;

  const columns = useMemo<ColumnDef<AdminLogWithDetails>[]>(() => [
    {
      id: 'user',
      header: () => (
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4" aria-hidden="true" />
          <span>{t('admin.logs.user')}</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center" aria-hidden="true">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium text-sm">{row.original.user.userName}</div>
            <div className="text-xs text-muted-foreground">ID: {row.original.user.idUser}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'actionTypeLabel',
      header: () => (
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4" aria-hidden="true" />
          <span>{t('admin.logs.actionType')}</span>
        </div>
      ),
      cell: ({ row }) => (
        <Badge
          variant={getActionTypeBadgeVariant(row.original.actionTypeLabel)}
          aria-label={t('admin.logs.actionTypeAria', { type: row.original.actionTypeLabel })}
        >
          {row.original.actionTypeLabel}
        </Badge>
      ),
    },
    {
      accessorKey: 'actionDetails',
      header: () => (
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span>{t('admin.logs.actionDescription')}</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="max-w-[400px]">
          <p
            className="text-sm text-foreground line-clamp-2"
            aria-label={t('admin.logs.actionDescriptionAria', { description: row.original.actionDetails })}
          >
            {row.original.actionDetails}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'formattedDate',
      header: () => (
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{t('admin.logs.dateTime')}</span>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          <time
            dateTime={row.original.logCreatedDate}
            aria-label={t('admin.logs.dateTimeAria', { date: row.original.formattedDate })}
          >
            {row.original.formattedDate}
          </time>
        </div>
      ),
    },
  ], [t]);

  const renderMobileRow = (log: AdminLogWithDetails) => (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium text-sm">{log.user.userName}</div>
            <div className="text-xs text-muted-foreground">ID: {log.user.idUser}</div>
          </div>
        </div>
        <Badge variant={getActionTypeBadgeVariant(log.actionTypeLabel)}>{log.actionTypeLabel}</Badge>
      </div>
      <p className="text-sm text-foreground line-clamp-2">{log.actionDetails}</p>
      <time dateTime={log.logCreatedDate} className="text-xs text-muted-foreground">
        {log.formattedDate}
      </time>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>{t('admin.logs.title')}</span>
        </CardTitle>
        <CardDescription>
          {pagination ? `${t('admin.logs.description')} • ${pagination.total || 0} ${t('admin.logs.totalLogs')}` : t('admin.logs.description')}
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
          <TableSkeleton rows={5} columns={4} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return <LogsErrorState error={error} onRetry={onRetry} />;
  }

  return (
    <Card className={className}>
      <CardHeader>{header}</CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={logs}
          getRowKey={(log) => String(log.idLog)}
          renderMobileRow={renderMobileRow}
          emptyState={
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t('admin.logs.empty.title')}
              body={t('admin.logs.empty.description')}
            />
          }
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6">
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
