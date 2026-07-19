/**
 * Admin Logs Page
 * 
 * Main page for viewing system logs with comprehensive functionality:
 * - Logs table with search, filtering, and pagination
 * - Filter controls for User, Action Type, and Date Range
 * - Statistics cards showing log metrics
 * - Full error handling and loading states
 * - Responsive design for all screen sizes
 * - Internationalization support (EN/FR)
 * - Accessibility features (ARIA labels, keyboard navigation)
 * 
 * @component
 * @example
 * ```tsx
 * <AdminLogs />
 * ```
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorBoundary } from '@/components/error-boundary';
import { AdminLogsTable } from '@/pages/admin/logs/components/admin-logs-table';
import { AdminLogsFilters } from '@/pages/admin/logs/components/admin-logs-filters';
import { AdminLogsStatsCards } from '@/pages/admin/logs/components/admin-logs-stats-cards';
import { 
  useAdminLogs, 
  useAdminLogsStats, 
  useRefreshAdminLogs 
} from '@/hooks/use-admin-logs';
import { AdminLogsFilters as AdminLogsFiltersType } from '@/types/draft-types/logs.types';

/**
 * Error fallback components
 */
const StatisticsErrorFallback = ({ retry }: { retry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="text-red-800 font-medium">{t('admin.logs.errors.statisticsTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.logs.errors.statisticsBody')}
      </p>
      <button
        onClick={retry}
        className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
      >
        {t('common.actions.tryAgain')}
      </button>
    </div>
  );
};

const TableErrorFallback = ({ retry }: { retry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="text-red-800 font-medium">{t('admin.logs.errors.tableTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.logs.errors.tableBody')}
      </p>
      <button
        onClick={retry}
        className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
      >
        {t('common.actions.tryAgain')}
      </button>
    </div>
  );
};

const FiltersErrorFallback = ({ retry }: { retry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="text-red-800 font-medium">{t('admin.logs.errors.filtersTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.logs.errors.filtersBody')}
      </p>
      <button
        onClick={retry}
        className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
      >
        {t('common.actions.tryAgain')}
      </button>
    </div>
  );
};

/**
 * Main AdminLogs page component
 */
const AdminLogs = memo(function AdminLogs() {
  const { t } = useTranslation();
  
  // Filter state with comprehensive initialization
  const [filters, setFilters] = useState<AdminLogsFiltersType>({
    searchQuery: '',
    page: 1,
    limit: 20,
    userId: undefined,
    actionType: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  });

  // Data fetching hooks
  const { 
    data: logsData, 
    isLoading: logsLoading, 
    error: logsError,
    refetch: refetchLogs 
  } = useAdminLogs(filters);
  
  const { 
    data: statsData, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useAdminLogsStats();

  // Refresh functionality
  const { refreshAll } = useRefreshAdminLogs();

  /**
   * Handle filter changes with proper state coordination
   */
  const handleFiltersChange = useCallback((newFilters: AdminLogsFiltersType) => {
    console.log('AdminLogs: Received filter changes:', newFilters);
    setFilters(prevFilters => {
      const updatedFilters = {
        ...prevFilters,
        ...newFilters,
        page: 1 // Reset to first page when filters change
      };
      
      // Log filter changes for debugging
      console.log('AdminLogs: Filters updated:', updatedFilters);
      
      return updatedFilters;
    });
  }, []);

  /**
   * Handle page changes
   */
  const handlePageChange = useCallback((page: number) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      page
    }));
  }, []);

  /**
   * Handle retry for error states
   */
  const handleRetry = useCallback(() => {
    refetchLogs();
    refetchStats();
  }, [refetchLogs, refetchStats]);

  /**
   * Handle refresh for the entire page
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refreshAll();
    } catch (error) {
      console.error('Error refreshing admin logs:', error);
    }
  }, [refreshAll]);

  /**
   * Memoized loading state
   */
  const isAnyLoading = useMemo(() => {
    return logsLoading || statsLoading;
  }, [logsLoading, statsLoading]);

  /**
   * Memoized error state
   */
  const hasError = useMemo(() => {
    return logsError || statsError;
  }, [logsError, statsError]);

  /**
   * Memoized props for components to prevent unnecessary re-renders
   */
  const statsCardsProps = useMemo(() => ({
    stats: statsData,
    loading: statsLoading,
    error: statsError?.message || null,
    onRetry: handleRetry,
    onRefresh: handleRefresh,
    showRefresh: true
  }), [statsData, statsLoading, statsError, handleRetry, handleRefresh]);

  const tableProps = useMemo(() => ({
    data: logsData,
    loading: logsLoading,
    error: logsError?.message || null,
    onRetry: handleRetry,
    onRefresh: handleRefresh,
    showRefresh: true,
    onPageChange: handlePageChange
  }), [logsData, logsLoading, logsError, handleRetry, handleRefresh, handlePageChange]);

  const filtersProps = useMemo(() => ({
    onFiltersChange: handleFiltersChange,
    loading: isAnyLoading
  }), [handleFiltersChange, isAnyLoading]);

  return (
    <div className="w-full h-full">
      {/* Error Boundary for the entire page */}
      <ErrorBoundary>
        <div
          className="w-full h-full space-y-6"
          role="main"
          aria-label={t('admin.logs.title')}
          aria-describedby="admin-logs-description"
        >
          {/* Page Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t('admin.logs.title')}</h1>
              <p 
                id="admin-logs-description"
                className="text-muted-foreground"
              >
                {t('admin.logs.description')}
              </p>
            </div>
          </header>

          {/* Statistics Cards */}
          <ErrorBoundary fallback={<StatisticsErrorFallback retry={handleRetry} />}>
            <section aria-labelledby="stats-heading">
              <h2 id="stats-heading" className="sr-only">{t('admin.logs.statisticsHeading')}</h2>
              <AdminLogsStatsCards {...statsCardsProps} />
            </section>
          </ErrorBoundary>

          {/* Filters Section */}
          <ErrorBoundary fallback={<FiltersErrorFallback retry={handleRetry} />}>
            <section aria-labelledby="filters-heading">
              <h2 id="filters-heading" className="sr-only">{t('admin.logs.filtersHeading')}</h2>
              <AdminLogsFilters {...filtersProps} />
            </section>
          </ErrorBoundary>

          {/* Logs Table */}
          <ErrorBoundary fallback={<TableErrorFallback retry={handleRetry} />}>
            <section aria-labelledby="logs-heading">
              <h2 id="logs-heading" className="sr-only">{t('admin.logs.tableHeading')}</h2>
              <AdminLogsTable {...tableProps} />
            </section>
          </ErrorBoundary>
              </div>
      </ErrorBoundary>
    </div>
  );
});

export default AdminLogs;