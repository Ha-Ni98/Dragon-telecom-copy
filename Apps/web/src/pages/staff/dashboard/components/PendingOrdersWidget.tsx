import { PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

// Dumb, props-only (Sprint 4). StaffDashboardDto.myPendingOrdersCount is server-gated optional
// (present only when the caller holds STAFF_ORDERS) — `count === undefined` means "not granted",
// distinct from `count === 0` ("granted, nothing pending"); the widget renders nothing at all
// in the former case (plan.md STF-01 §3). /staff/orders is unshipped (same scope-confinement as
// MyDraftsList's "Finish in POS") so this is a static count, not a link, until that page exists.
interface PendingOrdersWidgetProps {
  count?: number;
  isLoading?: boolean;
}

export function PendingOrdersWidget({ count, isLoading = false }: PendingOrdersWidgetProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-10 rounded-xl mb-3" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-12" />
        </CardContent>
      </Card>
    );
  }

  if (count === undefined) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
          <PackageSearch className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">{t("orders.pendingOrders")}</p>
        <p className="mt-1 text-2xl font-extrabold text-foreground">{count}</p>
      </CardContent>
    </Card>
  );
}
