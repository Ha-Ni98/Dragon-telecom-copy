import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { Receipt, CreditCard, History } from "lucide-react";
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
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} DZD`;
}

// ADM-11 detail drawer — headline comes from the clicked row (no re-fetch, plan §Page 4). Sales/
// Payments both fetch as soon as a client is selected (Sprint 5) rather than strictly per-tab —
// the Credit history tab needs both row sets merged regardless of which sub-tab is active, so
// gating either query behind its own tab would leave Credit history incomplete. Computed by the
// parent page via `useMemo`, not fetched here.
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
}: PosClientDetailDrawerProps) {
  const { t } = useTranslation();
  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
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
          <TabsList className="grid w-full grid-cols-3">
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
