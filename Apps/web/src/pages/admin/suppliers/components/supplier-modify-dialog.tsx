import React from 'react';
import { Save, X, DollarSign, Package, User, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { ProductSupplierWithDetails } from '@/types/draft-types/admin-product-information.types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierModificationSchema, type SupplierModificationFormData } from './supplier-modify-dialog.schema';
import { FieldError } from "@/components/shared/FieldError";

interface SupplierModifyDialogProps {
  /** Supplier data to modify */
  supplier: ProductSupplierWithDetails;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when supplier is saved */
  onSave: (data: SupplierModificationFormData) => void;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Supplier modification dialog component
 * Allows editing of supplier unit price and quantity
 */
export function SupplierModifyDialog({
  supplier,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: SupplierModifyDialogProps) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<SupplierModificationFormData>({
    resolver: zodResolver(supplierModificationSchema),
    mode: 'onChange',
    defaultValues: {
      unitPrice: supplier.unitPrice,
      quantity: supplier.quantity,
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = (data: SupplierModificationFormData) => {
    onSave(data);
  };

  /**
   * Handle dialog close with reset
   */
  const handleClose = () => {
    reset();
    onClose();
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
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Modify Supplier Information
          </DialogTitle>
          <DialogDescription>
            {t('admin.suppliers.modifyDialog.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.suppliers.modifyDialog.supplierDetails')}</CardTitle>
              <CardDescription>{t('admin.suppliers.modifyDialog.readOnlyInfo')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('admin.suppliers.modifyDialog.supplierName')}</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{supplier.supplier.supplierName}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('admin.suppliers.modifyDialog.contactPerson')}</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{supplier.supplier.supplierPersonName}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('common.labels.phone')}</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{supplier.supplier.supplierPhone}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('common.labels.email')}</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{supplier.supplier.supplierEmail}</span>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('admin.suppliers.modifyDialog.location')}</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{supplier.supplier.supplierLocation}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.suppliers.modifyDialog.editableInfo')}</CardTitle>
              <CardDescription>{t('admin.suppliers.modifyDialog.updatePricingQty')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Unit Price */}
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice" className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Unit Price (DZ)
                    </Label>
                    <Controller
                      name="unitPrice"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1">
                          <Input
                            {...field}
                            id="unitPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={isSaving}
                            aria-describedby={errors.unitPrice ? 'unit-price-error' : undefined}
                          />
                          {errors.unitPrice && (
                            <FieldError id="unit-price-error">
                              {errors.unitPrice.message}
                            </FieldError>
                          )}
                        </div>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Current: {formatCurrency(supplier.unitPrice)}
                    </p>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Quantity
                    </Label>
                    <Controller
                      name="quantity"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-1">
                          <Input
                            {...field}
                            id="quantity"
                            type="number"
                            min="0"
                            placeholder="0"
                            disabled={isSaving}
                            aria-describedby={errors.quantity ? 'quantity-error' : undefined}
                          />
                          {errors.quantity && (
                            <FieldError id="quantity-error">{errors.quantity.message}</FieldError>
                          )}
                        </div>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Current: {supplier.quantity} units
                    </p>
                  </div>
                </div>

                {/* Supply Date (Read-only) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">{t('admin.products.suppliers.supplyDate')}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{formatDate(supplier.issueDate)}</span>
                    <Badge variant="outline">{t('common.readOnly')}</Badge>
                  </div>
                </div>

                {/* Form validation summary */}
                {!isValid && (
                  <div className="p-3 border border-destructive/20 rounded-md bg-destructive/5">
                    <FieldError>{t("admin.suppliers.formErrors")}</FieldError>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || !isValid || !isDirty}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
