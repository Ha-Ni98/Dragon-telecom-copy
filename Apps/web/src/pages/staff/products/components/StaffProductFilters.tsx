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
import type { FamilyDto, BrandDto, DeviceModelDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// Dumb, props-only (Sprint 4). Sprint 6 wires the 300ms debounce (useDebouncedValue) and the
// real useCatalogFamilies/useCatalogBrands/useCatalogModels queries around this — `families`/
// `brands`/`models` are just arrays here, and `models` is expected pre-filtered by the parent
// (empty when no brand is selected) rather than this component knowing about that rule itself.
const ALL = "__all__";

interface StaffProductFiltersProps {
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
  onClearFilters: () => void;
}

export function StaffProductFilters({
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
  onClearFilters,
}: StaffProductFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("staff.products.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <Select
        value={familyId ?? ALL}
        onValueChange={(v) => onFamilyChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t("staff.products.filterFamily")} />
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
          <SelectValue placeholder={t("admin.dashboard.brand")} />
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
          <SelectValue placeholder={t("staff.products.filterModel")} />
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

      {(search || familyId || brandId || modelId) && (
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
