import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { OrderStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// Dumb, props-only (Sprint 4). Combines PUB-09's two adjacent requirement bullets ("Summary
// chips (counts by status)" + "status filter") into one control — each chip is both the count
// display and the filter trigger. Sprint 5 wires `value`/`onChange` to the URL (?status=) and
// `counts` from an unfiltered useMyOrders({}) query (plan.md D6).
export type OrderFilterValue = OrderStatus | "all";

const STATUS_LABEL_KEY: Record<OrderFilterValue, string> = {
  all: "orders.allOrders",
  [OrderStatus.PENDING]: "orders.pending",
  [OrderStatus.CONFIRMED]: "orders.confirmed",
  [OrderStatus.PACKAGED]: "orders.packaged",
  [OrderStatus.IN_DELIVERY]: "orders.delivery",
  [OrderStatus.COMPLETED]: "orders.completed",
  [OrderStatus.CANCELLED]: "orders.cancelled",
  [OrderStatus.RETURNED]: "orders.returned",
};

const FILTER_ORDER: OrderFilterValue[] = [
  "all",
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKAGED,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
];

interface OrderStatusFiltersProps {
  value: OrderFilterValue;
  onChange: (value: OrderFilterValue) => void;
  counts?: Partial<Record<OrderFilterValue, number>>;
  isLoadingCounts?: boolean;
}

export function OrderStatusFilters({
  value,
  onChange,
  counts,
  isLoadingCounts = false,
}: OrderStatusFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {FILTER_ORDER.map((filter) => {
        const active = value === filter;
        const count = counts?.[filter];
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary-light text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(STATUS_LABEL_KEY[filter])}
            {isLoadingCounts ? (
              <Skeleton className="h-4 w-5 rounded-full" />
            ) : (
              count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    active ? "bg-primary/20" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}
