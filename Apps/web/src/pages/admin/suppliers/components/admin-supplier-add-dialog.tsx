/**
 * Admin Supplier Add Dialog Component
 * Provides a dialog for adding new suppliers with form validation
 */

import React, { memo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierAddSchema, type SupplierAddFormData } from './admin-supplier-add-dialog.schema';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Truck, 
  Save, 
  X, 
  AlertTriangle, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { SupplierFormData } from '@/types/draft-types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminSupplierAddDialog component
 */
interface AdminSupplierAddDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when save is successful */
  onSave: (supplier: SupplierFormData) => Promise<void>;
  /** Whether a save operation is in progress */
  loading: boolean;
}

/**
 * Main AdminSupplierAddDialog component
 */
export const AdminSupplierAddDialog = memo(function AdminSupplierAddDialog({
  open,
  onClose,
  onSave,
  loading = false,
}: AdminSupplierAddDialogProps) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch
  } = useForm<SupplierAddFormData>({
    resolver: zodResolver(supplierAddSchema),
    defaultValues: {
      supplierName: '',
      supplierPersonName: '',
      supplierPhone: '',
      supplierEmail: '',
      supplierLocation: '',
      supplierCredit: 0,
    },
  });

  // Watch form values for real-time validation feedback
  const watchedValues = watch();

  /**
   * Handle form submission
   */
  const onSubmit = async (data: SupplierAddFormData) => {
    try {
      // Clean up empty strings to undefined
      const cleanedData: SupplierFormData = {
        supplierName: data.supplierName,
        supplierPersonName: data.supplierPersonName || undefined,
        supplierPhone: data.supplierPhone || undefined,
        supplierEmail: data.supplierEmail || undefined,
        supplierLocation: data.supplierLocation || undefined,
        supplierCredit: data.supplierCredit,
      };

      await onSave(cleanedData);
      reset();
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!isSubmitting && !loading) {
      reset();
      onClose();
    }
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    if (!isSubmitting && !loading) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t('admin.suppliers.addSupplier')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.suppliers.addSupplierDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                {t('admin.suppliers.basicInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Supplier Name */}
              <div className="space-y-2">
                <Label htmlFor="supplierName" className="text-sm font-medium">
                  {t('admin.suppliers.supplierName')} *
                </Label>
                <Controller
                  name="supplierName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierName"
                      placeholder={t('admin.suppliers.supplierNamePlaceholder')}
                      className={errors.supplierName ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                    />
                  )}
                />
                {errors.supplierName && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierName.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Contact Person Name */}
              <div className="space-y-2">
                <Label htmlFor="supplierPersonName" className="text-sm font-medium">
                  {t('admin.suppliers.personName')}
                </Label>
                <Controller
                  name="supplierPersonName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierPersonName"
                      placeholder={t('admin.suppliers.personNamePlaceholder')}
                      className={errors.supplierPersonName ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                    />
                  )}
                />
                {errors.supplierPersonName && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierPersonName.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4" />
                {t('admin.suppliers.contactInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="supplierPhone" className="text-sm font-medium">
                  {t('admin.suppliers.phone')}
                </Label>
                <Controller
                  name="supplierPhone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierPhone"
                      placeholder={t('admin.suppliers.phonePlaceholder')}
                      className={errors.supplierPhone ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                    />
                  )}
                />
                {errors.supplierPhone && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierPhone.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="supplierEmail" className="text-sm font-medium">
                  {t('admin.suppliers.email')}
                </Label>
                <Controller
                  name="supplierEmail"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierEmail"
                      type="email"
                      placeholder={t('admin.suppliers.emailPlaceholder')}
                      className={errors.supplierEmail ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                    />
                  )}
                />
                {errors.supplierEmail && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierEmail.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="supplierLocation" className="text-sm font-medium">
                  {t('admin.suppliers.location')}
                </Label>
                <Controller
                  name="supplierLocation"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierLocation"
                      placeholder={t('admin.suppliers.locationPlaceholder')}
                      className={errors.supplierLocation ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                    />
                  )}
                />
                {errors.supplierLocation && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierLocation.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                {t('admin.suppliers.financialInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Credit */}
              <div className="space-y-2">
                <Label htmlFor="supplierCredit" className="text-sm font-medium">
                  {t('admin.suppliers.credit')}
                </Label>
                <Controller
                  name="supplierCredit"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="supplierCredit"
                      type="number"
                      min="0"
                      max="999999"
                      step="0.01"
                      placeholder="0"
                      className={errors.supplierCredit ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                />
                {errors.supplierCredit && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.supplierCredit.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin.suppliers.creditDescription')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || loading}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loading}
              className="flex items-center gap-2"
            >
              {isSubmitting || loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t('common.save')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});

export default AdminSupplierAddDialog;
