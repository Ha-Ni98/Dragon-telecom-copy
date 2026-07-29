import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StockStatus,
  type FamilyDto,
  type BrandDto,
  type DeviceModelDto,
} from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

const ALL = "__all__";

const STOCK_STATUS_LABEL_KEY: Record<StockStatus, string> = {
  [StockStatus.IN_STOCK]: "admin.productsList.stats.inStock",
  [StockStatus.LOW_STOCK]: "admin.productsList.stats.lowStock",
  [StockStatus.OUT_OF_STOCK]: "admin.productsList.stats.outOfStock",
};

interface AdminProductsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  families: FamilyDto[];
  familyId?: string;
  onFamilyChange: (id: string | undefined) => void;
  brands: BrandDto[];
  brandId?: string;
  onBrandChange: (id: string | undefined) => void;
  models: DeviceModelDto[];
  modelId?: string;
  onModelChange: (id: string | undefined) => void;
  /** Client-side row filter — ProductListQuery has no stockStatus param (only a boolean
   * inStock), so this filters the current page's rows by their own AdminProductDto.stockStatus
   * rather than the server. */
  stockStatus?: StockStatus;
  onStockStatusChange: (status: StockStatus | undefined) => void;
  onClearFilters: () => void;
}

// Set-03 Sprint 5 rewire — was a 3-layer split (page → -section wrapper managing numeric-id
// filter state → this raw UI); collapsed to one dumb component, the page owns URL-as-state
// directly (mirrors StaffProductFilters/StaffProducts precedent, set-02).
export function AdminProductsFilters({
  search,
  onSearchChange,
  families,
  familyId,
  onFamilyChange,
  brands,
  brandId,
  onBrandChange,
  models,
  modelId,
  onModelChange,
  stockStatus,
  onStockStatusChange,
  onClearFilters,
}: AdminProductsFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("admin.productsList.filters.search")}
          className="pl-9"
        />
      </div>

      <Select
        value={familyId ?? ALL}
        onValueChange={(v) => onFamilyChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("admin.productsList.filters.family")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("staff.products.allFamilies")}</SelectItem>
          {families.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={brandId ?? ALL}
        onValueChange={(v) => onBrandChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("admin.productsList.filters.brand")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("staff.products.allBrands")}</SelectItem>
          {brands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={modelId ?? ALL}
        onValueChange={(v) => onModelChange(v === ALL ? undefined : v)}
        disabled={!brandId}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("admin.productsList.filters.model")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("staff.products.allModels")}</SelectItem>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={stockStatus ?? ALL}
        onValueChange={(v) => onStockStatusChange(v === ALL ? undefined : (v as StockStatus))}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder={t("admin.productsList.filters.stockStatus")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("staff.orders.tabs.all")}</SelectItem>
          {Object.values(StockStatus).map((status) => (
            <SelectItem key={status} value={status}>
              {t(STOCK_STATUS_LABEL_KEY[status])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(search || familyId || brandId || modelId || stockStatus) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="flex items-center gap-1"
        >
          <X className="h-4 w-4" />
          {t("admin.clients.clearFilters")}
        </Button>
      )}
    </div>
  );
}
