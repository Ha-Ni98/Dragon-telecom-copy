import { useParams } from 'react-router-dom';
import { ErrorBoundary } from '@/components/error-boundary';
import { useTranslation } from '@/hooks/useTranslation';
import { useSupplierInformation } from '@/hooks/use-supplier-information';
import { useSupplierInformationPageState } from '@/hooks/use-supplier-information-page-state';
import { SupplierInformationHeader } from '@/pages/admin/suppliers/components/supplier-information-header';
import { SupplierDetailsSection } from '@/pages/admin/suppliers/components/supplier-details-section';
import { SupplierFinancialSummary } from '@/pages/admin/suppliers/components/supplier-financial-summary';
import { SupplierInvoicesTable } from '@/pages/admin/suppliers/components/supplier-invoices-table';
import { SupplierProductHistoryTable } from '@/pages/admin/suppliers/components/supplier-product-history-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

/**
 * Admin Supplier Information Page
 * Displays detailed information about a specific supplier including:
 * - Supplier details (editable)
 * - Financial summary (last invoice)
 * - Previous invoices table
 * - Product supply history
 */
export default function AdminSupplierInformation() {
  const { idSupplier } = useParams<{ idSupplier: string }>();
  const { t } = useTranslation();

  // Convert string ID to number
  const supplierId = idSupplier ? parseInt(idSupplier, 10) : null;

  // Handle invalid supplier ID
  if (!supplierId || isNaN(supplierId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            Invalid Supplier ID
          </h1>
          <p className="text-muted-foreground">
            The supplier ID provided is not valid.
          </p>
        </div>
      </div>
    );
  }

  // Use the new hook to fetch supplier information
  const {
    supplier,
    invoices,
    productHistory,
    isLoading,
    error,
    refresh,
    updateSupplier,
    deleteInvoice,
  } = useSupplierInformation(supplierId);

  // Use page state management hook
  const {
    isEditMode,
    isSaving,
    hasUnsavedChanges,
    formData,
    initializeFormData,
    enterEditMode,
    exitEditMode,
    saveChanges,
    cancelChanges,
  } = useSupplierInformationPageState();

  // Initialize form data when supplier data is loaded
  useEffect(() => {
    if (supplier) {
      initializeFormData(supplier);
    }
  }, [supplier, initializeFormData]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.suppliers.information.title')}</h1>
            <p className="text-muted-foreground">
              Error loading supplier data
            </p>
          </div>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load supplier information. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle supplier not found
  if (!supplier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            Supplier Not Found
          </h1>
          <p className="text-muted-foreground">
            The requested supplier could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <main className="space-y-6" role="main" aria-label={t('admin.suppliers.information.title')}>
        {/* Header with breadcrumb and actions */}
        <SupplierInformationHeader
          supplier={supplier}
          supplierId={supplierId}
          isEditMode={isEditMode}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onEditModeToggle={enterEditMode}
          onSave={() => saveChanges(updateSupplier)}
          onCancel={exitEditMode}
          onRefresh={refresh}
        />

        {/* Supplier Details Section */}
        <SupplierDetailsSection
          supplier={supplier}
          isEditMode={isEditMode}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onEditModeToggle={enterEditMode}
          onSave={updateSupplier}
          onCancel={exitEditMode}
        />

        {/* Financial Summary Section */}
        <SupplierFinancialSummary supplier={supplier} />

        {/* Invoices Table */}
        <SupplierInvoicesTable
          invoices={invoices || []}
          isLoading={isLoading}
          onDeleteInvoice={deleteInvoice}
        />

        {/* Product Supply History Table */}
        <SupplierProductHistoryTable
          productHistory={productHistory || []}
          isLoading={isLoading}
        />
      </main>
    </ErrorBoundary>
  );
}
