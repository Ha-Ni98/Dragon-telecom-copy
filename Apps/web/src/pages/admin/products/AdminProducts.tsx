/**
 * Admin Products Page Component
 * Main page component that orchestrates all admin products functionality
 * Integrates statistics cards, filters, and products table
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/error-boundary';
import { AdminProductsStatsCards } from '@/pages/admin/products/components/admin-products-stats-cards';
import { AdminProductsFiltersSection } from '@/pages/admin/products/components/admin-products-filters-section';
import { AdminProductsTable } from '@/pages/admin/products/components/admin-products-table';
import { AdminProductsSupplyDialog } from '@/pages/admin/products/components/admin-products-supply-dialog';
import { useAdminProducts, useAdminProductsStats, useRefreshAdminProducts, useDeleteAdminProduct, useAddAdminProductSupply } from '@/hooks/use-admin-products';
import { AdminProductsFilters } from '@/types/draft-types/admin.types';
import { SupplyFormData } from '@/types/draft-types/admin-supply.types';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

/**
 * Admin Products Page Component
 * Integrates all admin products components with proper data flow and state management
 */
export default function AdminProducts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Filter state with comprehensive initialization
  const [filters, setFilters] = useState<AdminProductsFilters>({
    searchQuery: '',
    page: 1,
    limit: 20,
    familyId: undefined,
    brandId: undefined,
    modelId: undefined
  });

  // Supply dialog state
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
    stock: number;
  } | null>(null);

  // Data fetching hooks
  const { 
    data: productsData, 
    isLoading: productsLoading, 
    error: productsError,
    refetch: refetchProducts 
  } = useAdminProducts(filters);
  
  const { 
    data: statsData, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats 
  } = useAdminProductsStats();

  // Refresh functionality
  const { refreshAll } = useRefreshAdminProducts();

  // Delete mutation
  const deleteProductMutation = useDeleteAdminProduct();

  // Supply (add stock) mutation
  const addSupplyMutation = useAddAdminProductSupply();

  /**
   * Handle filter changes with proper state coordination
   */
  const handleFiltersChange = useCallback((newFilters: AdminProductsFilters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
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
   * Handle edit action
   */
  const handleEdit = useCallback((productId: number) => {
    navigate(`/admin/products/${productId}`);
  }, [navigate]);

  /**
   * Handle add to stock action with dialog opening
   */
  const handleAddStock = useCallback((productId: number) => {
    // Find the product in the current data
    const product = productsData?.products.find(p => p.idProduct === productId);
    if (product) {
      setSelectedProduct({
        id: product.idProduct,
        name: product.productName,
        stock: product.stockQuantity
      });
      setSupplyDialogOpen(true);
    } else {
      toast.error(t('admin.products.productNotFound'), {
        description: t('admin.products.productNotFoundDescription')
      });
    }
  }, [productsData, t]);

  /**
   * Handle delete action; success/error toasts are owned by the mutation.
   */
  const handleDelete = useCallback(async (productId: number) => {
    try {
      await deleteProductMutation.mutateAsync(productId);
    } catch {
      // Error toast is handled by useDeleteAdminProduct
    }
  }, [deleteProductMutation]);

  /**
   * Handle retry for errors
   */
  const handleRetry = useCallback(() => {
    if (productsError) refetchProducts();
    if (statsError) refetchStats();
  }, [productsError, statsError, refetchProducts, refetchStats]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  /**
   * Handle supply dialog close
   */
  const handleSupplyDialogClose = useCallback(() => {
    setSupplyDialogOpen(false);
    setSelectedProduct(null);
  }, []);

  /**
   * Handle supply save; success/error toasts are owned by the mutation.
   */
  const handleSupplySave = useCallback(async (supplyData: SupplyFormData) => {
    if (!selectedProduct) return;
    try {
      await addSupplyMutation.mutateAsync({ productId: selectedProduct.id, supply: supplyData });
      handleSupplyDialogClose();
    } catch {
      // Error toast is handled by useAddAdminProductSupply
    }
  }, [selectedProduct, addSupplyMutation, handleSupplyDialogClose]);

  /**
   * Get combined loading state with memoization
   */
  const isAnyLoading = useMemo(() => productsLoading || statsLoading, [productsLoading, statsLoading]);

  return (
    <ErrorBoundary>
      <div 
        className="space-y-6"
        role="main"
        aria-label={t('admin.products.title')}
        aria-describedby="admin-products-description"
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.products.title')}</h1>
            <p 
              id="admin-products-description"
              className="text-muted-foreground"
            >
              {t('admin.products.description')}
            </p>
          </div>
          <Button
            onClick={() => navigate('/admin/products/add')}
            className="w-full sm:w-auto"
            aria-label={t('admin.products.addProduct')}
            title={t('admin.products.addProduct')}
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('admin.products.addProduct')}
          </Button>
        </div>

        {/* Statistics Cards */}
        <AdminProductsStatsCards
          stats={statsData}
          loading={statsLoading}
          error={statsError?.message || null}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          showRefresh={false}
        />

        {/* Filters Section */}
        <AdminProductsFiltersSection
          onFiltersChange={handleFiltersChange}
          loading={isAnyLoading}
        />

        {/* Products Table */}
        <AdminProductsTable
          data={productsData}
          loading={productsLoading}
          error={productsError?.message || null}
          onRetry={handleRetry}
          onRefresh={handleRefresh}
          showRefresh={true}
          onEdit={handleEdit}
          onAddStock={handleAddStock}
          onDelete={handleDelete}
          onPageChange={handlePageChange}
        />

        {/* Supply Dialog */}
        {selectedProduct && (
          <AdminProductsSupplyDialog
            open={supplyDialogOpen}
            onClose={handleSupplyDialogClose}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            currentStock={selectedProduct.stock}
            onSave={handleSupplySave}
            loading={addSupplyMutation.isPending}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}