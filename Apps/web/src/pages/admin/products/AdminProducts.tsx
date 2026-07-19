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
import { useAdminProducts, useAdminProductsStats, useRefreshAdminProducts, useDeleteAdminProduct } from '@/hooks/use-admin-products';
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

  /**
   * Handle filter changes with proper state coordination
   */
  const handleFiltersChange = useCallback((newFilters: AdminProductsFilters) => {
    console.log('AdminProducts: Received filter changes:', newFilters);
    setFilters(prevFilters => {
      const updatedFilters = {
        ...prevFilters,
        ...newFilters,
        page: 1 // Reset to first page when filters change
      };
      
      // Log filter changes for debugging
      console.log('AdminProducts: Filters updated:', updatedFilters);
      
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
   * Handle edit action with navigation feedback
   */
  const handleEdit = useCallback((productId: number) => {
    console.log('Navigating to edit product:', productId);
    toast.info(t('admin.products.edit'), {
      description: `Opening product editor...`,
      duration: 2000
    });
    navigate(`/admin/products/${productId}`);
  }, [navigate, t]);

  /**
   * Handle add to stock action with dialog opening
   */
  const handleAddStock = useCallback((productId: number) => {
    console.log('Opening supply dialog for product:', productId);
    
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
   * Handle delete action with confirmation and success/error messages
   */
  const handleDelete = useCallback(async (productId: number) => {
    try {
      console.log('Deleting product:', productId);
      
      // Show loading toast
      const loadingToast = toast.loading(t('admin.products.processing'), {
        description: t('admin.products.deleteConfirm')
      });

      // Execute delete mutation
      await deleteProductMutation.mutateAsync(productId);

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Show success message
      toast.success(t('admin.products.deleteSuccess'), {
        description: t('admin.products.deleteSuccessDescription'),
        duration: 5000
      });

      console.log('Product deleted successfully:', productId);
    } catch (error) {
      console.error('Failed to delete product:', error);
      
      // Show error message
      toast.error(t('admin.products.deleteError'), {
        description: t('admin.products.deleteErrorDescription'),
        duration: 8000,
        action: {
          label: t('common.retry'),
          onClick: () => handleDelete(productId)
        }
      });
    }
  }, [deleteProductMutation, t]);

  /**
   * Handle retry for errors with improved coordination and user feedback
   */
  const handleRetry = useCallback(() => {
    console.log('Retrying data fetch...');
    
    // Show retry feedback
    toast.info(t('common.retrying'), {
      description: t('admin.products.retryDescription'),
      duration: 3000
    });
    
    let retryCount = 0;
    
    if (productsError) {
      console.log('Retrying products data...');
      refetchProducts();
      retryCount++;
    }
    if (statsError) {
      console.log('Retrying stats data...');
      refetchStats();
      retryCount++;
    }
    
    // Show success feedback if retry was initiated
    if (retryCount > 0) {
      setTimeout(() => {
        toast.success(t('common.retrySuccess'), {
          description: t('admin.products.retrySuccessDescription'),
          duration: 2000
        });
      }, 1000);
    }
  }, [productsError, statsError, refetchProducts, refetchStats, t]);

  /**
   * Handle refresh with proper coordination and user feedback
   */
  const handleRefresh = useCallback(() => {
    console.log('Refreshing all data...');
    
    // Show refresh feedback
    toast.info(t('common.refreshing'), {
      description: t('admin.products.refreshDescription'),
      duration: 2000
    });
    
    refreshAll();
    
    // Show success feedback after refresh
    setTimeout(() => {
      toast.success(t('common.refreshSuccess'), {
        description: t('admin.products.refreshSuccessDescription'),
        duration: 3000
      });
    }, 1500);
  }, [refreshAll, t]);

  /**
   * Handle supply dialog close
   */
  const handleSupplyDialogClose = useCallback(() => {
    setSupplyDialogOpen(false);
    setSelectedProduct(null);
  }, []);

  /**
   * Handle supply save with success/error feedback
   */
  const handleSupplySave = useCallback(async (supplyData: SupplyFormData) => {
    try {
      console.log('Saving supply for product:', selectedProduct?.id, supplyData);
      
      // Show loading toast
      const loadingToast = toast.loading(t('admin.supply.processing'), {
        description: t('admin.supply.processingDescription')
      });

      // TODO: Implement actual supply save logic here
      // This would typically call an API to save the supply
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Show success message
      toast.success(t('admin.supply.success'), {
        description: t('admin.supply.successDescription'),
        duration: 5000
      });

      // Close dialog and refresh data
      handleSupplyDialogClose();
      refreshAll();

      console.log('Supply saved successfully');
    } catch (error) {
      console.error('Failed to save supply:', error);
      
      // Show error message
      toast.error(t('admin.supply.error'), {
        description: t('admin.supply.errorDescription'),
        duration: 8000,
        action: {
          label: t('common.retry'),
          onClick: () => handleSupplySave(supplyData)
        }
      });
    }
  }, [selectedProduct, t, handleSupplyDialogClose, refreshAll]);

  /**
   * Get combined loading state with memoization
   */
  const isAnyLoading = useMemo(() => productsLoading || statsLoading, [productsLoading, statsLoading]);

  /**
   * Get combined error state with memoization
   */
  const hasAnyError = useMemo(() => productsError || statsError, [productsError, statsError]);
  
  /**
   * Get loading state details for better UX
   */
  const loadingState = useMemo(() => ({
    isProductsLoading: productsLoading,
    isStatsLoading: statsLoading,
    isAnyLoading: isAnyLoading,
    hasProductsError: !!productsError,
    hasStatsError: !!statsError,
    hasAnyError: hasAnyError
  }), [productsLoading, statsLoading, isAnyLoading, productsError, statsError, hasAnyError]);

  // Log error state for debugging
  if (hasAnyError) {
    console.log('Error detected:', { productsError, statsError });
  }

  // Log loading state for debugging
  if (loadingState.isAnyLoading) {
    console.log('Loading state:', loadingState);
  }

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
            onClick={() => {
              console.log('Navigating to add product page');
              toast.info(t('admin.products.addProduct'), {
                description: `Opening product creation form...`,
                duration: 2000
              });
              navigate('/admin/products/add');
            }}
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
            loading={false}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}