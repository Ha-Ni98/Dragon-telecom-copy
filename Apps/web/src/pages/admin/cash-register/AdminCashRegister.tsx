import { useState } from "react";
import {
  AlertTriangle,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CashRegisterSection } from "@/pages/admin/cash-register/components/cash-register-section";
import { CashRegisterDrillDialog } from "@/pages/admin/cash-register/components/cash-register-drill-dialog";
import { useCashRegister } from "@/hooks/useStatistics";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { CashRegisterDrill, storeLocalDate } from "@dragon-telecom/contract";
import type { CashRegisterDrillTarget, CashRegisterFigure } from "@/types/cash-register.types";

// S33 — the Caisse (ADMIN only — also guarded by a nested RoleGuard in App.tsx, since the /admin
// route group admits STAFF too). One Africa/Algiers day, today by default: every figure is a
// stored value summed in SQL over that day, each section anchored on the timestamp the money
// moved (plan S33 §0.3–§0.4). Clicking a figure lists the documents behind it, filtered by the
// server with the very same day bounds and where-clause as the figure.
export default function AdminCashRegister() {
  const { t, language } = useTranslation();
  const today = storeLocalDate();
  const [date, setDate] = useState(today);
  const [drillTarget, setDrillTarget] = useState<CashRegisterDrillTarget | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useCashRegister({ date });

  const money = (amount: number) => formatDZD(amount, language);
  const openDrill = (drill: CashRegisterDrill, titleKey: string) =>
    setDrillTarget({ drill, titleKey });

  const sections: { titleKey: string; icon: JSX.Element; figures: CashRegisterFigure[] }[] = data
    ? [
        {
          titleKey: "admin.cashRegister.sales.title",
          icon: <Receipt className="h-5 w-5" />,
          figures: [
            {
              labelKey: "admin.cashRegister.sales.count",
              value: String(data.sales.count),
              drill: CashRegisterDrill.SALES,
            },
            { labelKey: "admin.cashRegister.sales.totalSold", value: money(data.sales.totalSold) },
            { labelKey: "admin.cashRegister.sales.totalPaid", value: money(data.sales.totalPaid) },
            { labelKey: "admin.cashRegister.sales.newCredit", value: money(data.sales.newCredit) },
          ],
        },
        {
          titleKey: "admin.cashRegister.returns.title",
          icon: <Undo2 className="h-5 w-5" />,
          figures: [
            {
              labelKey: "admin.cashRegister.returns.count",
              value: String(data.returns.count),
              drill: CashRegisterDrill.RETURNS,
            },
            {
              labelKey: "admin.cashRegister.returns.totalRefunded",
              value: money(data.returns.totalRefunded),
            },
          ],
        },
        {
          titleKey: "admin.cashRegister.repairs.title",
          icon: <Wrench className="h-5 w-5" />,
          figures: [
            {
              labelKey: "admin.cashRegister.repairs.count",
              value: String(data.repairs.count),
              drill: CashRegisterDrill.REPAIRS_PICKED_UP,
            },
            { labelKey: "admin.cashRegister.repairs.paid", value: money(data.repairs.paidAmount) },
            {
              labelKey: "admin.cashRegister.repairs.unpaid",
              value: money(data.repairs.unpaidAmount),
            },
            // P5 — "refunded repair amount (where any)".
            ...(data.repairs.refundCount > 0
              ? [
                  {
                    labelKey: "admin.cashRegister.repairs.refunded",
                    value: t("admin.cashRegister.repairs.refundedValue", {
                      amount: money(data.repairs.refundedAmount),
                      count: data.repairs.refundCount,
                    }),
                    drill: CashRegisterDrill.REPAIR_REFUNDS,
                  },
                ]
              : []),
          ],
        },
        {
          titleKey: "admin.cashRegister.orders.title",
          icon: <ShoppingCart className="h-5 w-5" />,
          figures: [
            {
              labelKey: "admin.cashRegister.orders.confirmed",
              value: String(data.orders.confirmedCount),
              drill: CashRegisterDrill.ORDERS_CONFIRMED,
            },
            {
              labelKey: "admin.cashRegister.orders.inDelivery",
              value: String(data.orders.inDeliveryCount),
              drill: CashRegisterDrill.ORDERS_IN_DELIVERY,
            },
            {
              labelKey: "admin.cashRegister.orders.completed",
              value: String(data.orders.completedCount),
              drill: CashRegisterDrill.ORDERS_COMPLETED,
            },
            {
              labelKey: "admin.cashRegister.orders.completedPaid",
              value: money(data.orders.completedPaid),
            },
          ],
        },
        {
          titleKey: "admin.cashRegister.suppliers.title",
          icon: <Truck className="h-5 w-5" />,
          figures: [
            {
              labelKey: "admin.cashRegister.suppliers.invoiceCount",
              value: String(data.suppliers.invoiceCount),
              drill: CashRegisterDrill.SUPPLIER_INVOICES,
            },
            {
              labelKey: "admin.cashRegister.suppliers.totalInvoiced",
              value: money(data.suppliers.totalInvoiced),
            },
            {
              labelKey: "admin.cashRegister.suppliers.totalPaid",
              value: money(data.suppliers.totalPaid),
              drill: CashRegisterDrill.SUPPLIER_PAYMENTS,
            },
            // May be negative: more was paid to suppliers than invoiced that day.
            {
              labelKey: "admin.cashRegister.suppliers.newCredit",
              value: money(data.suppliers.newCredit),
            },
          ],
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <PageHeader title={t("admin.cashRegister.pageTitle")} />
          <p className="text-sm text-muted-foreground">{t("admin.cashRegister.boundaryNote")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label={t("admin.cashRegister.dateLabel")}
            className="w-40"
          />
          <Button variant={date === today ? "default" : "outline"} onClick={() => setDate(today)}>
            {t("admin.cashRegister.today")}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.actions.refresh")}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="space-y-3">
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title={t("common.errorLoadingData")}
            body={date}
          />
          <Button variant="outline" onClick={() => refetch()}>
            {t("common.actions.refresh")}
          </Button>
        </div>
      )}

      {sections.map((section) => (
        <CashRegisterSection
          key={section.titleKey}
          titleKey={section.titleKey}
          icon={section.icon}
          figures={section.figures}
          onDrill={openDrill}
        />
      ))}

      <CashRegisterDrillDialog
        date={date}
        target={drillTarget}
        onClose={() => setDrillTarget(null)}
      />
    </div>
  );
}
