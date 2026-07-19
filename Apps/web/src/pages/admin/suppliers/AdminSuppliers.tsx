/**
 * Admin Suppliers Page
 * 
 * Main page for managing suppliers with comprehensive functionality:
 * - Statistics dashboard with key metrics
 * - Suppliers table with search, pagination, and actions
 * - Add supplier dialog with form validation
 * - Add invoice dialog with auto-calculations
 * - Full CRUD operations with error handling
 * - Responsive design for all screen sizes
 * - Internationalization support (EN/FR)
 * - Accessibility features (ARIA labels, keyboard navigation)
 * 
 * @component
 * @example
 * ```tsx
 * <AdminSuppliers />
 * ```
 */

import { useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AdminSuppliersStatsCards } from '@/pages/admin/suppliers/components/admin-suppliers-stats-cards';
import { AdminSuppliersTable } from '@/pages/admin/suppliers/components/admin-suppliers-table';
import { AdminSupplierAddDialog } from '@/pages/admin/suppliers/components/admin-supplier-add-dialog';
import { AdminSupplierInvoiceDialog } from '@/pages/admin/suppliers/components/admin-supplier-invoice-dialog';
import { AdminSuppliersPageHeader } from '@/pages/admin/suppliers/components/admin-suppliers-page-header';
import { 
  useAdminSuppliers, 
  useAdminSuppliersStats, 
  useCreateSupplier, 
  useDeleteSupplier, 
  useAddInvoice,
  useRefreshSuppliers 
} from '@/hooks/use-admin-suppliers';
import { 
  AdminSuppliersFilters, 
  SupplierFormData, 
  InvoiceFormData,
  AdminSuppliersStats
} from '@/types/draft-types/admin-suppliers.types';
import { Supplier } from '@/types/draft-types/supplier.types';
import { useTranslation } from '@/hooks/useTranslation';
import { ErrorBoundary } from '@/components/error-boundary';
import { useErrorBoundary } from '@/components/error-boundary';

/**
 * Main AdminSuppliers page component
 */
const AdminSuppliers = memo(function AdminSuppliers() {
  const { t } = useTranslation();
  const { captureError } = useErrorBoundary();
  const navigate = useNavigate();
  
  // State for dialogs and selected supplier
  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Debounced search query for better performance
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  
  // Filters for data fetching - memoized for performance
  const filters: AdminSuppliersFilters = useMemo(() => ({
    searchQuery: debouncedSearchQuery,
    page: currentPage,
    limit: 10,
  }), [debouncedSearchQuery, currentPage]);
  
  // Data fetching hooks
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminSuppliersStats();
  
  const {
    data: suppliersData,
    isLoading: suppliersLoading,
    error: suppliersError,
    refetch: refetchSuppliers,
  } = useAdminSuppliers(filters);
  
  // CRUD operation hooks
  const createSupplierMutation = useCreateSupplier();
  
  const deleteSupplierMutation = useDeleteSupplier();
  
  const addInvoiceMutation = useAddInvoice();
  
  // Refresh function
  const refreshSuppliers = useRefreshSuppliers();
  
  /**
   * Handle add supplier button click
   * Opens the add supplier dialog
   */
  const handleAddSupplier = useCallback(() => {
    setIsAddSupplierDialogOpen(true);
  }, []);
  
  /**
   * Handle add supplier dialog close
   */
  const handleAddSupplierClose = useCallback(() => {
    setIsAddSupplierDialogOpen(false);
  }, []);
  
  /**
   * Handle add supplier save
   * Creates a new supplier and closes the dialog
   * @param supplierData - The supplier form data
   */
  const handleAddSupplierSave = useCallback(async (supplierData: SupplierFormData) => {
    try {
      await createSupplierMutation.mutateAsync(supplierData);
      setIsAddSupplierDialogOpen(false);
    } catch (error) {
      console.error('Error creating supplier:', error);
      captureError(error as Error);
    }
  }, [createSupplierMutation, captureError]);
  
  /**
   * Handle edit supplier action
   */
  const handleEditSupplier = useCallback((supplierId: number) => {
    navigate(`/admin/suppliers/${supplierId}`);
  }, [navigate]);
  
  /**
   * Handle add invoice action
   */
  const handleAddInvoice = useCallback((supplierId: number) => {
    const supplier = suppliersData?.suppliers.find((s: any) => s.idSupplier === supplierId);
    if (supplier) {
      setSelectedSupplier(supplier);
      setIsInvoiceDialogOpen(true);
    }
  }, [suppliersData?.suppliers]);
  
  /**
   * Handle add invoice dialog close
   */
  const handleInvoiceDialogClose = useCallback(() => {
    setIsInvoiceDialogOpen(false);
    setSelectedSupplier(null);
  }, []);
  
  /**
   * Handle add invoice save
   */
  const handleAddInvoiceSave = useCallback(async (invoiceData: InvoiceFormData) => {
    if (!selectedSupplier) return;
    
    try {
      await addInvoiceMutation.mutateAsync({
        supplierId: selectedSupplier.idSupplier,
        data: invoiceData,
      });
      setIsInvoiceDialogOpen(false);
      setSelectedSupplier(null);
    } catch (error) {
      console.error('Error adding invoice:', error);
      captureError(error as Error);
    }
  }, [selectedSupplier, addInvoiceMutation, captureError]);
  
  /**
   * Handle delete supplier action
   */
  const handleDeleteSupplier = useCallback(async (supplierId: number) => {
    if (window.confirm(t('admin.suppliers.deleteConfirm'))) {
      try {
        await deleteSupplierMutation.mutateAsync(supplierId);
      } catch (error) {
        console.error('Error deleting supplier:', error);
        captureError(error as Error);
      }
    }
  }, [deleteSupplierMutation, t, captureError]);
  
  /**
   * Handle page change
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  /**
   * Handle search change
   */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  }, []);
  
  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    refreshSuppliers();
  }, [refreshSuppliers]);
  
  /**
   * Handle retry for errors
   */
  const handleRetry = useCallback(() => {
    refetchStats();
    refetchSuppliers();
  }, [refetchStats, refetchSuppliers]);
  
  // Determine if there are any errors
  const hasError = statsError || suppliersError || createSupplierMutation.error || deleteSupplierMutation.error || addInvoiceMutation.error;
  const errorMessage = statsError?.message || suppliersError?.message || createSupplierMutation.error?.message || deleteSupplierMutation.error?.message || addInvoiceMutation.error?.message;

  return (
    <div className="w-full h-full min-h-screen">
      {/* Error Boundary for the entire page */}
      <ErrorBoundary>
        <div 
          className="w-full h-full min-h-screen p-4 space-y-6"
          role="main"
          aria-label={t('admin.clients.title')}
          aria-describedby="admin-clients-description"
        >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.suppliers.stats.title')}</h1>
            <p 
              id="admin-clients-description"
              className="text-muted-foreground"
            >
               {t('admin.suppliers.stats.description')}
            </p>
          </div>
        </div>


        {/* Statistics Cards */}
        <div className="w-full">
        <AdminSuppliersStatsCards
          stats={statsData as AdminSuppliersStats | undefined}
          loading={statsLoading}
          error={statsError?.message || null}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          showRefresh={false}
        />
        </div>
        {/* Error Alert */}
        {hasError && (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              {errorMessage}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="ml-4"
                aria-label={t('common.retry')}
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Suppliers Table */}
        <AdminSuppliersTable
          data={suppliersData}
          loading={suppliersLoading}
          error={suppliersError?.message || null}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          showRefresh={true}
          onEdit={handleEditSupplier}
          onAddInvoice={handleAddInvoice}
          onDelete={handleDeleteSupplier}
          onPageChange={handlePageChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />
        
        {/* Add Supplier Dialog */}
        <AdminSupplierAddDialog
          open={isAddSupplierDialogOpen}
          onClose={handleAddSupplierClose}
          onSave={handleAddSupplierSave}
          loading={createSupplierMutation.isPending}
        />
        
        {/* Add Invoice Dialog */}
        {selectedSupplier && (
          <AdminSupplierInvoiceDialog
            open={isInvoiceDialogOpen}
            onClose={handleInvoiceDialogClose}
            onSave={handleAddInvoiceSave}
            loading={addInvoiceMutation.isPending}
            supplier={selectedSupplier}
          />
        )}
            </div>
    </ErrorBoundary>
    </div>
  );
});

export default AdminSuppliers;