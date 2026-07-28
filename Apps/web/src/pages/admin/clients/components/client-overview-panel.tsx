import { Wallet, CreditCard, ShoppingCart, Package, Coins } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import type { AdminClientOverviewDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";

interface ClientOverviewPanelProps {
  overview?: AdminClientOverviewDto;
  isLoading?: boolean;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

// S8 J4 — the client-detail Overview tab. Money figures (totalSold/totalPaid/credit) are
// PosClient caches read as-is by the backend — D5's ledger is their only writer, this panel
// never recomputes them. totalProductQuantity is Σ InvoiceLine.quantity over the client's
// non-cancelled invoices (S8 R1) — source-agnostic across SALE/ORDER/REPAIR. A client who has
// never been approved has no linked PosClient (posClientId absent): the money cards read 0 with
// a one-line note, rather than an error state.
export function ClientOverviewPanel({ overview, isLoading = false }: ClientOverviewPanelProps) {
  const { t, language } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const notApproved = overview != null && overview.posClientId == null;

  return (
    <div className="space-y-3">
      {notApproved && (
        <p className="text-sm text-muted-foreground">{t("admin.clients.overview.notApproved")}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label={t("admin.clients.overview.totalSold")}
          value={formatDZD(overview?.totalSold ?? 0, language)}
        />
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label={t("admin.clients.overview.totalPaid")}
          value={formatDZD(overview?.totalPaid ?? 0, language)}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label={t("admin.clients.overview.credit")}
          value={formatDZD(overview?.credit ?? 0, language)}
        />
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label={t("admin.clients.overview.orderCount")}
          value={formatNumber(overview?.orderCount ?? 0)}
        />
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label={t("admin.clients.overview.productQuantity")}
          value={formatNumber(overview?.totalProductQuantity ?? 0)}
        />
      </div>
    </div>
  );
}
