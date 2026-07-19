/**
 * ProductOrderModal Component
 * Handles order modal with pickup/delivery selection and confirmation flow
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, MapPin } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { DeliveryForm } from "./DeliveryForm";
import type { ProductDetails, DeliveryFormData, OrderData } from "@/types/draft-types";

interface ProductOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetails;
  quantity: number;
  unitPrice: number;
  onConfirmOrder: (orderData: OrderData) => Promise<void>;
  className?: string;
}

type OrderStep = "mode" | "delivery" | "confirmation" | "success";

export function ProductOrderModal({
  isOpen,
  onClose,
  product,
  quantity,
  unitPrice,
  onConfirmOrder,
  className
}: ProductOrderModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<OrderStep>("mode");
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryData, setDeliveryData] = useState<DeliveryFormData | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Calculate totals with safety checks
  const safeUnitPrice = unitPrice || 0;
  const subtotal = safeUnitPrice * quantity;
  const total = orderType === "delivery" ? subtotal + deliveryFee : subtotal;

  // Handle order type selection
  const handleOrderTypeChange = (type: "pickup" | "delivery") => {
    setOrderType(type);
  };

  // Handle delivery form submission
  const handleDeliverySubmit = async (data: DeliveryFormData) => {
    setDeliveryData(data);
    setCurrentStep("confirmation");
  };

  // Handle order confirmation
  const handleConfirmOrder = async () => {
    setIsProcessing(true);
    try {
      const orderData: OrderData = {
        productId: product.idProduct,
        quantity,
        orderType,
        totalPrice: total,
        deliveryInfo: orderType === "delivery" ? deliveryData || undefined : undefined,
        deliveryFee: orderType === "delivery" ? deliveryFee : undefined
      };

      await onConfirmOrder(orderData);
      
      // Generate mock order ID
      const mockOrderId = `ORD-${Date.now()}`;
      setOrderId(mockOrderId);
      setCurrentStep("success");
    } catch (error) {
      console.error("Order confirmation failed:", error);
      // Handle error - could show toast notification
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (currentStep === "success") {
      // Reset state when closing after success
      setCurrentStep("mode");
      setOrderType("pickup");
      setDeliveryData(null);
      setDeliveryFee(0);
      setOrderId(null);
    }
    onClose();
  };

  // Handle back navigation
  const handleBack = () => {
    switch (currentStep) {
      case "delivery":
        setCurrentStep("mode");
        break;
      case "confirmation":
        setCurrentStep(orderType === "delivery" ? "delivery" : "mode");
        break;
      default:
        break;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case "mode":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">{t("product.selectOrderMode")}</h3>
              <p className="text-muted-foreground">{t("product.selectOrderModeDesc")}</p>
            </div>

            <RadioGroup
              value={orderType}
              onValueChange={handleOrderTypeChange}
              className="space-y-4"
            >
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="flex items-center space-x-3 cursor-pointer flex-1">
                  <Package className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">{t("product.pickup")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.pickupMessage")}
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery" className="flex items-center space-x-3 cursor-pointer flex-1">
                  <Truck className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">{t("product.delivery")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.deliveryMessage")}
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => setCurrentStep(orderType === "delivery" ? "delivery" : "confirmation")}
                className="flex-1"
              >
                {t("common.continue")}
              </Button>
            </div>
          </div>
        );

      case "delivery":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2"
              >
                ←
              </Button>
              <h3 className="text-lg font-medium">{t("product.deliveryInfo")}</h3>
            </div>
            
            <DeliveryForm
              onSubmit={handleDeliverySubmit}
              onCancel={handleClose}
              isLoading={isProcessing}
            />
          </div>
        );

      case "confirmation":
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2"
              >
                ←
              </Button>
              <h3 className="text-lg font-medium">{t("product.orderConfirmation")}</h3>
            </div>

            {/* Order Summary */}
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">{t("product.orderSummary")}</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{product.productName}</span>
                    <span>{quantity}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("product.unitPrice")}</span>
                    <span>{safeUnitPrice.toLocaleString()} DA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("product.subtotal")}</span>
                    <span>{(subtotal || 0).toLocaleString()} DA</span>
                  </div>
                  
                  {orderType === "delivery" && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("product.deliveryFee")}</span>
                        <span>{(deliveryFee || 0).toLocaleString()} DA</span>
                      </div>
                      {deliveryData && (
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{deliveryData.wilaya}, {deliveryData.commune}</span>
                          </div>
                          <div className="flex items-center space-x-1 mt-1">
                            {deliveryData.deliveryMode === "home" ? (
                              <Truck className="w-3 h-3" />
                            ) : (
                              <Package className="w-3 h-3" />
                            )}
                            <span>
                              {deliveryData.deliveryMode === "home" 
                                ? t("product.deliveryToHome")
                                : t("product.deliveryToOffice")
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between font-medium text-lg">
                    <span>{t("product.totalPrice")}</span>
                    <span>{(total || 0).toLocaleString()} DA</span>
                  </div>
                </div>
              </div>

              {/* Order Type Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  {orderType === "pickup" ? (
                    <Package className="w-5 h-5 text-primary" />
                  ) : (
                    <Truck className="w-5 h-5 text-primary" />
                  )}
                  <div>
                    <div className="font-medium">
                      {orderType === "pickup" ? t("product.pickup") : t("product.delivery")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {orderType === "pickup" 
                        ? t("product.pickupMessage")
                        : t("product.deliveryMessage")
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleConfirmOrder}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("common.processing")}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t("product.confirmOrder")}
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">{t("product.orderConfirmed")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("product.orderSuccessMessage")}
              </p>
              {orderId && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">{t("product.orderId")}</div>
                  <div className="font-mono font-medium">{orderId}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {orderType === "pickup" ? (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{t("product.pickupMessage")}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <Truck className="w-4 h-4" />
                  <span>{t("product.deliveryMessage")}</span>
                </div>
              )}
            </div>

            <Button onClick={handleClose} className="w-full">
              {t("common.close")}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("max-w-2xl min-w-xs w-2xl max-h-[90vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5" />
            <span>{t("product.orderNow")}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
