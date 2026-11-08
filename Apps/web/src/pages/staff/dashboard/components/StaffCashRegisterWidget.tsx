import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { CashRegisterSections } from "@/pages/admin/cash-register/components/cash-register-sections";
import { useStaffCashRegister } from "@/hooks/useStatistics";
import { useTranslation } from "@/hooks/useTranslation";

// S35 — the whole-store cash register for today on the staff dashboard. Deliberate exception to
// staff seeing only their own documents (it reports one physical drawer, so a per-seller version
// would match nothing). The DTO carries no profit at all — stripped in the API mapper
// (StaffCashRegisterDto). No drill-through: staff get the figures, not other sellers' documents.
// Silent-hide on error (the STF-01 convention): the widget disappears rather than show an error.
export function StaffCashRegisterWidget() {
  const { t } = useTranslation();
  const { data, isLoading, isError, isFetching, refetch } = useStaffCashRegister();

  if (isError) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("staff.dashboard.cashRegister.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("staff.dashboard.cashRegister.note")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.actions.refresh")}
        </Button>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <CashRegisterSections data={data} />
      )}
    </section>
  );
}
