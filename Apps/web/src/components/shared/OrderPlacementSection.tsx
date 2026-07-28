/**
 * OrderPlacementSection Component
 * S15 — replaces ProductOrderModal's dialog with an inline section, and generalises it from a
 * single product to a caller-supplied lines array so S16's multi-product cart checkout can reuse
 * it verbatim. Owns the whole order form: contact, delivery mode, wilaya/commune, fee resolution
 * and submission — the caller only supplies which products/quantities to order.
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Package, Truck, MapPin } from "lucide-react";
import { OrderType, UserType } from "@dragon-telecom/contract";
import type { ProductWithPricingDto, OrderDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useClientMe } from "@/hooks/useClientPortal";
import { useWilayas, usePlatformDeliveryFee } from "@/hooks/usePlatform";
import { usePlaceOrder } from "@/hooks/useOrdersPortal";
import { formatDZD } from "@/lib/utils";
import {
  orderSchema,
  toPlaceOrderCommand,
  type OrderFormValues,
} from "@/pages/product-detail/order.schema";

export interface OrderPlacementLine {
  product: ProductWithPricingDto;
  quantity: number;
}

interface OrderPlacementSectionProps {
  lines: OrderPlacementLine[];
  /** Disables the submit button (out of stock, price hidden, nothing selected). */
  disabled?: boolean;
  /** Defaults to t("product.orderNow"). */
  submitLabel?: string;
  /** Fired after a successful placement, before the navigation to /order-confirmation. */
  onPlaced?: (order: OrderDto) => void;
  className?: string;
}

export function OrderPlacementSection({
  lines,
  disabled,
  submitLabel,
  onPlaced,
  className,
}: OrderPlacementSectionProps) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isClient = session?.type === UserType.CLIENT;
  const { data: clientMe } = useClientMe({ enabled: isClient });
  const { data: wilayas } = useWilayas();
  const placeOrder = usePlaceOrder();

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema(t)),
    defaultValues: {
      orderType: isClient ? OrderType.PICKUP : OrderType.DELIVERY_HOME,
      contact: { fullName: "", phone: "" },
      delivery: isClient ? undefined : { wilayaId: "", communeId: "" },
    },
  });

  // RHF captures defaultValues once, and useClientMe resolves after that first render, so the
  // profile has to be pushed in with reset() when it arrives — and again whenever it changes.
  // Without this the fields stay empty for a signed-in client (and kept whatever the previous
  // product page left in them, since this component is not remounted by a :id change alone —
  // the caller additionally passes `key` for that, see ProductPricingSection).
  useEffect(() => {
    if (!clientMe) return;
    reset((current) => ({
      ...current,
      contact: { fullName: `${clientMe.firstName} ${clientMe.lastName}`, phone: clientMe.phone },
      delivery:
        current.orderType === OrderType.PICKUP
          ? undefined
          : { wilayaId: clientMe.wilayaId, communeId: clientMe.communeId },
    }));
  }, [clientMe, reset]);

  const watchedOrderType = watch("orderType");
  const watchedWilayaId = watch("delivery.wilayaId");
  const watchedCommuneId = watch("delivery.communeId");
  const isPickup = watchedOrderType === OrderType.PICKUP;

  const { data: fee, isLoading: isFeeLoading } = usePlatformDeliveryFee({
    wilayaId: isPickup ? "" : (watchedWilayaId ?? ""),
    communeId: watchedCommuneId,
  });

  const selectedWilaya = (wilayas ?? []).find((w) => w.id === watchedWilayaId);
  const communeOptions = selectedWilaya?.communes ?? [];

  const handleOrderTypeChange = (value: OrderType) => {
    setValue("orderType", value);
    // Pickup ⇒ wilaya/commune disabled, fee 0 — clear the delivery block entirely so the
    // contract's own refine (delivery forbidden when PICKUP) is satisfied.
    if (value === OrderType.PICKUP) {
      setValue("delivery", undefined);
    } else if (!watch("delivery")) {
      setValue("delivery", { wilayaId: "", communeId: "" });
    }
  };

  const subtotal = lines.reduce((sum, line) => {
    const price = line.product.currentPrice ?? line.product.guestPrice ?? 0;
    return sum + price * line.quantity;
  }, 0);
  const deliveryFee = isPickup ? 0 : (fee?.deliveryHome ?? 0);
  const total = subtotal + deliveryFee;

  const submit = async (values: OrderFormValues) => {
    try {
      const command = toPlaceOrderCommand(
        values,
        lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        isClient ? (session?.clientId ?? null) : null,
      );
      const order = await placeOrder.mutateAsync(command);
      onPlaced?.(order);
      navigate("/order-confirmation", { state: { order } });
    } catch (err) {
      // 409 INSUFFICIENT_STOCK / 403 GUEST_PRICE_HIDDEN are interpreted here; any other error
      // still surfaces via the mutation's own global toast (query-client.ts).
      if (axios.isAxiosError(err)) {
        const code = err.response?.data?.error?.code;
        if (code === "INSUFFICIENT_STOCK") {
          setError("root", { message: t("orderSection.insufficientStock") });
          return;
        }
        if (code === "GUEST_PRICE_HIDDEN") {
          navigate("/login");
          return;
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className={cn("space-y-6", className)}>
      <h3 className="text-lg font-medium">{t("orderSection.title")}</h3>

      {errors.root?.message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}

      {/* Contact */}
      <div className="space-y-4">
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
        <h4 className="text-base font-medium">{t("product.selectOrderMode")}</h4>
        <RadioGroup
          value={watchedOrderType}
          onValueChange={(v) => handleOrderTypeChange(v as OrderType)}
          className="space-y-4"
        >
          {isClient && (
            <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
              <RadioGroupItem value={OrderType.PICKUP} id="pickup" />
              <Label htmlFor="pickup" className="flex items-center space-x-3 cursor-pointer flex-1">
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">{t("product.pickup")}</div>
                  <div className="text-sm text-muted-foreground">{t("product.pickupMessage")}</div>
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

      {/* Delivery location */}
      {!isPickup && (
        <div className="space-y-4">
          <h4 className="text-base font-medium flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>{t("product.deliveryInfo")}</span>
          </h4>
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
                      {(wilayas ?? []).map((w) => (
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
        </div>
      )}

      {/* Fee */}
      {!isPickup && watchedWilayaId && watchedCommuneId && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t("product.deliveryFee")}:</span>
            <span className="text-lg font-bold text-primary">
              {isFeeLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              ) : (
                formatDZD(deliveryFee, language)
              )}
            </span>
          </div>
        </div>
      )}

      <Separator />

      {/* Order Summary — one row per line so the cart's N lines read correctly */}
      <div className="p-4 border rounded-lg space-y-2">
        {lines.map((line) => (
          <div key={line.product.id} className="flex justify-between text-sm">
            <span>
              {line.product.name} × {line.quantity}
            </span>
            <span>
              {formatDZD(
                (line.product.currentPrice ?? line.product.guestPrice ?? 0) * line.quantity,
                language,
              )}
            </span>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("product.subtotal")}</span>
          <span>{formatDZD(subtotal, language)}</span>
        </div>
        {!isPickup && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("orders.deliveryFee")}</span>
            <span>{formatDZD(deliveryFee, language)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-medium text-lg">
          <span>{t("product.totalPrice")}</span>
          <span>{formatDZD(total, language)}</span>
        </div>
      </div>

      <Button type="submit" disabled={disabled || placeOrder.isPending} className="w-full">
        {placeOrder.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            {t("common.processing")}
          </>
        ) : (
          (submitLabel ?? t("product.orderNow"))
        )}
      </Button>
    </form>
  );
}
