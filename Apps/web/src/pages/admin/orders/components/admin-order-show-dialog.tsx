/**
 * Admin Order Show Dialog Component
 * Read-only dialog for displaying detailed order information
 */

import React, { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Phone, 
  ShoppingBag, 
  TrendingUp, 
  Calendar, 
  Package, 
  Truck, 
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import { AdminOrderWithDetails } from '@/types/draft-types/order.types';
import { OrderStatusCode } from '@/types/draft-types/enums.types';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDZD } from '@/lib/utils';

interface AdminOrderShowDialogProps {
  /** Order data */
  order: AdminOrderWithDetails;
  /** Dialog open state */
  isOpen: boolean;
  /** Close dialog handler */
  onClose: () => void;
  /** Custom className for styling */
  className?: string;
}

/**
 * Get completion rate color and label
 */
function getCompletionRateInfo(rate: number) {
  if (rate >= 80) {
    return {
      color: 'text-green-600 bg-green-50 border-green-200',
      label: 'Excellent',
      icon: CheckCircle
    };
  } else if (rate >= 50) {
    return {
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      label: 'Good',
      icon: TrendingUp
    };
  } else {
    return {
      color: 'text-red-600 bg-red-50 border-red-200',
      label: 'Poor',
      icon: AlertTriangle
    };
  }
}

/**
 * Get status badge variant and color
 */
function getStatusBadgeVariant(status: OrderStatusCode) {
  switch (status) {
    case OrderStatusCode.pending:
      return 'secondary';
    case OrderStatusCode.confirmed:
      return 'default';
    case OrderStatusCode.delivery:
      return 'outline';
    case OrderStatusCode.completed:
      return 'default';
    case OrderStatusCode.canceled:
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Get status badge color class
 */
function getStatusBadgeColor(status: OrderStatusCode) {
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
}

/**
 * Get order type icon and label
 */
function getOrderTypeInfo(orderType: number) {
  switch (orderType) {
    case 0: // pick-up
      return {
        icon: Package,
        label: 'Pickup',
        description: 'Customer will pick up at store'
      };
    case 1: // delivry-home
      return {
        icon: Truck,
        label: 'Home Delivery',
        description: 'Delivery to customer home'
      };
    case 2: // delivry-office
      return {
        icon: Truck,
        label: 'Office Delivery',
        description: 'Delivery to customer office'
      };
    default:
      return {
        icon: Package,
        label: 'Unknown',
        description: 'Unknown delivery type'
      };
  }
}

/**
 * Client Information Section
 */
function ClientInformationSection({ order }: { order: AdminOrderWithDetails }) {
  const { t } = useTranslation();
  const completionInfo = getCompletionRateInfo(order.client.clientCompletionRate);
  const CompletionIcon = completionInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('admin.orders.showDialog.clientInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.clientName')}
            </label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {order.client.clientFirstName} {order.client.clientLastName}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.clientPhone')}
            </label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{order.client.clientPhoneNumber}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Client Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.clientOrders')}
            </label>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.client.clientTotalOrders} orders</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.completionRate')}
            </label>
            <div className="flex items-center gap-2">
              <CompletionIcon className="h-4 w-4" />
              <Badge className={`${completionInfo.color} border`}>
                {order.client.clientCompletionRate}% - {completionInfo.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Client Location */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Location
          </label>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {order.client.clientWilaya}, {order.client.clientCommune}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Order Information Section
 */
function OrderInformationSection({ order }: { order: AdminOrderWithDetails }) {
  const { t } = useTranslation();
  const typeInfo = getOrderTypeInfo(order.orderType);
  const TypeIcon = typeInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('admin.orders.showDialog.orderInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.orderDate')}
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.formattedDate}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.orderStatus')}
            </label>
            <Badge 
              variant={getStatusBadgeVariant(order.orderStatus)}
              className={getStatusBadgeColor(order.orderStatus)}
            >
              {order.statusLabel}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Order Type and Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.orderType')}
            </label>
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{typeInfo.label}</div>
                <div className="text-xs text-muted-foreground">{typeInfo.description}</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.orderTotal')}
            </label>
            <div className="font-medium text-lg">
              {formatDZD(order.orderGrandTotal)}
            </div>
          </div>
        </div>

        {/* Days Since Creation */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('admin.orders.showDialog.daysSinceCreation')}
          </label>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={`font-medium ${
              order.daysSinceCreation > 4 ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {order.daysSinceCreation} days
              {order.daysSinceCreation > 4 && (
                <span className="ml-2 text-xs text-red-500">
                  (Overdue)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Total Paid (if completed) */}
        {order.orderStatus === OrderStatusCode.completed && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.totalPaid')}
            </label>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">
                {formatDZD(order.pricePaid)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Products Section
 */
function ProductsSection({ order }: { order: AdminOrderWithDetails }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('admin.orders.showDialog.products')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {order.orderLines.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No products in this order
          </div>
        ) : (
          <div className="space-y-3">
            {order.orderLines.map((line, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{line.product.productName}</div>
                  <div className="text-sm text-muted-foreground">
                    {line.product.brand.brandName} - {line.product.model.modelName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Code: {line.product.productCodeBar}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {t('admin.orders.showDialog.quantity')}: {line.orderQuantity}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('admin.orders.showDialog.unitPrice')}: {formatDZD(line.unitPrice)}
                  </div>
                  <div className="font-medium">
                    Total: {formatDZD(line.unitPrice * line.orderQuantity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Delivery Information Section
 */
function DeliveryInformationSection({ order }: { order: AdminOrderWithDetails }) {
  const { t } = useTranslation();

  if (!order.deliveryDetails) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          {t('admin.orders.showDialog.deliveryInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.deliveryName')}
            </label>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.deliveryDetails.fullName}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.deliveryPhone')}
            </label>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{order.deliveryDetails.phoneNumber}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.deliveryWilaya')}
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{order.deliveryDetails.wilaya}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t('admin.orders.showDialog.deliveryCommune')}
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{order.deliveryDetails.commune}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Pickup Information Section
 */
function PickupInformationSection({ order }: { order: AdminOrderWithDetails }) {
  const { t } = useTranslation();

  if (order.orderType !== 0) { // Not a pickup order
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('admin.orders.showDialog.pickupInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <div className="font-medium">{t('admin.orders.storePickup')}</div>
          <div className="text-sm text-muted-foreground">
            Customer will pick up at our store location
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main AdminOrderShowDialog component
 */
export const AdminOrderShowDialog = memo(function AdminOrderShowDialog({
  order,
  isOpen,
  onClose,
  className = ''
}: AdminOrderShowDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('admin.orders.showDialog.title')} - {order.orderCode}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              aria-label={t('common.actions.closeDialog')}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Client Information */}
          <ClientInformationSection order={order} />
          
          {/* Order Information */}
          <OrderInformationSection order={order} />
          
          {/* Products */}
          <ProductsSection order={order} />
          
          {/* Delivery Information (if applicable) */}
          <DeliveryInformationSection order={order} />
          
          {/* Pickup Information (if applicable) */}
          <PickupInformationSection order={order} />
        </div>
      </DialogContent>
    </Dialog>
  );
});
