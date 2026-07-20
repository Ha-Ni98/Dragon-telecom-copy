import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { OrderStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { ORDER_STATUS_LABEL_KEY } from "@/pages/staff/orders/order-status-labels";

const TAB_STATUSES = [
  undefined,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKAGED,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
] as const;

interface OrderStatusTabsProps {
  status?: OrderStatus;
  onStatusChange: (status?: OrderStatus) => void;
  search: string;
  onSearchChange: (search: string) => void;
  /** A2 — date range, gated: only rendered once BackofficeOrdersQuery carries from/to. */
  from?: string;
  to?: string;
  onFromChange?: (from: string) => void;
  onToChange?: (to: string) => void;
}

// Dumb, props-only (Sprint 4) — default tab is PENDING (STF-04 §UI); Sprint 6 wires
// useOrdersList(scope, query) around this.
export function OrderStatusTabs({
  status,
  onStatusChange,
  search,
  onSearchChange,
  from,
  onFromChange,
  to,
  onToChange,
}: OrderStatusTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs
        value={status ?? "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? undefined : (v as OrderStatus))}
      >
        <TabsList>
          {TAB_STATUSES.map((s) => (
            <TabsTrigger key={s ?? "all"} value={s ?? "all"}>
              {s ? t(ORDER_STATUS_LABEL_KEY[s]) : t("staff.orders.tabs.all")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("staff.orders.search.placeholder")}
            className="w-56 pl-9"
          />
        </div>
        {onFromChange && onToChange && (
          <>
            <Input
              type="date"
              value={from ?? ""}
              onChange={(e) => onFromChange(e.target.value)}
              className="w-36"
              aria-label={t("staff.orders.dateRange.label")}
            />
            <Input
              type="date"
              value={to ?? ""}
              onChange={(e) => onToChange(e.target.value)}
              className="w-36"
            />
          </>
        )}
      </div>
    </div>
  );
}
