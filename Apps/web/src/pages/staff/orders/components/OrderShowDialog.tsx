import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { OrderStatus, type OrderDto } from "@dragon-telecom/contract";

interface OrderShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  /** Live re-check (STF-04 §UI: "live availability re-check") — the caller's own
   * useCatalogProduct(order.productId) read, passed in rather than fetched here. */
  liveAvailableQuantity?: number;
  /** ADM-09 adds cancel/return; both are absent for scope="staff" (STF-04 §Interactions). */
  scope?: "staff" | "admin";
  /** Sprint 6 addition — this dialog is the only place a row's forward-state/cancel/return
   * actions can be launched from (OrdersTable has no per-row action column); mirrors
   * SaleDetailDrawer's own action-footer pattern (same cluster, same sprint). Each callback
   * is optional so the dialog stays a pure read view when none are wired (e.g. tests). */
  onConfirm?: () => void;
  onUpdateStatus?: () => void;
  onCancel?: () => void;
  onReturn?: () => void;
}

// Dumb, props-only (Sprint 4, action footer added Sprint 6) — Sprint 6 wires this to the row
// click + a live product read + the mutation dialogs.
export function OrderShowDialog({
  open,
  onOpenChange,
  order,
  liveAvailableQuantity,
  scope = "staff",
  onConfirm,
  onUpdateStatus,
  onCancel,
  onReturn,
}: OrderShowDialogProps) {
  const { t, language } = useTranslation();

  if (!order) return null;

  const showConfirm = order.status === OrderStatus.PENDING && !!onConfirm;
  const showUpdateStatus =
    !!onUpdateStatus &&
    [OrderStatus.CONFIRMED, OrderStatus.PACKAGED, OrderStatus.IN_DELIVERY].includes(order.status);
  const showCancel = scope === "admin" && order.canBeCancelled && !!onCancel;
  const showReturn = scope === "admin" && order.status === OrderStatus.COMPLETED && !!onReturn;

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

          {(showConfirm || showUpdateStatus || showCancel || showReturn) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {showConfirm && (
                  <Button size="sm" onClick={onConfirm}>
                    {t("staff.orders.confirmDialog.submit")}
                  </Button>
                )}
                {showUpdateStatus && (
                  <Button size="sm" variant="outline" onClick={onUpdateStatus}>
                    {t("staff.orders.statusDialog.title")}
                  </Button>
                )}
                {showReturn && (
                  <Button size="sm" variant="outline" onClick={onReturn}>
                    {t("admin.orders.returnDialog.title")}
                  </Button>
                )}
                {showCancel && (
                  <Button size="sm" variant="destructive" onClick={onCancel}>
                    {t("admin.orders.cancelDialog.title")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
