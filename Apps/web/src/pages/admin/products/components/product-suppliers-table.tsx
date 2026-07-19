import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit, Trash2, Calendar, Package, DollarSign, User, Phone, Mail, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable } from '@/components/shared/DataTable';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTranslation } from '@/hooks/useTranslation';
import { useProductSuppliersManagement } from '@/hooks/use-product-suppliers';
import { ProductSupplierWithDetails } from '@/types/draft-types/admin-product-information.types';
import { SupplierModifyDialog } from '@/pages/admin/suppliers/components/supplier-modify-dialog';
import { AddSupplyButton } from './add-supply-button';

interface ProductSuppliersTableProps {
  /** Product ID to fetch suppliers for */
  productId: number;
  /** Whether the table is in edit mode */
  isEditMode: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Callback for adding new supply */
  onAddSupply?: () => void;
}

/**
 * Product suppliers table component
 * Displays and manages product suppliers with sorting and actions
 */
export function ProductSuppliersTable({
  productId,
  isEditMode,
  isSaving,
  onAddSupply,
}: ProductSuppliersTableProps) {
  const { t } = useTranslation();
  const [selectedSupplier, setSelectedSupplier] = useState<ProductSupplierWithDetails | null>(null);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);

  // Fetch suppliers using the hook
  const {
    suppliers,
    isLoading,
    error,
    isUpdating,
    isDeleting,
    updateSupplier,
    deleteSupplier,
    refresh,
    retry,
  } = useProductSuppliersManagement(productId);

  /**
   * Handle supplier modification
   */
  const handleModifySupplier = (supplier: ProductSupplierWithDetails) => {
    setSelectedSupplier(supplier);
    setShowModifyDialog(true);
  };

  /**
   * Handle supplier deletion
   */
  const handleDeleteSupplier = async (supplierId: number) => {
    await deleteSupplier(supplierId);
    setShowDeleteDialog(null);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Format currency for display
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Get stock status badge variant
   */
  const getStockStatusVariant = (quantity: number) => {
    if (quantity === 0) return 'destructive';
    if (quantity < 10) return 'secondary';
    return 'default';
  };

  /**
   * Get stock status text
   */
  const getStockStatusText = (quantity: number) => {
    if (quantity === 0) return t('admin.products.outOfStock');
    if (quantity < 10) return t('admin.products.lowStock');
    return t('admin.products.inStock');
  };

  const columns = useMemo<ColumnDef<ProductSupplierWithDetails>[]>(() => {
    const base: ColumnDef<ProductSupplierWithDetails>[] = [
      {
        id: 'supplier',
        header: t('admin.products.suppliers.supplier'),
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">{row.original.supplier.supplierName}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {row.original.supplier.supplierLocation}
            </div>
          </div>
        ),
      },
      {
        id: 'contact',
        header: t('admin.products.suppliers.contact'),
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="text-sm flex items-center gap-1">
              <User className="h-3 w-3" />
              {row.original.supplier.supplierPersonName}
            </div>
            <div className="text-sm flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.original.supplier.supplierPhone}
            </div>
            <div className="text-sm flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {row.original.supplier.supplierEmail}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'unitPrice',
        header: t('admin.productInfo.unitPrice'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span className="font-mono">{formatCurrency(row.original.unitPrice)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'quantity',
        header: t('admin.products.pricingSummary.quantity'),
        cell: ({ row }) => (
          <div className="text-center">
            <div className="font-medium">{row.original.quantity}</div>
            <Badge variant={getStockStatusVariant(row.original.quantity)} className="text-xs">
              {getStockStatusText(row.original.quantity)}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'issueDate',
        header: t('admin.products.suppliers.supplyDate'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className="text-sm">{formatDate(row.original.issueDate)}</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('common.labels.status'),
        cell: () => <Badge variant="outline">{t('common.status.active')}</Badge>,
      },
    ];

    if (isEditMode) {
      base.push({
        id: 'actions',
        header: () => <div className="text-right">{t('common.actions.action')}</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleModifySupplier(row.original)}
              disabled={isUpdating || isDeleting}
              aria-label={t('admin.products.suppliers.modifyAria', { name: row.original.supplier.supplierName })}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteDialog(row.original.idProductSupplier)}
              disabled={isUpdating || isDeleting}
              aria-label={t('admin.products.suppliers.deleteAria', { name: row.original.supplier.supplierName })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      });
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, isEditMode, isUpdating, isDeleting]);

  const renderMobileRow = (supplier: ProductSupplierWithDetails) => (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{supplier.supplier.supplierName}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {supplier.supplier.supplierLocation}
          </div>
        </div>
        <Badge variant={getStockStatusVariant(supplier.quantity)} className="text-xs">
          {getStockStatusText(supplier.quantity)}
        </Badge>
      </div>
      <div className="text-sm flex items-center gap-1">
        <Phone className="h-3 w-3" />
        {supplier.supplier.supplierPhone}
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          <span className="font-mono">{formatCurrency(supplier.unitPrice)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(supplier.issueDate)}</span>
        </div>
      </div>
      {isEditMode && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleModifySupplier(supplier)}
            disabled={isUpdating || isDeleting}
            aria-label={t('admin.products.suppliers.modifyAria', { name: supplier.supplier.supplierName })}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowDeleteDialog(supplier.idProductSupplier)}
            disabled={isUpdating || isDeleting}
            aria-label={t('admin.products.suppliers.deleteAria', { name: supplier.supplier.supplierName })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.productInfo.suppliers')}
          </CardTitle>
          <CardDescription>{t('admin.products.suppliers.loading')}</CardDescription>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={3} columns={6} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.productInfo.suppliers')}
          </CardTitle>
          <CardDescription>{t('admin.products.suppliers.loadError')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-center mt-4">
            <Button onClick={retry} variant="outline">
              {t('common.actions.tryAgain')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" id="suppliers-heading">
              <Package className="h-5 w-5" aria-hidden="true" />
              {t('admin.productInfo.suppliers')}
            </CardTitle>
            <CardDescription>
              {t('admin.products.suppliers.countForProduct', { count: suppliers.length })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <AddSupplyButton
              productId={productId}
              isEditMode={isEditMode}
              isSaving={isSaving || isUpdating || isDeleting}
              onAddSupply={onAddSupply || (() => {})}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isUpdating || isDeleting}
              aria-label={t('admin.products.suppliers.refreshAria')}
            >
              {t('common.actions.refresh')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="region" aria-labelledby="suppliers-heading">
          <DataTable
            columns={columns}
            data={suppliers}
            getRowKey={(supplier) => String(supplier.idProductSupplier)}
            renderMobileRow={renderMobileRow}
            emptyState={
              <EmptyState
                icon={<Package className="h-6 w-6" />}
                title={t('admin.products.suppliers.noneConfigured')}
                body={t('admin.products.suppliers.noneConfiguredBody')}
              />
            }
          />

          {/* Error displays */}
          {(isUpdating || isDeleting) && (
            <Alert>
              <AlertDescription>
                {isUpdating ? t('admin.products.suppliers.updating') : t('admin.products.suppliers.deleting')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Supplier Modify Dialog */}
        {selectedSupplier && (
          <SupplierModifyDialog
            supplier={selectedSupplier}
            isOpen={showModifyDialog}
            onClose={() => {
              setShowModifyDialog(false);
              setSelectedSupplier(null);
            }}
            onSave={async (updates) => {
              await updateSupplier(selectedSupplier.idProductSupplier, updates);
              setShowModifyDialog(false);
              setSelectedSupplier(null);
            }}
            isSaving={isUpdating}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.products.suppliers.confirmDeletion')}</DialogTitle>
              <DialogDescription>
                {t('admin.products.suppliers.confirmDeletionBody')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(null)}
                disabled={isDeleting}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => showDeleteDialog && handleDeleteSupplier(showDeleteDialog)}
                disabled={isDeleting}
              >
                {isDeleting ? t('admin.products.suppliers.deletingButton') : t('admin.suppliers.table.delete')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
