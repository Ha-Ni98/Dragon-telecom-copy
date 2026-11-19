import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ProductSort,
  type BrandDto,
  type FamilyDto,
  type DeviceModelDto,
} from "@dragon-telecom/contract";

// Radix `Select` rejects an empty-string item value, so "no filter" needs a sentinel. It is
// internal to this component: props carry `string | undefined` and the page never sees these
// values. Same constant, same name, same reason as admin-products-filters.tsx and
// StaffProductFilters.tsx — deliberately duplicated rather than shared, so each filter bar reads
// standalone (three copies is the existing convention; extracting it is a separate cleanup).
const ALL = "__all__";
const SORT_DEFAULT = "__default__";

/**
 * ProductFilters component props
 */
interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  families: FamilyDto[];
  familyId?: string;
  onFamilyChange: (id: string | undefined) => void;
  brands: BrandDto[];
  brandId?: string;
  onBrandChange: (id: string | undefined) => void;
  /** Pre-scoped to the selected brand by the page (empty when no brand is selected) — this
   *  component never filters the list itself. */
  models: DeviceModelDto[];
  modelId?: string;
  onModelChange: (id: string | undefined) => void;
  inStock: boolean;
  onInStockChange: (inStock: boolean) => void;
  sort?: ProductSort;
  onSortChange: (sort: ProductSort | undefined) => void;
  isLoading?: boolean;
  className?: string;
  onClearFilters: () => void;
  /** S37 — optional control of the mobile filter Sheet, so the storefront bottom nav's
   *  "Categories" item can open it. Uncontrolled (internal state) when omitted. */
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
}

/**
 * ProductFilters component for search and filtering products
 * Provides search input and dropdown filters for brand, category, model, in-stock and sort.
 * On phones (< md, S37 P1 — one phone-layout breakpoint app-wide) the filter controls live behind a `Sheet` trigger (PUB-02: "drawer on
 * mobile") — the search input and active-filter chips stay visible inline on every breakpoint.
 */
export function ProductFilters({
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
  inStock,
  onInStockChange,
  sort,
  onSortChange,
  isLoading = false,
  className = "",
  onClearFilters,
  sheetOpen: sheetOpenProp,
  onSheetOpenChange,
}: ProductFiltersProps) {
  const { t } = useTranslation();
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const sheetOpen = sheetOpenProp ?? internalSheetOpen;
  const setSheetOpen = onSheetOpenChange ?? setInternalSheetOpen;

  const hasActiveFilters =
    familyId !== undefined ||
    brandId !== undefined ||
    modelId !== undefined ||
    search.trim() !== "" ||
    inStock ||
    sort !== undefined;

  const sortOptions: Array<{ value: string; label: string }> = [
    { value: SORT_DEFAULT, label: t("products.filters.sortDefault") },
    { value: ProductSort.NEWEST, label: t("products.filters.sortNewest") },
    { value: ProductSort.PRICE_ASC, label: t("products.filters.sortPriceAsc") },
    { value: ProductSort.PRICE_DESC, label: t("products.filters.sortPriceDesc") },
    { value: ProductSort.NAME, label: t("products.filters.sortName") },
  ];

  const handleClearFilters = () => {
    onClearFilters();
    setSheetOpen(false);
  };

  const brandName = (id: string): string => brands.find((b) => b.id === id)?.name ?? "";
  const familyName = (id: string): string => families.find((f) => f.id === id)?.name ?? "";
  const modelName = (id: string): string => models.find((m) => m.id === id)?.name ?? "";
  const sortLabel = (value: ProductSort): string =>
    sortOptions.find((option) => option.value === value)?.label ?? "";

  // Shared by the always-visible desktop panel and the mobile Sheet — one set of controls, two
  // places it can render (never forked state, per plan.md's mobile-drawer risk note).
  const filterFields = (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        {/* Never `disabled={isLoading}`: every settled keystroke writes the URL, which produces a
            new query key and flips `isLoading` back to true mid-typing. The browser blurs a focused
            element the moment it becomes disabled, and React does not restore focus when it is
            re-enabled — so the caret was being thrown out of the box on every debounce. A debounced
            search must stay typable while its results load (same as StaffProductFilters and
            admin-products-filters, neither of which disables its search input). */}
        <Input
          placeholder={t("products.filters.search")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          aria-label={t("products.filters.search")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <label htmlFor="category-filter" className="text-sm font-medium">
            {t("products.filters.category")}
          </label>
          <Select
            value={familyId ?? ALL}
            onValueChange={(v) => onFamilyChange(v === ALL ? undefined : v)}
            disabled={isLoading}
          >
            <SelectTrigger id="category-filter" aria-label={t("products.filters.category")}>
              <SelectValue placeholder={t("products.filters.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("products.filters.all")}</SelectItem>
              {families.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand Filter */}
        <div className="space-y-2">
          <label htmlFor="brand-filter" className="text-sm font-medium">
            {t("products.filters.brand")}
          </label>
          <Select
            value={brandId ?? ALL}
            onValueChange={(v) => onBrandChange(v === ALL ? undefined : v)}
            disabled={isLoading}
          >
            <SelectTrigger id="brand-filter" aria-label={t("products.filters.brand")}>
              <SelectValue placeholder={t("products.filters.brand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("products.filters.all")}</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Filter */}
        <div className="space-y-2">
          <label htmlFor="model-filter" className="text-sm font-medium">
            {t("products.filters.model")}
          </label>
          <Select
            value={modelId ?? ALL}
            onValueChange={(v) => onModelChange(v === ALL ? undefined : v)}
            disabled={isLoading || !brandId}
          >
            <SelectTrigger id="model-filter" aria-label={t("products.filters.model")}>
              <SelectValue placeholder={t("products.filters.model")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("products.filters.all")}</SelectItem>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sort */}
        <div className="space-y-2">
          <label htmlFor="sort-filter" className="text-sm font-medium">
            {t("products.filters.sort")}
          </label>
          <Select
            value={sort ?? SORT_DEFAULT}
            onValueChange={(v) => onSortChange(v === SORT_DEFAULT ? undefined : (v as ProductSort))}
            disabled={isLoading}
          >
            <SelectTrigger id="sort-filter" aria-label={t("products.filters.sort")}>
              <SelectValue placeholder={t("products.filters.sort")} />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* In-stock toggle */}
        <div className="flex items-end justify-between rounded-lg border p-3 sm:justify-start sm:gap-3">
          <Label htmlFor="in-stock-filter" className="text-sm font-medium">
            {t("products.filters.inStock")}
          </Label>
          <Switch
            id="in-stock-filter"
            checked={inStock}
            onCheckedChange={onInStockChange}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t("products.filters.title")}</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              {t("common.status.active")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              {t("products.filters.clearAll")}
            </Button>
          )}

          {/* Mobile-only trigger — the same controls render inline on sm+ below. */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 md:hidden"
                aria-label={t("products.filters.openFilters")}
              >
                <Filter className="h-4 w-4" />
                {t("products.filters.title")}
              </Button>
            </SheetTrigger>
            {/* Not w-full: the list must stay partly visible behind the drawer, like the
                header's burger menu (S15). */}
            <SheetContent side="right" className="w-[85%] max-w-sm overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t("products.filters.title")}</SheetTitle>
              </SheetHeader>
              <div className="mt-6">{filterFields}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* md+ inline filters — the Sheet above covers phones (< md, S37 P1). */}
      <div className="hidden md:block">{filterFields}</div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {t("products.filters.activeFilters")}:
          </span>

          {search.trim() && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("common.labels.search")}: "{search}"
              <button
                onClick={() => onSearchChange("")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeSearch")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {brandId !== undefined && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.brand")}: {brandName(brandId)}
              <button
                onClick={() => onBrandChange(undefined)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeBrand")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {familyId !== undefined && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.category")}: {familyName(familyId)}
              <button
                onClick={() => onFamilyChange(undefined)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeCategory")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {modelId !== undefined && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.model")}: {modelName(modelId)}
              <button
                onClick={() => onModelChange(undefined)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeModel")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {inStock && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.inStock")}
              <button
                onClick={() => onInStockChange(false)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeInStock")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {sort !== undefined && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.sort")}: {sortLabel(sort)}
              <button
                onClick={() => onSortChange(undefined)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeSort")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
