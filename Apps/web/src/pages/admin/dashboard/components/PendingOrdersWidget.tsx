import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionRetryChip } from "./SectionRetryChip";
import type { AdminDashboardDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatDateTime } from "@/lib/utils";

// Dumb, props-only (Sprint 4). Sprint 6 wires useAdminDashboard() around this. Row → /admin/orders
// (ADM-09's confirm dialog lives there — plan.md scope confinement, not this widget's concern).
// Same DashboardOrderSummarySchema shape as recentOrders (Sprint 3's RecentOrdersTable), but kept
// as its own compact list rather than reusing that DataTable — this one's rows are actionable
// (whole-row <Link>), a different interaction than the read-only recent-orders table.
type PendingOrder = AdminDashboardDto["pendingOrders"][number];

interface PendingOrdersWidgetProps {
  orders?: PendingOrder[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function PendingOrdersWidget({
  orders,
  isLoading = false,
  isError = false,
  onRetry,
}: PendingOrdersWidgetProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{t("orders.pendingOrders")}</CardTitle>
          <CardDescription>{t("orders.description")}</CardDescription>
        </div>
        {isError && <SectionRetryChip onRetry={onRetry} />}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))
        ) : isError ? null : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <ShoppingCart className="h-6 w-6" />
            <p className="text-sm">{t("orders.noPendingOrders")}</p>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <Link
                key={order.id}
                to="/admin/orders"
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"
              >
                <span className="font-medium">{order.reference}</span>
                <span className="text-muted-foreground">{formatDateTime(order.placedAt)}</span>
                <span className="font-medium">{formatDZD(order.totalAmount)}</span>
              </Link>
            ))}
            <Link
              to="/admin/orders"
              className="block text-center text-sm text-primary hover:underline"
            >
              {t("orders.viewAll")}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
