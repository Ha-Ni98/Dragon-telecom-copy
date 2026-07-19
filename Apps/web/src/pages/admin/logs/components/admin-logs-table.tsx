/**
 * Admin Logs Table Component
 * Displays system logs in a data table with all required columns and states
 */

import React, { memo, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SimplePagination } from '@/components/shared/SimplePagination';
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
 * Loading skeleton for table rows
 */
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
    </TableRow>
  );
}

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
 * Empty state component
 */
function LogsEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-4 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{t('admin.logs.empty.title')}</h3>
      <p className="text-muted-foreground mb-4">{t('admin.logs.empty.description')}</p>
    </div>
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

  // Memoize formatted logs to avoid recalculation on every render
  const formattedLogs = useMemo(() => {
    return logs.map(log => ({
      ...log,
      // Logs already come with formatted date from mock data
    }));
  }, [logs]);

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{t('admin.logs.title')}</span>
              </CardTitle>
              <CardDescription>{t('admin.logs.description')}</CardDescription>
            </div>
            {showRefresh && onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center space-x-2"
                disabled
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('common.refresh')}</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table role="table" aria-label={t('admin.logs.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]" scope="col">{t('admin.logs.user')}</TableHead>
                  <TableHead className="w-[150px]" scope="col">{t('admin.logs.actionType')}</TableHead>
                  <TableHead className="min-w-[300px]" scope="col">{t('admin.logs.actionDescription')}</TableHead>
                  <TableHead className="w-[180px]" scope="col">{t('admin.logs.dateTime')}</TableHead>
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
    return <LogsErrorState error={error} onRetry={onRetry} />;
  }

  // Empty state
  if (!logs || logs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{t('admin.logs.title')}</span>
              </CardTitle>
              <CardDescription>{t('admin.logs.description')}</CardDescription>
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
          <LogsEmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{t('admin.logs.title')}</span>
            </CardTitle>
            <CardDescription>
              {t('admin.logs.description')} • {pagination?.total || 0} {t('admin.logs.totalLogs')}
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
          <Table role="table" aria-label={t('admin.logs.title')}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]" scope="col">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" aria-hidden="true" />
                    <span>{t('admin.logs.user')}</span>
                  </div>
                </TableHead>
                <TableHead className="w-[150px]" scope="col">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                    <span>{t('admin.logs.actionType')}</span>
                  </div>
                </TableHead>
                <TableHead className="min-w-[300px]" scope="col">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    <span>{t('admin.logs.actionDescription')}</span>
                  </div>
                </TableHead>
                <TableHead className="w-[180px]" scope="col">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    <span>{t('admin.logs.dateTime')}</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formattedLogs.map((log) => (
                <TableRow key={log.idLog} className="hover:bg-muted/50" role="row">
                  <TableCell className="font-medium" role="cell">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{log.user.userName}</div>
                        <div className="text-xs text-muted-foreground">ID: {log.user.idUser}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell role="cell">
                    <Badge variant={getActionTypeBadgeVariant(log.actionTypeLabel)} aria-label={`Action type: ${log.actionTypeLabel}`}>
                      {log.actionTypeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell role="cell">
                    <div className="max-w-[400px]">
                      <p className="text-sm text-foreground line-clamp-2" aria-label={`Action description: ${log.actionDetails}`}>
                        {log.actionDetails}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell role="cell">
                    <div className="text-sm text-muted-foreground">
                      <time dateTime={log.logCreatedDate} aria-label={`Date and time: ${log.formattedDate}`}>
                        {log.formattedDate}
                      </time>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
