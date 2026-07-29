import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";
import { OrderStatus, orderTransitionsFrom, type OrderDto } from "@dragon-telecom/contract";

interface OrderShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDto | null;
  /** Live re-check (STF-04 §UI: "live availability re-check") — the caller's own
   * useCatalogProduct(order.productId) read, passed in rather than fetched here. */
  liveAvailableQuantity?: number;
  /** Sprint 6 addition — this dialog is the only place a row's status/cancel/return actions can
   * be launched from (OrdersTable has no per-row action column); mirrors SaleDetailDrawer's own
   * action-footer pattern (same cluster, same sprint). Each callback is optional so the dialog
   * stays a pure read view when none are wired (e.g. tests). S10/R3 — confirm is folded into
   * onUpdateStatus (there is no separate confirm action any more). */
  onUpdateStatus?: () => void;
  onCancel?: () => void;
  onReturn?: () => void;
}

// Dumb, props-only (Sprint 4, action footer added Sprint 6) — Sprint 6 wires this to the row
// click + a live product read + the mutation dialogs. S18/D-1 — cancel/return used to be
// admin-only (`scope === "admin"`); staff holding the orders page gets them too, so the gate
// (and the now-unused `scope` prop) is gone — presence is decided purely by `onCancel`/`onReturn`
// being wired, same as `onUpdateStatus`.
export function OrderShowDialog({
  open,
  onOpenChange,
  order,
  liveAvailableQuantity,
  onUpdateStatus,
  onCancel,
  onReturn,
}: OrderShowDialogProps) {
  const { t, language } = useTranslation();

  if (!order) return null;

  // S10/R3 — the status dialog now covers every forward move, including PENDING->CONFIRMED
  // (confirm is folded in), so the button shows whenever the per-type machine offers any target.
  const showUpdateStatus =
    !!onUpdateStatus && orderTransitionsFrom(order.orderType, order.status).length > 0;
  const showCancel = order.canBeCancelled && !!onCancel;
  const showReturn = order.status === OrderStatus.COMPLETED && !!onReturn;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("staff.orders.showDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div>
                <div className="font-medium">{line.productName}</div>
                <div className="text-muted-foreground">
                  {t("staff.orders.table.quantity")}: {line.quantity}
                </div>
              </div>
              <ResolvedVsChargedPrice
                resolvedPrice={line.resolvedPrice}
                unitPrice={line.unitPrice}
              />
            </div>
          ))}

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

          {(showUpdateStatus || showCancel || showReturn) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
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
