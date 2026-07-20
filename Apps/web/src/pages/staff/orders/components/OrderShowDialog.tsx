import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import type { OrderDto } from "@dragon-telecom/contract";

interface OrderShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  /** Live re-check (STF-04 §UI: "live availability re-check") — the caller's own
   * useCatalogProduct(order.productId) read, passed in rather than fetched here. */
  liveAvailableQuantity?: number;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires this to the row click + a live product read.
export function OrderShowDialog({
  open,
  onOpenChange,
  order,
  liveAvailableQuantity,
}: OrderShowDialogProps) {
  const { t, language } = useTranslation();

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.orders.showDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="font-medium">{order.productName}</div>
              <div className="text-muted-foreground">
                {t("staff.orders.table.quantity")}: {order.quantity}
              </div>
            </div>
            <ResolvedVsChargedPrice
              resolvedPrice={order.resolvedPrice}
              unitPrice={order.unitPrice}
            />
          </div>

          {liveAvailableQuantity != null && (
            <div className="text-muted-foreground">
              {t("staff.orders.showDialog.liveAvailability")}: {liveAvailableQuantity}
            </div>
          )}

          <Separator />

          <div>
            <div className="font-medium">{order.contactName}</div>
            <div className="text-muted-foreground">{order.contactPhone}</div>
            {order.wilaya && (
              <div className="text-muted-foreground">
                {order.wilaya.frName}
                {order.commune ? `, ${order.commune.frName}` : ""}
                {order.address ? ` — ${order.address}` : ""}
              </div>
            )}
            {order.deliveryCompany && (
              <div className="text-muted-foreground">
                {order.deliveryCompany} · {order.trackingNumber ?? "—"}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="mb-1 font-medium">{t("staff.orders.showDialog.timeline")}</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                {formatDateTime(order.placedAt, language)} — {t("orders.pending")}
              </li>
              {order.confirmedAt && (
                <li>
                  {formatDateTime(order.confirmedAt, language)} — {t("orders.confirmed")}
                </li>
              )}
              {order.deliveredAt && (
                <li>
                  {formatDateTime(order.deliveredAt, language)} — {t("orders.completed")}
                </li>
              )}
              {order.cancelledAt && (
                <li>
                  {formatDateTime(order.cancelledAt, language)} — {t("orders.cancelled")}
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-center justify-between font-semibold">
            <span>{t("staff.orders.table.total")}</span>
            <span>{formatDZD(order.totalAmount, language)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
