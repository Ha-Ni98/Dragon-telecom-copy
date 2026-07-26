/**
 * ProductOrderModal Component
 * The PUB-03 order form (RHF + Zod, order.schema.ts) — quantity, contact, delivery mode with
 * cascading wilaya/commune selects, and the live total. Folds in what used to be the standalone
 * DeliveryForm (its sole consumer — see plan.md Sprint 3 note).
 */

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShoppingCart, Package, Truck, MapPin } from "lucide-react";
import { OrderType } from "@dragon-telecom/contract";
import type { ProductWithPricingDto, WilayaDto, FeeDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/components/providers/AuthProvider";
import { orderSchema, type OrderFormValues } from "@/pages/product-detail/order.schema";

interface DeliveryParams {
  wilayaId: string;
  communeId: string;
  orderType: OrderType;
}

interface ProductOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  // set-02 D8: widened from ProductDetailDto — every field this modal reads (id, name,
  // currentPrice, guestPrice) is on the base ProductWithPricingDto; relatedIds (the one field
  // ProductDetailDto adds) is never used here. PUB-03's ProductDetails.tsx still passes a
  // ProductDetailDto (assignable, no change needed there); PUB-04's Cart hands it a
  // CartItemDto.product, which is exactly a ProductWithPricingDto (Sprint 5).
  product: ProductWithPricingDto;
  /** Initial quantity, carried over from ProductPricingSection's stepper. */
  quantity: number;
  /** Wilayas (with nested communes) for the cascading selects — parent-owned useWilayas(). */
  wilayas: WilayaDto[];
  /** Resolved delivery fee for the current wilaya/commune/mode — parent-owned usePlatformDeliveryFee(). */
  fee?: FeeDto;
  isFeeLoading?: boolean;
  /** Fires whenever wilaya/commune/mode change, so the parent can (re)resolve `fee`. Null when
   * the params aren't all set yet (pickup, or wilaya/commune incomplete). */
  onDeliveryParamsChange?: (params: DeliveryParams | null) => void;
  /** Prefill for signed-in clients (PUB-03: "prefilled for clients, editable"). */
  prefill?: { fullName?: string; phone?: string; wilayaId?: string; communeId?: string };
  onSubmit: (data: OrderFormValues) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

export function ProductOrderModal({
  isOpen,
  onClose,
  product,
  quantity,
  wilayas,
  fee,
  isFeeLoading,
  onDeliveryParamsChange,
  prefill,
  onSubmit,
  isSubmitting = false,
  className,
}: ProductOrderModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Pickup is client-only (PUB-03: "guest = delivery-home | delivery-office; client also pickup").
  const { isAuthenticated } = useAuth();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema(t)),
    defaultValues: {
      productId: product.id,
      quantity,
      orderType: isAuthenticated ? OrderType.PICKUP : OrderType.DELIVERY_HOME,
      contact: { fullName: prefill?.fullName ?? "", phone: prefill?.phone ?? "" },
      delivery: isAuthenticated
        ? undefined
        : { wilayaId: prefill?.wilayaId ?? "", communeId: prefill?.communeId ?? "", address: "" },
    },
  });

  const watchedOrderType = watch("orderType");
  const watchedWilayaId = watch("delivery.wilayaId");
  const watchedCommuneId = watch("delivery.communeId");
  const isPickup = watchedOrderType === OrderType.PICKUP;

  const selectedWilaya = useMemo(
    () => wilayas.find((w) => w.id === watchedWilayaId),
    [wilayas, watchedWilayaId],
  );
  const communeOptions = selectedWilaya?.communes ?? [];

  // Notify the parent of the params it needs to resolve the fee — never during pickup (delivery
  // is cleared below) and only once wilaya + commune are both set (plan.md PUB-03: "Fee renders
  // only when wilaya + commune + mode are all set").
  useEffect(() => {
    if (isPickup || !watchedWilayaId || !watchedCommuneId) {
      onDeliveryParamsChange?.(null);
      return;
    }
    onDeliveryParamsChange?.({
      wilayaId: watchedWilayaId,
      communeId: watchedCommuneId,
      orderType: watchedOrderType,
    });
    // Only the three params matter here — including the callback identity would refire on every
    // parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPickup, watchedWilayaId, watchedCommuneId, watchedOrderType]);

  const handleOrderTypeChange = (value: OrderType) => {
    setValue("orderType", value);
    // Pickup ⇒ wilaya/commune disabled, fee 0 (PUB-03) — clear the delivery block entirely so
    // the contract's own refine (delivery forbidden when PICKUP) is satisfied.
    if (value === OrderType.PICKUP) {
      setValue("delivery", undefined);
    } else if (!watch("delivery")) {
      setValue("delivery", { wilayaId: "", communeId: "", address: "" });
    }
  };

  const resolvedUnitPrice = product.currentPrice ?? product.guestPrice ?? 0;
  const watchedQuantity = watch("quantity") || 0;
  const subtotal = resolvedUnitPrice * watchedQuantity;
  const deliveryFee = isPickup ? 0 : (fee?.deliveryHome ?? 0);
  const total = subtotal + deliveryFee;

  const submit = async (data: OrderFormValues) => {
    try {
      await onSubmit(data);
    } catch (err) {
      // PUB-03: 409 INSUFFICIENT_STOCK renders on the quantity field; 403 GUEST_PRICE_HIDDEN
      // redirects to login. Any other error still surfaces via the mutation's own global toast
      // (query-client.ts) — nothing further to do here.
      if (axios.isAxiosError(err)) {
        const code = err.response?.data?.error?.code;
        if (code === "INSUFFICIENT_STOCK") {
          setError("quantity", { message: t("product.quantityExceedsStock") });
          return;
        }
        if (code === "GUEST_PRICE_HIDDEN") {
          onClose();
          navigate("/login");
          return;
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn("max-w-2xl min-w-xs w-2xl max-h-[90vh] overflow-y-auto", className)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5" />
            <span>{t("product.orderNow")}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-6 py-4">
          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="order-quantity">{t("product.quantity")}</Label>
            <Input
              id="order-quantity"
              type="number"
              min={1}
              {...register("quantity", { valueAsNumber: true })}
              className={cn(errors.quantity && "border-destructive")}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("product.personalInfo")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order-fullName">{t("product.fullName")}</Label>
                <Input
                  id="order-fullName"
                  {...register("contact.fullName")}
                  placeholder={t("product.fullNamePlaceholder")}
                  className={cn(errors.contact?.fullName && "border-destructive")}
                />
                {errors.contact?.fullName && (
                  <p className="text-sm text-destructive">{errors.contact.fullName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-phone">{t("product.phone")}</Label>
                <Input
                  id="order-phone"
                  {...register("contact.phone")}
                  placeholder={t("product.phonePlaceholder")}
                  className={cn(errors.contact?.phone && "border-destructive")}
                />
                {errors.contact?.phone && (
                  <p className="text-sm text-destructive">{errors.contact.phone.message}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Mode */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("product.selectOrderMode")}</h3>
            <RadioGroup
              value={watchedOrderType}
              onValueChange={(v) => handleOrderTypeChange(v as OrderType)}
              className="space-y-4"
            >
              {isAuthenticated && (
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value={OrderType.PICKUP} id="pickup" />
                  <Label
                    htmlFor="pickup"
                    className="flex items-center space-x-3 cursor-pointer flex-1"
                  >
                    <Package className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{t("product.pickup")}</div>
                      <div className="text-sm text-muted-foreground">
                        {t("product.pickupMessage")}
                      </div>
                    </div>
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value={OrderType.DELIVERY_HOME} id="delivery-home" />
                <Label
                  htmlFor="delivery-home"
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                >
                  <Truck className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">{t("product.deliveryToHome")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.deliveryToHomeDesc")}
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value={OrderType.DELIVERY_OFFICE} id="delivery-office" />
                <Label
                  htmlFor="delivery-office"
                  className="flex items-center space-x-3 cursor-pointer flex-1"
                >
                  <Truck className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-medium">{t("product.deliveryToOffice")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.deliveryToOfficeDesc")}
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Delivery address (disabled + cleared for pickup) */}
          {!isPickup && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>{t("product.location")}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("product.wilaya")}</Label>
                  <Controller
                    control={control}
                    name="delivery.wilayaId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("delivery.communeId", "");
                        }}
                      >
                        <SelectTrigger
                          className={cn(errors.delivery?.wilayaId && "border-destructive")}
                        >
                          <SelectValue placeholder={t("product.selectWilaya")} />
                        </SelectTrigger>
                        <SelectContent>
                          {wilayas.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.frName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.delivery?.wilayaId && (
                    <p className="text-sm text-destructive">{errors.delivery.wilayaId.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("product.commune")}</Label>
                  <Controller
                    control={control}
                    name="delivery.communeId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!watchedWilayaId}
                      >
                        <SelectTrigger
                          className={cn(errors.delivery?.communeId && "border-destructive")}
                        >
                          <SelectValue placeholder={t("product.selectCommune")} />
                        </SelectTrigger>
                        <SelectContent>
                          {communeOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.frName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.delivery?.communeId && (
                    <p className="text-sm text-destructive">{errors.delivery.communeId.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-address">
                  {t("product.address")} ({t("product.optional")})
                </Label>
                <Input
                  id="order-address"
                  {...register("delivery.address")}
                  placeholder={t("product.addressPlaceholder")}
                />
              </div>
            </div>
          )}

          {/* Fee — only once wilaya + commune + mode are all set (plan.md PUB-03) */}
          {!isPickup && watchedWilayaId && watchedCommuneId && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t("product.deliveryFee")}:</span>
                <span className="text-lg font-bold text-primary">
                  {isFeeLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  ) : (
                    `${deliveryFee.toLocaleString()} DA`
                  )}
                </span>
              </div>
            </div>
          )}

          <Separator />

          {/* Order Summary */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>{product.name}</span>
              <span>{watchedQuantity}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("product.subtotal")}</span>
              <span>{subtotal.toLocaleString()} DA</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium text-lg">
              <span>{t("product.totalPrice")}</span>
              <span>{total.toLocaleString()} DA</span>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("common.processing")}
                </>
              ) : (
                t("product.confirmOrder")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
