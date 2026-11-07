import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaleStatus } from "@dragon-telecom/contract";
import { SALE_STATUS_LABEL_KEY } from "@/pages/staff/sales/sale-status-labels";
import { useTranslation } from "@/hooks/useTranslation";

interface SalesFiltersProps {
  status?: SaleStatus;
  onStatusChange: (status?: SaleStatus) => void;
  /** S32 — search by sold product (name or barcode). Both scopes. */
  productQuery: string;
  onProductQueryChange: (query: string) => void;
  /** S32 — the one-click "Today's sales" toggle (Africa/Algiers day). Both scopes. */
  todayActive: boolean;
  onToggleToday: () => void;
  /** S34 — client search (name or phone) in both scopes; seller search and the date range admin-only. */
  clientQuery: string;
  onClientQueryChange: (query: string) => void;
  /** Admin-only extras (ADM-10 §UI: date range, seller) — omitted for STF-05. Product search,
   * client search and Today (S32/S34) are not admin-only. */
  scope?: "staff" | "admin";
  from?: string;
  onFromChange?: (from: string) => void;
  to?: string;
  onToChange?: (to: string) => void;
  sellerQuery?: string;
  onSellerQueryChange?: (query: string) => void;
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useSales(scope, query) around this.
// S34 — every filter here is plain text/enum/date; ids are never resolved in the page.
export function SalesFilters({
  status,
  onStatusChange,
  productQuery,
  onProductQueryChange,
  todayActive,
  onToggleToday,
  clientQuery,
  onClientQueryChange,
  scope = "staff",
  from,
  onFromChange,
  to,
  onToChange,
  sellerQuery,
  onSellerQueryChange,
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
              {t(SALE_STATUS_LABEL_KEY[s])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={productQuery}
        onChange={(e) => onProductQueryChange(e.target.value)}
        placeholder={t("admin.sales.filters.productSearch")}
        className="w-56"
      />
      <Button
        variant={todayActive ? "default" : "outline"}
        size="sm"
        aria-pressed={todayActive}
        onClick={onToggleToday}
      >
        {t("admin.sales.filters.today")}
      </Button>
      <Input
        value={clientQuery}
        onChange={(e) => onClientQueryChange(e.target.value)}
        placeholder={t("admin.sales.filters.clientSearch")}
        className="w-52"
      />

      {scope === "admin" && (
        <>
          <Input
            type="date"
            value={from ?? ""}
            onChange={(e) => onFromChange?.(e.target.value)}
            className="w-36"
            aria-label={t("admin.sales.filters.from")}
            title={t("admin.sales.filters.from")}
          />
          <Input
            type="date"
            value={to ?? ""}
            onChange={(e) => onToChange?.(e.target.value)}
            className="w-36"
            aria-label={t("admin.sales.filters.to")}
            title={t("admin.sales.filters.to")}
          />
          <Input
            value={sellerQuery ?? ""}
            onChange={(e) => onSellerQueryChange?.(e.target.value)}
            placeholder={t("admin.sales.filters.seller")}
            className="w-40"
          />
        </>
      )}
    </div>
  );
}
