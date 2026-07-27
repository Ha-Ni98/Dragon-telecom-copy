import { AlertTriangle, X, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import type { OrderDto } from "@dragon-telecom/contract";
import { formatDZD, formatDateTime } from "@/lib/utils";

// set-02 Sprint 3 retype — was OrderWithDetails (orderLines[], a preview of "up to 3 items,
// +N more"). OrderDto was single-product at the time, so the old orderItems/moreItems preview
// section was dropped in favor of the one-line summary below (its two translation keys,
// cancellation.orderItems/moreItems, are unused but left in translations.json, matching this
// codebase's no-key-removal convention). D1 (S9) brought orders.lines[] back — the summary below
// now joins every line rather than a single product/quantity pair, but still as one line, not a
// re-introduced multi-row preview.
// Stays a plain confirm (no reason field) per Sprint 1's D-decision: the client MY_CANCEL route
// takes no request body.
interface CancelOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  order: OrderDto | null;
  isCancelling?: boolean;
}

export function CancelOrderDialog({
  isOpen,
  onClose,
  onConfirm,
  order,
  isCancelling = false,
}: CancelOrderDialogProps) {
  const { t } = useTranslation();

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {t("orders.cancelOrder")}
          </DialogTitle>
          <DialogDescription>{t("orders.cancelOrderConfirm")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{order.reference}</h3>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                {t("orders.pending")}
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDateTime(order.placedAt)}</span>
              </div>
              <div>
                {order.lines.map((line) => `${line.productName} × ${line.quantity}`).join(", ")}
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>{formatDZD(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Warning Message */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">{t("cancellation.warning")}</p>
                <p className="text-red-600 mt-1">{t("cancellation.warningMessage")}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isCancelling}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isCancelling}
              className="min-w-[120px]"
            >
              {isCancelling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("cancellation.cancelling")}
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t("orders.cancelOrder")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
