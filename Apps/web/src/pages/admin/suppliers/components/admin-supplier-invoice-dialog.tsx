/**
 * Admin Supplier Invoice Dialog Component
 * Provides a dialog for adding invoices to suppliers with auto-calculated financial fields
 */

import React, { memo, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Save, 
  X, 
  AlertTriangle, 
  DollarSign, 
  Calculator,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Supplier, InvoiceFormData } from '@/types/draft-types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminSupplierInvoiceDialog component
 */
interface AdminSupplierInvoiceDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when save is successful */
  onSave: (invoice: InvoiceFormData) => Promise<void>;
  /** Whether a save operation is in progress */
  loading: boolean;
  /** Supplier data for context and calculations */
  supplier: Supplier;
}

/**
 * Form validation schema
 */
const invoiceAddSchema = z.object({
  newDue: z.number()
    .min(0, 'New due amount cannot be negative')
    .max(999999, 'New due amount must be less than 999,999'),
  paid: z.number()
    .min(0, 'Paid amount cannot be negative')
    .max(999999, 'Paid amount must be less than 999,999'),
});

type InvoiceAddFormData = z.infer<typeof invoiceAddSchema>;

/**
 * Format currency value for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'DZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Main AdminSupplierInvoiceDialog component
 */
export const AdminSupplierInvoiceDialog = memo(function AdminSupplierInvoiceDialog({
  open,
  onClose,
  onSave,
  loading = false,
  supplier,
}: AdminSupplierInvoiceDialogProps) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch
  } = useForm<InvoiceAddFormData>({
    resolver: zodResolver(invoiceAddSchema),
    defaultValues: {
      newDue: 0,
      paid: 0,
    },
  });

  // Watch form values for real-time calculations
  const watchedValues = watch();
  const { newDue, paid } = watchedValues;

  // Calculate auto-calculated fields
  const [calculations, setCalculations] = useState({
    totalDue: supplier.supplierCredit + (newDue || 0),
    totalPaid: (supplier.supplierCredit + (newDue || 0)) - (supplier.supplierCredit - (paid || 0)),
    totalSold: (supplier.supplierCredit + (newDue || 0)) - (paid || 0),
    totalCredit: supplier.supplierCredit - (paid || 0),
  });

  // Update calculations when form values change
  useEffect(() => {
    const newTotalDue = supplier.supplierCredit + (newDue || 0);
    const newTotalPaid = (paid || 0);
    const newTotalSold = newTotalDue - newTotalPaid;
    const newTotalCredit = supplier.supplierCredit - newTotalPaid;

    setCalculations({
      totalDue: newTotalDue,
      totalPaid: newTotalPaid,
      totalSold: newTotalSold,
      totalCredit: newTotalCredit,
    });
  }, [newDue, paid, supplier.supplierCredit]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: InvoiceAddFormData) => {
    try {
      const invoiceData: InvoiceFormData = {
        newDue: data.newDue,
        paid: data.paid,
      };

      await onSave(invoiceData);
      reset();
    } catch (error) {
      console.error('Error saving invoice:', error);
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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('admin.suppliers.addInvoice')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.suppliers.addInvoiceDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Supplier Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                {t('admin.suppliers.supplierInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('admin.suppliers.supplierName')}
                  </Label>
                  <div className="text-sm font-medium">{supplier.supplierName}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('admin.suppliers.currentCredit')}
                  </Label>
                  <div className="text-sm font-semibold text-green-600">
                    {formatCurrency(supplier.supplierCredit)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Input Fields Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4" />
                {t('admin.suppliers.invoiceInputs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* New Due Amount */}
              <div className="space-y-2">
                <Label htmlFor="newDue" className="text-sm font-medium">
                  {t('admin.suppliers.newDue')} *
                </Label>
                <Controller
                  name="newDue"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="newDue"
                      type="number"
                      min="0"
                      max="999999"
                      step="0.01"
                      placeholder="0"
                      className={errors.newDue ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                />
                {errors.newDue && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.newDue.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin.suppliers.newDueDescription')}
                </p>
              </div>

              {/* Paid Amount */}
              <div className="space-y-2">
                <Label htmlFor="paid" className="text-sm font-medium">
                  {t('admin.suppliers.paid')} *
                </Label>
                <Controller
                  name="paid"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="paid"
                      type="number"
                      min="0"
                      max="999999"
                      step="0.01"
                      placeholder="0"
                      className={errors.paid ? 'border-destructive' : ''}
                      disabled={isSubmitting || loading}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  )}
                />
                {errors.paid && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {errors.paid.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin.suppliers.paidDescription')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Calculated Fields Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                {t('admin.suppliers.autoCalculated')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {/* Total Due */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.suppliers.totalDue')}
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-lg font-semibold text-blue-600">
                      {formatCurrency(calculations.totalDue)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.totalDueDescription')}
                  </p>
                </div>

                {/* Total Paid */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.suppliers.totalPaid')}
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-semibold text-green-600">
                      {formatCurrency(calculations.totalPaid)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.totalPaidDescription')}
                  </p>
                </div>

                {/* Total Sold */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.suppliers.totalSold')}
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <TrendingDown className="h-4 w-4 text-purple-600" />
                    <span className="text-lg font-semibold text-purple-600">
                      {formatCurrency(calculations.totalSold)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.totalSoldDescription')}
                  </p>
                </div>

                {/* Total Credit */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t('admin.suppliers.totalCredit')}
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                    <span className="text-lg font-semibold text-orange-600">
                      {formatCurrency(calculations.totalCredit)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.suppliers.totalCreditDescription')}
                  </p>
                </div>
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

export default AdminSupplierInvoiceDialog;
