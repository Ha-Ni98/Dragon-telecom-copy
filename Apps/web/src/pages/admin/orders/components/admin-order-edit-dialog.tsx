/**
 * Admin Order Edit Dialog Component
 * Order editing dialog with status management and form validation
 */

import React, { memo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  DollarSign,
  Loader2
} from 'lucide-react';
import { AdminOrderWithDetails } from '@/types/draft-types/order.types';
import { OrderStatusCode } from '@/types/draft-types/enums.types';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDZD } from '@/lib/utils';

interface AdminOrderEditDialogProps {
  /** Order data */
  order: AdminOrderWithDetails;
  /** Dialog open state */
  isOpen: boolean;
  /** Close dialog handler */
  onClose: () => void;
  /** Save order handler */
  onSave: (orderData: Partial<AdminOrderWithDetails>) => Promise<void>;
  /** Saving state */
  isSaving: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Form data interface for order editing
 */
interface OrderEditFormData {
  orderStatus: OrderStatusCode;
  pricePaid: number;
  orderGrandTotal: number;
}

/**
 * Get status options for dropdown
 */
function getStatusOptions() {
  return [
    { value: OrderStatusCode.pending, label: 'Pending' },
    { value: OrderStatusCode.confirmed, label: 'Confirmed' },
    { value: OrderStatusCode.delivery, label: 'In Delivery' },
    { value: OrderStatusCode.completed, label: 'Completed' },
    { value: OrderStatusCode.canceled, label: 'Canceled' }
  ];
}

/**
 * Get status label
 */
function getStatusLabel(status: OrderStatusCode): string {
  const options = getStatusOptions();
  return options.find(option => option.value === status)?.label || 'Unknown';
}

/**
 * Validate form data
 */
function validateFormData(data: OrderEditFormData, originalOrder: AdminOrderWithDetails): string[] {
  const errors: string[] = [];

  // Validate total amount
  if (data.orderGrandTotal <= 0) {
    errors.push('Total amount must be greater than 0');
  }

  // Validate paid price for completed orders
  if (data.orderStatus === OrderStatusCode.completed) {
    if (data.pricePaid <= 0) {
      errors.push('Paid price is required for completed orders');
    }
    if (data.pricePaid > data.orderGrandTotal) {
      errors.push('Paid price cannot exceed total amount');
    }
  }

  // Validate status change logic
  if (originalOrder.orderStatus === OrderStatusCode.completed && data.orderStatus !== OrderStatusCode.completed) {
    errors.push('Cannot change status from completed to another status');
  }

  if (originalOrder.orderStatus === OrderStatusCode.canceled && data.orderStatus !== OrderStatusCode.canceled) {
    errors.push('Cannot change status from canceled to another status');
  }

  return errors;
}

/**
 * Main AdminOrderEditDialog component
 */
export const AdminOrderEditDialog = memo(function AdminOrderEditDialog({
  order,
  isOpen,
  onClose,
  onSave,
  isSaving,
  className = ''
}: AdminOrderEditDialogProps) {
  const { t } = useTranslation();
  
  // Form state
  const [formData, setFormData] = useState<OrderEditFormData>({
    orderStatus: order.orderStatus,
    pricePaid: order.pricePaid,
    orderGrandTotal: order.orderGrandTotal
  });
  
  // Validation state
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update form data when order changes
  useEffect(() => {
    setFormData({
      orderStatus: order.orderStatus,
      pricePaid: order.pricePaid,
      orderGrandTotal: order.orderGrandTotal
    });
    setErrors([]);
    setTouched({});
  }, [order]);

  // Handle form field changes
  const handleFieldChange = (field: keyof OrderEditFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Clear errors for this field
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateFormData(formData, order);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      setErrors(['Failed to save order. Please try again.']);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  // Check if order can be edited
  const canEdit = order.canBeEdited;
  const isCompleted = formData.orderStatus === OrderStatusCode.completed;
  const isCanceled = formData.orderStatus === OrderStatusCode.canceled;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('admin.orders.editDialog.title')} - {order.orderCode}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSaving}
              className="h-8 w-8 p-0"
              aria-label={t('common.actions.closeDialog')}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Order cannot be edited notice */}
          {!canEdit && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700">
                {t('admin.orders.editDialog.completedNote')}
              </AlertDescription>
            </Alert>
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700">
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <div key={index} className="text-sm">{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.orders.editDialog.status')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderStatus">{t('admin.orders.editDialog.orderStatus')}</Label>
                  <Select
                    value={formData.orderStatus.toString()}
                    onValueChange={(value) => handleFieldChange('orderStatus', parseInt(value))}
                    disabled={!canEdit || isSaving}
                  >
                    <SelectTrigger id="orderStatus">
                      <SelectValue placeholder={t('admin.orders.editDialog.selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status change notice */}
                {formData.orderStatus !== order.orderStatus && (
                  <div className="text-sm text-muted-foreground">
                    {t('admin.orders.editDialog.statusWillChange')} <strong>{getStatusLabel(order.orderStatus)}</strong> {t('admin.orders.editDialog.to')} <strong>{getStatusLabel(formData.orderStatus)}</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Amount Modification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.orders.editDialog.modifyTotal')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderGrandTotal">{t('admin.orders.editDialog.totalAmountDA')}</Label>
                  <Input
                    id="orderGrandTotal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.orderGrandTotal}
                    onChange={(e) => handleFieldChange('orderGrandTotal', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit || isSaving}
                    className="font-mono"
                  />
                </div>

                {/* Original total for reference */}
                <div className="text-sm text-muted-foreground">
                  {t('admin.orders.editDialog.originalTotal')}: {formatDZD(order.orderGrandTotal)}
                </div>
              </CardContent>
            </Card>

            {/* Paid Price (for completed orders) */}
            {isCompleted && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {t('admin.orders.editDialog.paidPrice')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricePaid">{t('admin.orders.editDialog.paidAmountDA')}</Label>
                    <Input
                      id="pricePaid"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.pricePaid}
                      onChange={(e) => handleFieldChange('pricePaid', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit || isSaving}
                      className="font-mono"
                      required
                    />
                  </div>

                  <Alert className="border-blue-200 bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-blue-700">
                      {t('admin.orders.editDialog.paidPriceRequired')}
                    </AlertDescription>
                  </Alert>

                  {/* Payment validation */}
                  {formData.pricePaid > 0 && formData.pricePaid !== formData.orderGrandTotal && (
                    <div className="text-sm text-orange-600">
                      {t('admin.orders.editDialog.partialPayment')}: {formatDZD(formData.pricePaid)} {t('common.of')} {formatDZD(formData.orderGrandTotal)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('admin.orders.editDialog.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('admin.orders.editDialog.orderCode')}:</span>
                  <span className="font-mono">{order.orderCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('admin.orders.editDialog.client')}:</span>
                  <span>{order.client.clientFirstName} {order.client.clientLastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('admin.orders.editDialog.orderType')}:</span>
                  <span>{order.typeLabel}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>{t('admin.orders.editDialog.totalAmount')}:</span>
                  <span>{formatDZD(formData.orderGrandTotal)}</span>
                </div>
                {isCompleted && (
                  <div className="flex justify-between font-medium">
                    <span>{t('admin.orders.editDialog.paidAmount')}:</span>
                    <span className="text-green-600">{formatDZD(formData.pricePaid)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                {t('admin.orders.editDialog.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!canEdit || isSaving || errors.length > 0}
                className="min-w-[100px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('admin.orders.editDialog.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('admin.orders.editDialog.save')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
});
