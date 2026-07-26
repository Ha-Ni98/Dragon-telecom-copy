import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  MapPin,
  Calendar,
  CreditCard,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  PackageCheck,
  Truck,
  BadgeCheck,
  XCircle,
  Undo2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import { OrderStatus, OrderType, type OrderDto } from "@dragon-telecom/contract";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { CancelOrderDialog } from "@/components/shared/CancelOrderDialog";

// set-02 Sprint 3 retype — was OrderWithDetails (numeric idOrder, multi-line orderLines[],
// OrderStatusCode's 5 values). OrderDto is single-product (productId/productName/quantity, no
// line array) and OrderStatus has 7 values (adds PACKAGED, RETURNED). No longer imports
// useOrders() directly — parent owns the useCancelMyOrder() mutation and passes onCancel/
// isCancelling, matching the established shared-component convention (ProductOrderModal takes
// onSubmit/isSubmitting rather than owning usePlaceOrder itself).
interface OrderCardProps {
  order: OrderDto;
  onCancel?: () => void;
  isCancelling?: boolean;
  className?: string;
}

const STATUS_ICON: Record<OrderStatus, ReactNode> = {
  [OrderStatus.PENDING]: <Clock className="h-4 w-4" />,
  [OrderStatus.CONFIRMED]: <CheckCircle className="h-4 w-4" />,
  [OrderStatus.PACKAGED]: <PackageCheck className="h-4 w-4" />,
  [OrderStatus.IN_DELIVERY]: <Truck className="h-4 w-4" />,
  [OrderStatus.COMPLETED]: <BadgeCheck className="h-4 w-4" />,
  [OrderStatus.CANCELLED]: <XCircle className="h-4 w-4" />,
  [OrderStatus.RETURNED]: <Undo2 className="h-4 w-4" />,
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [OrderStatus.CONFIRMED]: "bg-blue-100 text-blue-800 border-blue-200",
  [OrderStatus.PACKAGED]: "bg-indigo-100 text-indigo-800 border-indigo-200",
  [OrderStatus.IN_DELIVERY]: "bg-purple-100 text-purple-800 border-purple-200",
  [OrderStatus.COMPLETED]: "bg-green-100 text-green-800 border-green-200",
  [OrderStatus.CANCELLED]: "bg-red-100 text-red-800 border-red-200",
  [OrderStatus.RETURNED]: "bg-orange-100 text-orange-800 border-orange-200",
};

const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "orders.pending",
  [OrderStatus.CONFIRMED]: "orders.confirmed",
  [OrderStatus.PACKAGED]: "orders.packaged",
  [OrderStatus.IN_DELIVERY]: "orders.delivery",
  [OrderStatus.COMPLETED]: "orders.completed",
  [OrderStatus.CANCELLED]: "orders.cancelled",
  [OrderStatus.RETURNED]: "orders.returned",
};

const TYPE_LABEL_KEY: Record<OrderType, string> = {
  [OrderType.PICKUP]: "product.pickup",
  [OrderType.DELIVERY_HOME]: "product.deliveryToHome",
  [OrderType.DELIVERY_OFFICE]: "product.deliveryToOffice",
};

export function OrderCard({
  order,
  onCancel,
  isCancelling = false,
  className = "",
}: OrderCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const isPickup = order.orderType === OrderType.PICKUP;
  const paymentStatus =
    order.paidAmount === 0 ? "unpaid" : order.paidAmount >= order.totalAmount ? "paid" : "partial";
  const paymentColor =
    paymentStatus === "paid"
      ? "bg-green-100 text-green-800"
      : paymentStatus === "partial"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  const timeline = [
    { at: order.placedAt, labelKey: "orders.orderDate" },
    { at: order.confirmedAt, labelKey: "orders.confirmed" },
    { at: order.deliveredAt, labelKey: "orders.completed" },
    { at: order.cancelledAt, labelKey: "orders.cancelled" },
  ].filter((entry): entry is { at: string; labelKey: string } => !!entry.at);

  const handleConfirmCancel = () => {
    onCancel?.();
    setIsCancelDialogOpen(false);
  };

  return (
    <Card
      className={`order-card border-0 shadow-card hover:shadow-elegant transition-all duration-300 ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{order.reference}</h3>
              <Badge variant="outline" className={STATUS_COLOR[order.status]}>
                {STATUS_ICON[order.status]}
                <span className="ml-1">{t(STATUS_LABEL_KEY[order.status])}</span>
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDateTime(order.placedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                {isPickup ? <Package className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                <span>{t(TYPE_LABEL_KEY[order.orderType])}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>
                  {order.productName} × {order.quantity}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-primary">{formatDZD(order.totalAmount)}</div>
            <Badge variant="outline" className={paymentColor}>
              <CreditCard className="h-3 w-3 mr-1" />
              {t(`orders.${paymentStatus}`)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Order Summary */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orders.subtotal")}</span>
            <span>{formatDZD(order.subtotal)}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("orders.deliveryFee")}</span>
              <span>{formatDZD(order.deliveryFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>{t("orders.grandTotal")}</span>
            <span className="text-primary">{formatDZD(order.totalAmount)}</span>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            <Separator />

            {/* Delivery Information */}
            {!isPickup && (
              <div>
                <h4 className="font-medium mb-2">{t("orders.deliveryInfo")}</h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm">
                    <strong>{order.contactName}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">{order.contactPhone}</p>
                  {(order.wilaya || order.commune) && (
                    <p className="text-sm text-muted-foreground">
                      {[order.commune?.frName, order.wilaya?.frName].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {order.status === OrderStatus.IN_DELIVERY &&
                    (order.deliveryCompany || order.trackingNumber) && (
                      <>
                        {order.deliveryCompany && (
                          <p className="text-sm text-muted-foreground">
                            {t("orders.deliveryCompany")}: {order.deliveryCompany}
                          </p>
                        )}
                        {order.trackingNumber && (
                          <p className="text-sm text-muted-foreground">
                            {t("orders.trackingNumber")}: {order.trackingNumber}
                          </p>
                        )}
                      </>
                    )}
                </div>
              </div>
            )}

            {/* Pickup Information */}
            {isPickup && (
              <div>
                <h4 className="font-medium mb-2">{t("orders.pickupInfo")}</h4>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{t("product.pickupMessage")}</p>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            {timeline.length > 1 && (
              <div>
                <h4 className="font-medium mb-2">{t("orders.statusTimeline")}</h4>
                <div className="space-y-1">
                  {timeline.map((entry) => (
                    <div key={entry.labelKey} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t(entry.labelKey)}</span>
                      <span>{formatDateTime(entry.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Invoice — OrderDto carries no direct invoice-number FK (billing owns the
                reverse pointer via InvoiceDto.sourceReference), so this links to the invoice
                list rather than a specific number (plan.md PUB-09 UI Components). */}
            <Link
              to="/invoices"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Receipt className="h-4 w-4" />
              {t("orders.linkedInvoice")}
            </Link>
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
                {t("common.hideDetails")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t("common.showDetails")}
              </>
            )}
          </Button>

          {order.canBeCancelled && (
            <Button
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => setIsCancelDialogOpen(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              {t("orders.cancelOrder")}
            </Button>
          )}
        </div>
      </CardContent>

      <CancelOrderDialog
        isOpen={isCancelDialogOpen}
        onClose={() => !isCancelling && setIsCancelDialogOpen(false)}
        onConfirm={handleConfirmCancel}
        order={order}
        isCancelling={isCancelling}
      />
    </Card>
  );
}
