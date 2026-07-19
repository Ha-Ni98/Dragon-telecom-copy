import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ProductInformationHeader } from '@/pages/admin/products/components/product-information-header';
import { ProductDetailsSection } from '@/pages/admin/products/components/product-details-section';
import { EnhancedPricingSection } from '@/pages/admin/products/components/enhanced-pricing-section';
import { PricingHistorySection } from '@/pages/admin/products/components/pricing-history-section';
import { ProductImagesSection } from '@/pages/admin/products/components/product-images-section';
import { ProductSuppliersTable } from '@/pages/admin/products/components/product-suppliers-table';
import { useTranslation } from '@/hooks/useTranslation';
import { useProductInformationPageState } from '@/hooks/use-admin-product-information';
import { useProductPricing } from '@/hooks/use-product-pricing';
import { ProductInformationFormData } from '@/types/draft-types/admin-product-information.types';
import { toast } from 'sonner';

/**
 * Admin Product Information Page
 * Displays comprehensive product information with edit capabilities
 */
export default function AdminProductInformation() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Convert productId from string to number
  const productIdNumber = productId ? parseInt(productId, 10) : 0;
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<ProductInformationFormData | null>(null);
  const [pricingData, setPricingData] = useState<Record<string, number> | null>(null);
  
  // Fetch product information using our custom hook
  const {
    product,
    isLoading,
    error,
    isUpdating,
    updateProduct,
    retry,
  } = useProductInformationPageState(productIdNumber);

  // Pricing management hook
  const { updatePricing, isUpdating: isPricingUpdating } = useProductPricing(productIdNumber);

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    navigate('/admin/products');
  };

  /**
   * Handle edit mode toggle
   */
  const handleToggleEdit = () => {
    setIsEditMode(!isEditMode);
  };

  /**
   * Handle save changes
   */
  const handleSave = useCallback(async () => {
    if (!formData) return;

    try {
      // Update product information
      await updateProduct(formData);
      
      // Update pricing if changed
      if (pricingData) {
        const categoryPrices = Object.entries(pricingData).map(([categoryId, price]) => ({
          idCategory: parseInt(categoryId),
          price: Number(price),
        }));
        await updatePricing({ categoryPrices });
      }
      
      setIsEditMode(false);
      setFormData(null);
      setPricingData(null);
      
      toast.success(t('admin.productInfo.updateSuccess'));
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error(t('admin.productInfo.updateError'));
    }
  }, [formData, pricingData, updateProduct, updatePricing, t]);

  /**
   * Handle cancel changes
   */
  const handleCancel = useCallback(() => {
    setIsEditMode(false);
    setFormData(null);
    setPricingData(null);
    toast.info(t('admin.productInfo.changesCancelled'));
  }, [t]);

  /**
   * Handle form data changes
   */
  const handleFormChange = useCallback((data: ProductInformationFormData) => {
    setFormData(data);
  }, []);

  /**
   * Handle pricing data changes
   */
  const handlePricingChange = useCallback((data: Record<string, number>) => {
    setPricingData(data);
  }, []);

  /**
   * Handle form submission
   */
  const handleFormSubmit = useCallback((data: ProductInformationFormData) => {
    setFormData(data);
  }, []);

  /**
   * Handle pricing submission
   */
  const handlePricingSubmit = useCallback((data: Record<string, number>) => {
    setPricingData(data);
  }, []);

  /**
   * Handle bulk pricing updates
   */
  const handleBulkPricingUpdate = useCallback(async (updates: { noUserPrice?: number; categoryPrices?: Record<number, number> }) => {
    try {
      if (updates.noUserPrice !== undefined) {
        await updatePricing({ noUserPrice: updates.noUserPrice });
      }
      
      if (updates.categoryPrices) {
        const categoryPrices = Object.entries(updates.categoryPrices).map(([categoryId, price]) => ({
          idCategory: parseInt(categoryId),
          price: Number(price),
        }));
        await updatePricing({ categoryPrices });
      }
    } catch (error) {
      console.error('Failed to update bulk pricing:', error);
    }
  }, [updatePricing]);

  /**
   * Handle add supply action
   */
  const handleAddSupply = useCallback(() => {
    // Navigate to add supply page or open modal
    navigate(`/admin/products/${productId}/add-supply`);
  }, [navigate, productId]);

  // Loading state
  if (isLoading) {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Page Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Content Skeleton */}
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{t('admin.productInfo.title')}</h1>
                <p className="text-muted-foreground">{t('admin.productInfo.error')}</p>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>

          {/* Retry Button */}
          <div className="flex justify-center">
            <Button onClick={retry} variant="outline">
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // No product found
  if (!product) {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{t('admin.productInfo.title')}</h1>
                <p className="text-muted-foreground">Product not found</p>
              </div>
            </div>
          </div>

          {/* Not Found Alert */}
          <Alert>
            <Package className="h-4 w-4" />
            <AlertDescription>
              The requested product could not be found. Please check the product ID and try again.
            </AlertDescription>
          </Alert>
        </div>
      </ErrorBoundary>
    );
  }

  // Main content
  return (
    <ErrorBoundary>
      <main className="space-y-6" role="main" aria-label="Product Information">
        {/* Page Header */}
        <ProductInformationHeader
          productName={product.productName}
          productCodeBar={product.productCodeBar}
          isEditMode={isEditMode}
          isSaving={isUpdating || isPricingUpdating}
          onBack={handleBack}
          onToggleEdit={handleToggleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />

        {/* Product Information Content */}
        <section className="grid gap-6" aria-label="Product Information Sections">
          {/* Product Details Section */}
          <ProductDetailsSection
            product={product}
            isEditMode={isEditMode}
            isSaving={isUpdating}
            onFormChange={handleFormChange}
            onFormSubmit={handleFormSubmit}
          />

          {/* Product Images Section */}
          <ProductImagesSection
            product={product}
            isEditMode={isEditMode}
            isSaving={isUpdating || isPricingUpdating}
          />

          {/* Enhanced Product Pricing Section */}
          <EnhancedPricingSection
            product={product}
            isEditMode={isEditMode}
            isSaving={isPricingUpdating}
            onPricingChange={(data) => handlePricingChange(data as unknown as Record<string, number>)}
            onPricingSubmit={(data) => handlePricingSubmit(data as unknown as Record<string, number>)}
            onBulkPricingUpdate={handleBulkPricingUpdate}
          />

          {/* Pricing History Section */}
          {/* <PricingHistorySection
            productId={product.idProduct}
            showDetailed={false}
          /> */}

              {/* Product Suppliers Table */}
              <ProductSuppliersTable
                productId={product.idProduct}
                isEditMode={isEditMode}
                isSaving={isUpdating || isPricingUpdating}
                onAddSupply={handleAddSupply}
              />

          {/* Stock Information Card */}
          <Card>
            <CardHeader>
              <CardTitle id="stock-info-heading">Stock Information</CardTitle>
              <CardDescription>
                Current stock levels and supplier information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3" role="region" aria-labelledby="stock-info-heading">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Current Stock
                  </label>
                  <p className="text-2xl font-bold" aria-label={`Current stock: ${product.stockQuantity} units`}>{product.stockQuantity}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <p className="text-sm capitalize">{product.status.replace('_', ' ')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Unit Price
                  </label>
                  <p className="text-sm">{product.suppliers?.[0]?.unitPrice || 0} DZ</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Placeholder for future sections
          <Card>
            <CardHeader>
              <CardTitle id="additional-sections-heading">Additional Sections</CardTitle>
              <CardDescription>
                Image management, pricing, and supplier sections will be added in upcoming sprints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground" role="region" aria-labelledby="additional-sections-heading">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                <p>Additional product management features coming soon...</p>
              </div>
            </CardContent>
          </Card> */}
        </section>
      </main>
    </ErrorBoundary>
  );
}
