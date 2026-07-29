import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { OrderDto } from "@dragon-telecom/contract";
import { OrderType } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 5 wires the page shell around this: reads
// useLocation().state.order and <Navigate to="/" replace /> when absent (plan.md PUB-05) — that
// routing branch is page-level wiring, not part of this presentational body.
const TYPE_LABEL_KEY: Record<OrderType, string> = {
  [OrderType.PICKUP]: "product.pickup",
  [OrderType.DELIVERY_HOME]: "product.deliveryToHome",
  [OrderType.DELIVERY_OFFICE]: "product.deliveryToOffice",
};

interface OrderConfirmationBodyProps {
  order: OrderDto;
  isClient: boolean;
}

export function OrderConfirmationBody({ order, isClient }: OrderConfirmationBodyProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-8 w-8" />
      </div>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("orderConfirmation.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("orderConfirmation.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)]">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("orderConfirmation.reference")}</span>
          <span className="font-medium">{order.reference}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">{t("product.fullName")}</span>
          <span className="font-medium">{order.contactName}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-muted-foreground">{t("product.phone")}</span>
          <span className="font-medium">{order.contactPhone}</span>
        </div>
        <Separator className="my-3" />
        {order.lines.map((line, index) => (
          <div key={line.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {index === 0 ? t("orderConfirmation.product") : ""}
            </span>
            <span className="font-medium">
              {line.productName} × {line.quantity}
            </span>
          </div>
        ))}
        {order.deliveryFee > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("orders.deliveryFee")}</span>
            <span>{formatDZD(order.deliveryFee)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">{t("orders.orderType")}</span>
          <span>{t(TYPE_LABEL_KEY[order.orderType])}</span>
        </div>
        <Separator className="my-3" />
        <div className="flex justify-between font-semibold">
          <span>{t("orders.grandTotal")}</span>
          <span className="text-primary">{formatDZD(order.totalAmount)}</span>
        </div>
      </div>

      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
        {t("orderConfirmation.pendingMessage")}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" asChild>
          <Link to="/products">{t("orderConfirmation.backToCatalog")}</Link>
        </Button>
        {isClient && (
          <Button asChild>
            <Link to="/orders">{t("account.seeMyOrders")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
