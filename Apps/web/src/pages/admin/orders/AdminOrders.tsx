/**
 * Admin Orders Page
 * Complete orders management with statistics, table, and dialogs
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { AdminOrdersStatsCards } from '@/pages/admin/orders/components/admin-orders-stats-cards';
import { AdminOrdersTable } from '@/pages/admin/orders/components/admin-orders-table';
import { AdminOrderShowDialog } from '@/pages/admin/orders/components/admin-order-show-dialog';
import { AdminOrderEditDialog } from '@/pages/admin/orders/components/admin-order-edit-dialog';
import { ErrorBoundary } from '@/components/error-boundary';
import { AdminOrderWithDetails } from '@/types/draft-types/order.types';
import { OrderStatusCode } from '@/types/draft-types/enums.types';
import { 
  getMockAdminOrdersPaginated, 
  calculateAdminOrdersStats
} from '@/mocks/orders';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

// Error fallback components
const StatisticsErrorFallback = ({ retry }: { retry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="text-red-800 font-medium">{t('admin.orders.errors.statisticsTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.orders.errors.statisticsBody')}
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
      <h3 className="text-red-800 font-medium">{t('admin.orders.errors.tableTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.orders.errors.tableBody')}
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

const DialogErrorFallback = ({ retry }: { retry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="text-red-800 font-medium">{t('admin.orders.errors.dialogTitle')}</h3>
      <p className="text-red-600 text-sm mt-1">
        {t('admin.orders.errors.dialogBody')}
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

const AdminOrders = memo(function AdminOrders() {
  const { t } = useTranslation();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatusCode | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderWithDetails | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data state
  const [data, setData] = useState<{
    orders: AdminOrderWithDetails[];
    total: number;
    totalPages: number;
  } | undefined>(undefined);
  
  const [stats, setStats] = useState<{
    totalOrdersThisMonth: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveryOrders: number;
  } | undefined>(undefined);

  // Debounced search term for performance
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // Load data function
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get orders data
      const ordersResult = getMockAdminOrdersPaginated(
        currentPage,
        14,
        debouncedSearchTerm || undefined,
        statusFilter !== 'all' ? statusFilter : undefined
      );
      
      // Get statistics
      const statsResult = calculateAdminOrdersStats();
      
      setData(ordersResult);
      setStats(statsResult);
    } catch (err) {
      setError('Failed to load orders data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, statusFilter]);

  // Load data on mount and when dependencies change
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle search change
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((status: OrderStatusCode | 'all') => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle show order
  const handleShowOrder = useCallback((order: AdminOrderWithDetails) => {
    setSelectedOrder(order);
    setShowDialog(true);
  }, []);

  // Handle edit order
  const handleEditOrder = useCallback((order: AdminOrderWithDetails) => {
    setSelectedOrder(order);
    setEditDialog(true);
  }, []);

  // Handle close dialogs
  const handleCloseDialogs = useCallback(() => {
    setShowDialog(false);
    setEditDialog(false);
    setSelectedOrder(null);
  }, []);

  // Handle save order
  const handleSaveOrder = useCallback(async (orderData: Partial<AdminOrderWithDetails>) => {
    setIsSaving(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Saving order:', selectedOrder?.orderCode, orderData);
      
      // In a real app, this would call the API
      // await ordersService.updateOrder(selectedOrder.idOrder, orderData);
      
      // Close dialog and refresh data
      handleCloseDialogs();
      await loadData();
    } catch (error) {
      console.error('Failed to save order:', error);
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setIsSaving(false);
    }
  }, [selectedOrder, handleCloseDialogs, loadData]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    setError(null);
    await loadData();
  }, [loadData]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Memoized statistics data for stats cards
  const statsData = useMemo(() => {
    if (!stats) return undefined;
    
    return {
      totalOrdersThisMonth: stats.totalOrdersThisMonth,
      pendingOrders: stats.pendingOrders,
      confirmedOrders: stats.confirmedOrders,
      deliveryOrders: stats.deliveryOrders
    };
  }, [stats]);

  // Memoized table props for performance
  const tableProps = useMemo(() => ({
    data,
    loading,
    error,
    onRetry: handleRetry,
    onRefresh: handleRefresh,
    showRefresh: true,
    searchTerm,
    onSearchChange: handleSearchChange,
    statusFilter,
    onStatusFilterChange: handleStatusFilterChange,
    currentPage,
    onPageChange: handlePageChange,
    onShowOrder: handleShowOrder,
    onEditOrder: handleEditOrder
  }), [
    data,
    loading,
    error,
    handleRetry,
    handleRefresh,
    searchTerm,
    handleSearchChange,
    statusFilter,
    handleStatusFilterChange,
    currentPage,
    handlePageChange,
    handleShowOrder,
    handleEditOrder
  ]);

  // Memoized stats cards props for performance
  const statsCardsProps = useMemo(() => ({
    stats: statsData,
    loading,
    error,
    onRetry: handleRetry,
    onRefresh: handleRefresh,
    showRefresh: true
  }), [statsData, loading, error, handleRetry, handleRefresh]);

  return (
    <div className="space-y-6" role="main" aria-labelledby="page-title">
      {/* Page Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 id="page-title" className="text-3xl font-bold">{t('admin.orders.title')}</h1>
          <p className="text-muted-foreground">{t('admin.orders.description')}</p>
        </div>
      </header>

      {/* Statistics Cards */}
      <ErrorBoundary fallback={<StatisticsErrorFallback retry={() => window.location.reload()} />}>
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">{t('admin.orders.statisticsHeading')}</h2>
          <AdminOrdersStatsCards {...statsCardsProps} />
        </section>
      </ErrorBoundary>

      {/* Orders Table */}
      <ErrorBoundary fallback={<TableErrorFallback retry={() => window.location.reload()} />}>
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="sr-only">{t('admin.orders.managementHeading')}</h2>
          <AdminOrdersTable {...tableProps} />
        </section>
      </ErrorBoundary>

      {/* Show Dialog */}
      {selectedOrder && (
        <ErrorBoundary fallback={<DialogErrorFallback retry={() => window.location.reload()} />}>
          <AdminOrderShowDialog
            order={selectedOrder}
            isOpen={showDialog}
            onClose={handleCloseDialogs}
          />
        </ErrorBoundary>
      )}

      {/* Edit Dialog */}
      {selectedOrder && (
        <ErrorBoundary fallback={<DialogErrorFallback retry={() => window.location.reload()} />}>
          <AdminOrderEditDialog
            order={selectedOrder}
            isOpen={editDialog}
            onClose={handleCloseDialogs}
            onSave={handleSaveOrder}
            isSaving={isSaving}
          />
        </ErrorBoundary>
      )}
    </div>
  );
});

export default AdminOrders;