import { LayoutDashboard, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useTranslation } from "@/hooks/useTranslation";

// Placeholder admin dashboard. Replace the static cards with real data hooks as you add
// modules (the delivery-companies page is the wired reference — copy its shape).
export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("admin.dashboard.title")} subtitle={t("admin.dashboard.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<LayoutDashboard className="h-5 w-5" />}
          label={t("admin.dashboard.cards.overview")}
          value="—"
        />
        <StatCard
          icon={<Truck className="h-5 w-5" />}
          label={t("admin.dashboard.cards.deliveryCompanies")}
          value="—"
        />
      </div>
    </div>
  );
}
