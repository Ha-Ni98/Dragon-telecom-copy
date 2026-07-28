import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { ReturnDto } from "@dragon-telecom/contract";

interface ReturnDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ReturnDto | null;
}

// Dumb, props-only — no fetch: the row already carries its lines inline (R1), so opening this
// dialog is purely a render of data already in hand.
export function ReturnDetailDialog({ open, onOpenChange, item }: ReturnDetailDialogProps) {
  const { t, language } = useTranslation();

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.sales.returnDetail.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="text-muted-foreground">
            <span className="font-mono">{item.reference}</span> ·{" "}
            <span className="font-mono">{item.saleReference}</span>
          </div>

          <div className="space-y-3">
            {item.lines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="font-medium">{line.productName}</div>
                  <div className="text-muted-foreground">
                    {t("admin.sales.returnDetail.quantity")}: {line.quantity} ·{" "}
                    {t("admin.sales.returnDetail.unitPrice")}: {formatDZD(line.unitPrice, language)}
                  </div>
                  <div className="text-muted-foreground">
                    {t("admin.sales.returnDetail.restock")}:{" "}
                    {line.restock
                      ? t("admin.sales.returnDetail.restockYes")
                      : t("admin.sales.returnDetail.restockNo")}
                  </div>
                </div>
                <div className="font-semibold">
                  {t("admin.sales.returnDetail.refundAmount")}:{" "}
                  {formatDZD(line.refundAmount, language)}
                </div>
              </div>
            ))}
          </div>

          {item.reason && (
            <div>
              <div className="font-medium">{t("admin.sales.returnDetail.reason")}</div>
              <div className="text-muted-foreground">{item.reason}</div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between font-semibold">
            <span>{t("admin.sales.returnDetail.total")}</span>
            <span>{formatDZD(item.refundAmount, language)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
