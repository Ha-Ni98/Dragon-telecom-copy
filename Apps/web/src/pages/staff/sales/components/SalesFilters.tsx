import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SaleStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

const STATUS_LABEL_KEY: Record<SaleStatus, string> = {
  [SaleStatus.DRAFT]: "staff.sales.status.draft",
  [SaleStatus.COMPLETED]: "staff.sales.status.completed",
  [SaleStatus.RETURNED]: "orders.returned",
  [SaleStatus.PARTIALLY_RETURNED]: "orders.returned",
  [SaleStatus.CANCELLED]: "orders.cancelled",
};

interface SalesFiltersProps {
  status?: SaleStatus;
  onStatusChange: (status?: SaleStatus) => void;
  /** Admin-only extras (ADM-10 §UI) — omitted entirely for STF-05 (status only). */
  scope?: "staff" | "admin";
  from?: string;
  onFromChange?: (from: string) => void;
  to?: string;
  onToChange?: (to: string) => void;
  sellerName?: string;
  onSellerSearch?: (query: string) => void;
  posClientName?: string;
  onPosClientSearch?: (query: string) => void;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useSales(scope, query) around this.
export function SalesFilters({
  status,
  onStatusChange,
  scope = "staff",
  from,
  onFromChange,
  to,
  onToChange,
  sellerName,
  onSellerSearch,
  posClientName,
  onPosClientSearch,
}: SalesFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={status ?? "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? undefined : (v as SaleStatus))}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("staff.orders.tabs.all")}</SelectItem>
          {Object.values(SaleStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {t(STATUS_LABEL_KEY[s])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scope === "admin" && (
        <>
          <Input
            type="date"
            value={from ?? ""}
            onChange={(e) => onFromChange?.(e.target.value)}
            className="w-36"
            aria-label={t("admin.sales.filters.dateRange")}
          />
          <Input
            type="date"
            value={to ?? ""}
            onChange={(e) => onToChange?.(e.target.value)}
            className="w-36"
          />
          <Input
            value={sellerName ?? ""}
            onChange={(e) => onSellerSearch?.(e.target.value)}
            placeholder={t("admin.sales.filters.seller")}
            className="w-40"
          />
          <Input
            value={posClientName ?? ""}
            onChange={(e) => onPosClientSearch?.(e.target.value)}
            placeholder={t("admin.sales.filters.posClient")}
            className="w-44"
          />
        </>
      )}
    </div>
  );
}
