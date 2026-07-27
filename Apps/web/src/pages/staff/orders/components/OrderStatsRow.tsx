import { Clock, CheckCircle, Truck, BadgeCheck, XCircle } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/StatCardSkeleton";
import { OrderStatusBadge } from "@/components/shared/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { OrderStatus, type OrderStatsDto } from "@dragon-telecom/contract";

interface OrderStatsRowProps {
  stats?: OrderStatsDto;
  isLoading?: boolean;
}

// Driven by CARDS.map() rather than five copy-pasted JSX blocks — the copy-paste shape is what
// produced the aria bug documented in stage-03-sprint3-complete.
const CARDS: {
  key: keyof OrderStatsDto;
  icon: React.ReactNode;
  labelKey: string;
  status: OrderStatus;
}[] = [
  {
    key: "pending",
    icon: <Clock className="h-5 w-5" />,
    labelKey: "staff.orders.stats.pending",
    status: OrderStatus.PENDING,
  },
  {
    key: "confirmed",
    icon: <CheckCircle className="h-5 w-5" />,
    labelKey: "staff.orders.stats.confirmed",
    status: OrderStatus.CONFIRMED,
  },
  {
    key: "inDelivery",
    icon: <Truck className="h-5 w-5" />,
    labelKey: "staff.orders.stats.inDelivery",
    status: OrderStatus.IN_DELIVERY,
  },
  // S11 additions — completed and cancelled-by-client, each carrying a status-colored badge (R1).
  {
    key: "completed",
    icon: <BadgeCheck className="h-5 w-5" />,
    labelKey: "staff.orders.stats.completed",
    status: OrderStatus.COMPLETED,
  },
  {
    key: "cancelledByClient",
    icon: <XCircle className="h-5 w-5" />,
    labelKey: "staff.orders.stats.cancelledByClient",
    status: OrderStatus.CANCELLED_BY_CLIENT,
  },
];

// Dumb, props-only (Sprint 4) — Sprint 6 wires useOrderStats(scope) around this. S11 adds a
// status-colored badge to each card (`trend` slot) and two more cards (completed, cancelled by
// client), per the owner's R1 decision — not a percentage-of-total figure.
export function OrderStatsRow({ stats, isLoading }: OrderStatsRowProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((card) => (
        <StatCard
          key={card.key}
          icon={card.icon}
          label={t(card.labelKey)}
          value={String(stats?.[card.key] ?? 0)}
          trend={<OrderStatusBadge status={card.status} />}
        />
      ))}
    </div>
  );
}
