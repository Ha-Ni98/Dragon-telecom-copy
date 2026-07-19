import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  MapPin, 
  Calendar, 
  CreditCard, 
  Eye, 
  X, 
  ChevronDown, 
  ChevronUp,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import { useOrders } from '@/hooks/use-orders';
import { OrderWithDetails } from '@/types/draft-types/order.types';
import { OrderStatusCode, OrderTypeCode } from '@/types/draft-types/enums.types';
import { formatDZD } from '@/lib/utils';
import { toast } from 'sonner';
import { CancelOrderDialog } from '@/components/shared/CancelOrderDialog';

interface OrderCardProps {
  order: OrderWithDetails;
  onOrderCancelled?: (orderId: number) => void;
  className?: string;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onOrderCancelled,
  className = ''
}) => {
  const { t } = useTranslation();
  const { cancelOrder } = useOrders();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Get status icon and color
  const getStatusIcon = (status: OrderStatusCode) => {
    switch (status) {
      case OrderStatusCode.pending:
        return <Clock className="h-4 w-4" />;
      case OrderStatusCode.confirmed:
        return <CheckCircle className="h-4 w-4" />;
      case OrderStatusCode.delivery:
        return <Truck className="h-4 w-4" />;
      case OrderStatusCode.completed:
        return <CheckCircle className="h-4 w-4" />;
      case OrderStatusCode.canceled:
        return <XCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status: OrderStatusCode) => {
    switch (status) {
      case OrderStatusCode.pending:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case OrderStatusCode.confirmed:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case OrderStatusCode.delivery:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case OrderStatusCode.completed:
        return 'bg-green-100 text-green-800 border-green-200';
      case OrderStatusCode.canceled:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get order type icon
  const getOrderTypeIcon = (type: OrderTypeCode) => {
    switch (type) {
      case OrderTypeCode['pick-up']:
        return <Package className="h-4 w-4" />;
      case OrderTypeCode['delivry-home']:
      case OrderTypeCode['delivry-office']:
        return <MapPin className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  // Get payment status
  const getPaymentStatus = () => {
    if (order.pricePaid === 0) return { status: 'unpaid', color: 'bg-red-100 text-red-800' };
    if (order.pricePaid >= order.orderGrandTotal) return { status: 'paid', color: 'bg-green-100 text-green-800' };
    return { status: 'partial', color: 'bg-yellow-100 text-yellow-800' };
  };

  // Handle order cancellation
  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      const success = await cancelOrder(order.idOrder);
      if (success) {
        toast.success(t('orders.orderCancelled'));
        onOrderCancelled?.(order.idOrder);
        setIsCancelDialogOpen(false);
      } else {
        toast.error(t('orders.cancelFailed'));
      }
    } catch (error) {
      console.error('Cancel order error:', error);
      toast.error(t('orders.cancelFailed'));
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle cancel dialog open
  const handleOpenCancelDialog = () => {
    setIsCancelDialogOpen(true);
  };

  // Handle cancel dialog close
  const handleCloseCancelDialog = () => {
    if (!isCancelling) {
      setIsCancelDialogOpen(false);
    }
  };

  // Handle view details
  const handleViewDetails = () => {
    // For now, just log the order ID
    console.log('View order details:', order.idOrder);
    // TODO: Navigate to order details page when implemented
  };

  const paymentStatus = getPaymentStatus();
  const totalItems = order.orderLines.reduce((total, line) => total + line.orderQuantity, 0);

  return (
    <Card className={`order-card border-0 shadow-card hover:shadow-elegant transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{order.orderCode}</h3>
              <Badge variant="outline" className={getStatusColor(order.orderStatus)}>
                {getStatusIcon(order.orderStatus)}
                <span className="ml-1">{order.statusLabel}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{order.formattedDate}</span>
              </div>
              <div className="flex items-center gap-1">
                {getOrderTypeIcon(order.orderType)}
                <span>{order.typeLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                <span>{totalItems} {t('orders.items')}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-primary">
              {formatDZD(order.orderGrandTotal)}
            </div>
            <Badge variant="outline" className={paymentStatus.color}>
              <CreditCard className="h-3 w-3 mr-1" />
              {t(`orders.${paymentStatus.status}`)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Order Summary */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('orders.subtotal')}</span>
            <span>{formatDZD(order.orderTotalPrice)}</span>
          </div>
          {order.orderDeliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('orders.deliveryFee')}</span>
              <span>{formatDZD(order.orderDeliveryFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>{t('orders.grandTotal')}</span>
            <span className="text-primary">{formatDZD(order.orderGrandTotal)}</span>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            <Separator />
            
            {/* Order Lines */}
            <div>
              <h4 className="font-medium mb-2">{t('orders.orderSummary')}</h4>
              <div className="space-y-2">
                {order.orderLines.map((line) => (
                  <div key={line.idLine} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg flex items-center justify-center">
                      {line.product.image ? (
                        <img
                          src={line.product.image}
                          alt={line.product.productName}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-lg">📱</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{line.product.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.product.brand.brandName} • {line.product.model.modelName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{line.orderQuantity}x</p>
                      <p className="text-xs text-muted-foreground">{formatDZD(line.unitPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Information */}
            {order.orderType !== OrderTypeCode['pick-up'] && (
              <div>
                <h4 className="font-medium mb-2">{t('orders.deliveryInfo')}</h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm"><strong>{order.orderDeliveryName}</strong></p>
                  <p className="text-sm text-muted-foreground">{order.orderDeliveryPhone}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.orderDeliveryCommune}, {order.orderDeliveryWilaya}
                  </p>
                </div>
              </div>
            )}

            {/* Pickup Information */}
            {order.orderType === OrderTypeCode['pick-up'] && (
              <div>
                <h4 className="font-medium mb-2">{t('orders.pickupInfo')}</h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Pick up at our store location
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {t('common.hideDetails')}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t('common.showDetails')}
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetails}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t('orders.viewDetails')}
            </Button>
            
            {order.canBeCancelled && (
              <Button
                variant="outline"
                size="sm"
                disabled={isCancelling}
                onClick={handleOpenCancelDialog}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                {t('orders.cancelOrder')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        isOpen={isCancelDialogOpen}
        onClose={handleCloseCancelDialog}
        onConfirm={handleCancelOrder}
        order={order}
        isCancelling={isCancelling}
      />
    </Card>
  );
};
