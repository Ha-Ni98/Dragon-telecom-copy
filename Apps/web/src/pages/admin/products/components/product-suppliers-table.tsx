import React, { useState } from 'react';
import { Edit, Trash2, Calendar, Package, DollarSign, User, Phone, Mail, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    if (quantity === 0) return 'Out of Stock';
    if (quantity < 10) return 'Low Stock';
    return 'In Stock';
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('admin.productInfo.suppliers')}
          </CardTitle>
          <CardDescription>Loading supplier information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
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
          <CardDescription>Failed to load supplier information</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-center mt-4">
            <Button onClick={retry} variant="outline">
              Try Again
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
              {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} for this product
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
              aria-label="Refresh supplier data"
            >
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="region" aria-labelledby="suppliers-heading">
          {suppliers.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Supply Date</TableHead>
                    <TableHead>Status</TableHead>
                    {isEditMode && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.idProductSupplier}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{supplier.supplier.supplierName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {supplier.supplier.supplierLocation}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {supplier.supplier.supplierPersonName}
                          </div>
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.supplier.supplierPhone}
                          </div>
                          <div className="text-sm flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {supplier.supplier.supplierEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-mono">{formatCurrency(supplier.unitPrice)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="font-medium">{supplier.quantity}</div>
                          <Badge variant={getStockStatusVariant(supplier.quantity)} className="text-xs">
                            {getStockStatusText(supplier.quantity)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-sm">{formatDate(supplier.issueDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Active</Badge>
                      </TableCell>
                      {isEditMode && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleModifySupplier(supplier)}
                              disabled={isUpdating || isDeleting}
                              aria-label={`Modify supplier ${supplier.supplier.supplierName}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setShowDeleteDialog(supplier.idProductSupplier)}
                              disabled={isUpdating || isDeleting}
                              aria-label={`Delete supplier ${supplier.supplier.supplierName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Empty state */
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No suppliers configured</p>
              <p className="text-sm">
                This product doesn't have any suppliers configured yet.
              </p>
            </div>
          )}

          {/* Error displays */}
          {(isUpdating || isDeleting) && (
            <Alert>
              <AlertDescription>
                {isUpdating ? 'Updating supplier...' : 'Deleting supplier...'}
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
              <DialogTitle>Confirm Supplier Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this supplier? This action cannot be undone and will affect the product's stock quantity.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => showDeleteDialog && handleDeleteSupplier(showDeleteDialog)}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Supplier'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
