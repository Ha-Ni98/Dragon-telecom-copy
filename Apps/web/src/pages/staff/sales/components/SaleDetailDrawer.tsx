import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { SaleStatus, type SaleDto } from "@dragon-telecom/contract";

interface SaleDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleDto | null;
  onReprint: () => void;
  onResumeDraft?: () => void;
  onIssueReturn?: () => void;
  /** ADM-10 §UI — cost/profit per line, credit snapshot, invoice link, Issue return — admin only. */
  scope?: "staff" | "admin";
  /** 403 view (STF-05 §Data dependencies: "defense in depth"). */
  forbidden?: boolean;
  invoiceNumber?: string;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useSale(scope, reference) around this.
export function SaleDetailDrawer({
  open,
  onOpenChange,
  sale,
  onReprint,
  onResumeDraft,
  onIssueReturn,
  scope = "staff",
  forbidden,
  invoiceNumber,
}: SaleDetailDrawerProps) {
  const { t, language } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("staff.sales.detail.title")}</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {forbidden && (
            <p className="text-sm text-destructive">{t("staff.sales.detail.forbidden")}</p>
          )}

          {!forbidden && sale && (
            <>
              <div className="divide-y divide-border rounded-xl border border-border">
                {sale.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{line.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.quantity} × — {line.serialNumbers?.join(", ")}
                      </div>
                      {scope === "admin" && line.profit != null && (
                        <div className="text-xs text-muted-foreground">
                          {t("admin.sales.detail.costOfGoods")}:{" "}
                          {formatDZD(line.costOfGoods ?? 0, language)} ·{" "}
                          {t("admin.sales.detail.profit")}: {formatDZD(line.profit, language)}
                        </div>
                      )}
                    </div>
                    <ResolvedVsChargedPrice
                      resolvedPrice={line.resolvedPrice}
                      unitPrice={line.unitPrice}
                    />
                    <div className="w-20 text-right font-semibold">
                      {formatDZD(line.lineTotal, language)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("staff.sales.table.total")}</span>
                <span className="font-semibold">{formatDZD(sale.totalAmount, language)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("staff.sales.table.paid")}</span>
                <span>{formatDZD(sale.paidAmount, language)}</span>
              </div>

              {scope === "admin" && sale.previousCredit != null && sale.newCredit != null && (
                <CreditMovementPreview
                  previousCredit={sale.previousCredit}
                  newCredit={sale.newCredit}
                />
              )}

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onReprint}>
                  <Printer className="mr-1 h-3.5 w-3.5" />
                  {t("staff.sales.detail.reprint")}
                </Button>
                {sale.status === SaleStatus.DRAFT && onResumeDraft && (
                  <Button variant="outline" size="sm" onClick={onResumeDraft}>
                    {t("staff.sales.detail.resumeDraft")}
                  </Button>
                )}
                {scope === "admin" && invoiceNumber && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/invoices?number=${invoiceNumber}`}>
                      {t("admin.sales.detail.invoiceLink")}
                    </Link>
                  </Button>
                )}
                {scope === "admin" && onIssueReturn && (
                  <Button size="sm" onClick={onIssueReturn}>
                    {t("admin.sales.detail.issueReturn")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
