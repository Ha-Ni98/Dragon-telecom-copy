import { useState } from "react";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { CashRegisterSection } from "@/pages/admin/cash-register/components/cash-register-section";
import { CashRegisterSections } from "@/pages/admin/cash-register/components/cash-register-sections";
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
// S35 — adds the standalone Payments section, the net cash movement card (shared with the staff
// dashboard via CashRegisterSections) and the admin-only Profit section.
export default function AdminCashRegister() {
  const { t, language } = useTranslation();
  const today = storeLocalDate();
  const [date, setDate] = useState(today);
  const [drillTarget, setDrillTarget] = useState<CashRegisterDrillTarget | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useCashRegister({ date });

  const money = (amount: number) => formatDZD(amount, language);
  const openDrill = (drill: CashRegisterDrill, titleKey: string) =>
    setDrillTarget({ drill, titleKey });

  // S35 — ADMIN ONLY: the profit figures exist only on the admin DTO (the staff DTO has no such
  // key). Not clickable: their documents are the Sales / Repairs / Completed-orders drill lists,
  // which carry a profit column. Supplier payments are not an expense and never reduce profit.
  const profitFigures: CashRegisterFigure[] = data
    ? [
        { labelKey: "admin.cashRegister.profit.sales", value: money(data.profit.sales) },
        { labelKey: "admin.cashRegister.profit.repairs", value: money(data.profit.repairs) },
        { labelKey: "admin.cashRegister.profit.orders", value: money(data.profit.orders) },
        {
          labelKey: "admin.cashRegister.profit.returnsReversed",
          value: money(data.profit.returnsReversed),
          detail: t("admin.cashRegister.profit.returnsBreakdown", {
            sales: money(data.profit.saleReturnsReversed),
            orders: money(data.profit.orderReturnsReversed),
            repairs: money(data.profit.repairReturnsReversed),
          }),
        },
        { labelKey: "admin.cashRegister.profit.net", value: money(data.profit.net) },
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

      {data && (
        <>
          <CashRegisterSections data={data} onDrill={openDrill} />
          <CashRegisterSection
            titleKey="admin.cashRegister.profit.title"
            icon={<TrendingUp className="h-5 w-5" />}
            figures={profitFigures}
          />
          <p className="text-xs text-muted-foreground">{t("admin.cashRegister.profit.note")}</p>
        </>
      )}

      <CashRegisterDrillDialog
        date={date}
        target={drillTarget}
        onClose={() => setDrillTarget(null)}
      />
    </div>
  );
}
