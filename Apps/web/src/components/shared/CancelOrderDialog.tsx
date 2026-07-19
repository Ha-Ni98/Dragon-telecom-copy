import React, { useState } from 'react';
import { AlertTriangle, X, Package, Calendar, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import { OrderWithDetails } from '@/types/draft-types/order.types';
import { formatDZD } from '@/lib/utils';

interface CancelOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  order: OrderWithDetails | null;
  isCancelling?: boolean;
}

export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  order,
  isCancelling = false
}) => {
  const { t } = useTranslation();

  if (!order) return null;

  const totalItems = order.orderLines.reduce((total, line) => total + line.orderQuantity, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {t('orders.cancelOrder')}
          </DialogTitle>
          <DialogDescription>
            {t('orders.cancelOrderConfirm')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{order.orderCode}</h3>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                {order.statusLabel}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{order.formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>{totalItems} {t('orders.items')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>{formatDZD(order.orderGrandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Order Items Preview */}
          <div>
            <h4 className="font-medium mb-2">{t('cancellation.orderItems')}</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {order.orderLines.slice(0, 3).map((line) => (
                <div key={line.idLine} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded flex items-center justify-center">
                    {line.product.image ? (
                      <img
                        src={line.product.image}
                        alt={line.product.productName}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <span className="text-xs">📱</span>
                    )}
                  </div>
                  <span className="flex-1 truncate">{line.product.productName}</span>
                  <span className="text-muted-foreground">x{line.orderQuantity}</span>
                </div>
              ))}
              {order.orderLines.length > 3 && (
                <div className="text-sm text-muted-foreground text-center">
                  +{order.orderLines.length - 3} {t('cancellation.moreItems')}
                </div>
              )}
            </div>
          </div>

          {/* Warning Message */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">{t('cancellation.warning')}</p>
                <p className="text-red-600 mt-1">
                  {t('cancellation.warningMessage')}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCancelling}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isCancelling}
              className="min-w-[120px]"
            >
              {isCancelling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('cancellation.cancelling')}
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t('orders.cancelOrder')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
