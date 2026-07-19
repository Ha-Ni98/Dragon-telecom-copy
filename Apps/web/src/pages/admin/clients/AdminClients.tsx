/**
 * Admin Clients Page
 * Main page for managing clients with statistics, search, filters, and modification
 */

import { useState, useCallback, useMemo, memo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { AdminClientsStatsCards } from '@/pages/admin/clients/components/admin-clients-stats-cards';
import { AdminClientsFilters } from '@/pages/admin/clients/components/admin-clients-filters';
import { AdminClientsTable } from '@/pages/admin/clients/components/admin-clients-table';
import { AdminClientModifyDialog } from '@/pages/admin/clients/components/admin-client-modify-dialog';
import { useAdminClientsStats } from '@/hooks/use-admin-clients-stats';
import { useAdminClients } from '@/hooks/use-admin-clients';
import { useAdminClientsSearch } from '@/hooks/use-admin-clients-search';
import { useModifyClient } from '@/hooks/use-modify-client';
import { AdminClientWithDetails, ClientModificationData } from '@/types/draft-types/client.types';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorBoundary } from '@/components/error-boundary';

/**
 * Main AdminClients page component
 */
const AdminClients = memo(function AdminClients() {
  const { t } = useTranslation();
  
  // State for selected client and dialog
  const [selectedClient, setSelectedClient] = useState<AdminClientWithDetails | null>(null);
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false);
  
  // Search and filter management
  const {
    filters,
    apiFilters,
    hasActiveFilters,
    filterSummary,
    setSearchQuery,
    setStatus,
    setPage,
    clearFilters,
  } = useAdminClientsSearch();
  
  // Data fetching hooks
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminClientsStats();
  
  const {
    data: clientsData,
    isLoading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = useAdminClients(apiFilters);
  
  // Client modification hook
  const {
    modifyClientAsync,
    isModifying,
    error: modifyError,
    isSuccess: modifySuccess,
  } = useModifyClient();
  
  /**
   * Handle client edit action
   */
  const handleEditClient = useCallback((clientId: number) => {
    const client = clientsData?.clients.find(c => c.idClient === clientId);
    if (client) {
      setSelectedClient(client);
      setIsModifyDialogOpen(true);
    }
  }, [clientsData?.clients]);
  
  /**
   * Handle client modification save
   */
  const handleSaveClient = useCallback(async (updates: ClientModificationData) => {
    if (!selectedClient) return;
    
    try {
      await modifyClientAsync({ clientId: selectedClient.idClient, updates });
      setIsModifyDialogOpen(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error saving client modifications:', error);
    }
  }, [selectedClient, modifyClientAsync]);
  
  /**
   * Handle dialog close
   */
  const handleCloseDialog = useCallback(() => {
    setIsModifyDialogOpen(false);
    setSelectedClient(null);
  }, []);
  
  /**
   * Handle page refresh
   */
  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchClients();
  }, [refetchStats, refetchClients]);
  
  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    setPage(page);
  }, [setPage]);
  
  /**
   * Memoized error state
   */
  const hasError = useMemo(() => {
    return statsError || clientsError || modifyError;
  }, [statsError, clientsError, modifyError]);
  
  
  return (
    <div className="w-full h-full">
      {/* Error Boundary for the entire page */}
      <ErrorBoundary>
        <div
          className="w-full h-full space-y-6"
          role="main"
          aria-label={t('admin.clients.title')}
          aria-describedby="admin-clients-description"
        >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.clients.title')}</h1>
            <p 
              id="admin-clients-description"
              className="text-muted-foreground"
            >
              {t('admin.clients.description')}
            </p>
          </div>
          {/* <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('common.refresh')}
            </Button>
          </div> */}
        </div>
        {/* Statistics Cards */}
        <div className="w-full">
          <AdminClientsStatsCards 
            stats={statsData}
            loading={statsLoading}
            error={statsError?.message || null}
            onRetry={refetchStats}
            onRefresh={handleRefresh}
            showRefresh={false}
          />
        </div>
        
        
        {/* Search and Filters */}
        <div className="w-full">
          <AdminClientsFilters
            searchQuery={filters.searchQuery}
            onSearchChange={setSearchQuery}
            selectedStatus={filters.status}
            onStatusChange={setStatus}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            filterSummary={filterSummary}
            loading={clientsLoading}
          />
        </div>
       
        
        {/* Clients Table */}
        <div className="w-full">
          <AdminClientsTable
            data={clientsData}
            loading={clientsLoading}
            error={clientsError?.message || null}
            onRetry={refetchClients}
            onRefresh={handleRefresh}
            onEdit={handleEditClient}
            onPageChange={handlePageChange}
            showRefresh={true}
          />
        </div>
       
        
        {/* Global Error Display */}
        {hasError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {statsError && t('admin.clients.errorLoadingStats') + '. '}
              {clientsError && t('admin.clients.errorLoadingClients') + '. '}
              {modifyError && t('admin.clients.modifyError') + '. '}
              {t('admin.clients.helpText')}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Success Message */}
        {modifySuccess && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              {t('admin.clients.modifySuccessDescription')}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Client Modification Dialog */}
        {selectedClient && (
          <AdminClientModifyDialog
            client={selectedClient}
            isOpen={isModifyDialogOpen}
            onClose={handleCloseDialog}
            onSave={handleSaveClient}
            isSaving={isModifying}
          />
        )}
        </div>
      </ErrorBoundary>
    </div>
  );
});

export default AdminClients;