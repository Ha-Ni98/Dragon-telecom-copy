import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { Receipt, CreditCard, History, ShoppingBag } from "lucide-react";
import { ClientPurchasedProductsTab } from "@/pages/admin/clients/components/client-purchased-products-tab";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";
import type { PosClientDto, SaleDto, ClientPaymentDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface CreditHistoryRow {
  id: string;
  date: string;
  previousCredit: number;
  newCredit: number;
}

interface PosClientDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: PosClientDto | null;
  sales?: SaleDto[];
  salesLoading?: boolean;
  salesError?: boolean;
  payments?: ClientPaymentDto[];
  paymentsLoading?: boolean;
  paymentsError?: boolean;
  creditHistory?: CreditHistoryRow[];
  onRecordPayment?: () => void;
  /** S36 — picks the Products-bought endpoints (and link scope) for this drawer. */
  scope: "staff" | "admin";
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-11 detail drawer — headline comes from the clicked row (no re-fetch, plan §Page 4). Sales/
// Payments both fetch as soon as a client is selected (Sprint 5) rather than strictly per-tab —
// the Credit history tab needs both row sets merged regardless of which sub-tab is active, so
// gating either query behind its own tab would leave Credit history incomplete. Computed by the
// parent page via `useMemo`, not fetched here.
// S36 — fourth tab "Products bought": the client's WHOLE purchase history (every seller — owner Q1;
// POS sales + the linked web account's orders), fetched only when the tab opens. The drawer is
// wider (sm:max-w-2xl) so its five-column table fits.
export function PosClientDetailDrawer({
  open,
  onOpenChange,
  client,
  sales = [],
  salesLoading = false,
  salesError = false,
  payments = [],
  paymentsLoading = false,
  paymentsError = false,
  creditHistory = [],
  onRecordPayment,
  scope,
}: PosClientDetailDrawerProps) {
  const { t } = useTranslation();
  // Declared before the early return (hooks rule); part of the purchase-history query key.
  const purchaseOwner = useMemo<PurchaseHistoryOwner>(
    () => ({ kind: "posClient", scope, id: client?.id ?? "" }),
    [scope, client?.id],
  );
  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{client.name}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 py-4 text-sm">
          <div>
            <div className="text-muted-foreground">{t("admin.posClients.table.credit")}</div>
            <div className="font-medium">{formatCurrency(client.credit)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("admin.posClients.table.totalPaid")}</div>
            <div className="font-medium">{formatCurrency(client.totalPaid)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("admin.posClients.table.totalSold")}</div>
            <div className="font-medium">{formatCurrency(client.totalSold)}</div>
          </div>
        </div>

        {onRecordPayment && (
          <Button variant="outline" size="sm" onClick={onRecordPayment} className="mb-4">
            {t("admin.posClients.detail.recordPayment")}
          </Button>
        )}

        <Tabs defaultValue="sales">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales" className="gap-2">
              <Receipt className="h-4 w-4" />
              {t("admin.posClients.detail.tabs.sales")}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              {t("admin.posClients.detail.tabs.payments")}
            </TabsTrigger>
            <TabsTrigger value="credit" className="gap-2">
              <History className="h-4 w-4" />
              {t("admin.posClients.detail.tabs.creditHistory")}
            </TabsTrigger>
            <TabsTrigger value="purchased" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t("admin.posClients.detail.tabs.purchasedProducts")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            {salesLoading ? (
              <TableSkeleton rows={4} columns={2} />
            ) : salesError ? (
              <NotFoundState title={t("admin.posClients.error")} body="" />
            ) : sales.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={t("common.noDataAvailable")}
                body=""
              />
            ) : (
              <ul className="space-y-2">
                {sales.map((sale) => (
                  <li key={sale.id} className="flex justify-between text-sm">
                    <span>{sale.reference}</span>
                    <span>{formatCurrency(sale.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="payments">
            {paymentsLoading ? (
              <TableSkeleton rows={4} columns={2} />
            ) : paymentsError ? (
              <NotFoundState title={t("admin.posClients.error")} body="" />
            ) : payments.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-6 w-6" />}
                title={t("common.noDataAvailable")}
                body=""
              />
            ) : (
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li key={payment.reference} className="flex justify-between text-sm">
                    <span>{payment.reference}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="credit">
            {creditHistory.length === 0 ? (
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title={t("admin.posClients.detail.creditHistory.empty")}
                body=""
              />
            ) : (
              <div className="space-y-2">
                {creditHistory.map((row) => (
                  <div key={row.id} className="space-y-1">
                    <div className="text-xs text-muted-foreground">{row.date}</div>
                    <CreditMovementPreview
                      previousCredit={row.previousCredit}
                      newCredit={row.newCredit}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchased">
            <ClientPurchasedProductsTab owner={purchaseOwner} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
