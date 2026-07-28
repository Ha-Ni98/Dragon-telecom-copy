import React, { useMemo, useState } from "react";
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

/** Sentinel for "no explicit sort" — Radix `Select` rejects an empty-string item value. */
const SORT_DEFAULT = "default";

/**
 * ProductFilters component props
 */
interface ProductFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Currently selected brand id ('all' or a uuid) */
  selectedBrand: string;
  /** Callback when brand selection changes */
  onBrandChange: (brand: string) => void;
  /** Currently selected category (family) id ('all' or a uuid) */
  selectedCategory: string;
  /** Callback when category selection changes */
  onCategoryChange: (category: string) => void;
  /** Currently selected model id ('all' or a uuid) */
  selectedModel: string;
  /** Callback when model selection changes */
  onModelChange: (model: string) => void;
  /** In-stock-only toggle (ProductListQuery.inStock) */
  inStock: boolean;
  /** Callback when the in-stock toggle changes */
  onInStockChange: (inStock: boolean) => void;
  /** Current sort ('default' or a ProductSort value) */
  sort: string;
  /** Callback when sort changes */
  onSortChange: (sort: string) => void;
  /** Available brands for filtering */
  brands: BrandDto[];
  /** Available categories (families) for filtering */
  categories: FamilyDto[];
  /** Available models for filtering */
  models: DeviceModelDto[];
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Whether to show the clear filters button */
  showClearFilters?: boolean;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
}

/**
 * ProductFilters component for search and filtering products
 * Provides search input and dropdown filters for brand, category, model, in-stock and sort.
 * On mobile (< sm) the filter controls live behind a `Sheet` trigger (PUB-02: "drawer on
 * mobile") — the search input and active-filter chips stay visible inline on every breakpoint.
 */
export const ProductFilters: React.FC<ProductFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedBrand,
  onBrandChange,
  selectedCategory,
  onCategoryChange,
  selectedModel,
  onModelChange,
  inStock,
  onInStockChange,
  sort,
  onSortChange,
  brands,
  categories,
  models,
  isLoading = false,
  className = "",
  showClearFilters = true,
  onClearFilters,
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    selectedBrand !== "all" ||
    selectedCategory !== "all" ||
    selectedModel !== "all" ||
    searchQuery.trim() !== "" ||
    inStock ||
    sort !== SORT_DEFAULT;

  /**
   * Models scoped to the selected brand/category — recomputed on every keystroke of the search
   * input (a sibling control re-renders this component), so it's worth memoizing.
   */
  const filteredModels = useMemo(
    () =>
      models.filter((model) => {
        const brandMatch = selectedBrand === "all" || model.brandId === selectedBrand;
        const categoryMatch =
          selectedCategory === "all" || model.familyIds.includes(selectedCategory);
        return brandMatch && categoryMatch;
      }),
    [models, selectedBrand, selectedCategory],
  );

  const sortOptions: Array<{ value: string; label: string }> = [
    { value: SORT_DEFAULT, label: t("products.filters.sortDefault") },
    { value: ProductSort.NEWEST, label: t("products.filters.sortNewest") },
    { value: ProductSort.PRICE_ASC, label: t("products.filters.sortPriceAsc") },
    { value: ProductSort.PRICE_DESC, label: t("products.filters.sortPriceDesc") },
    { value: ProductSort.NAME, label: t("products.filters.sortName") },
  ];

  /**
   * Handle clear filters
   */
  const handleClearFilters = () => {
    onSearchChange("");
    onBrandChange("all");
    onCategoryChange("all");
    onModelChange("all");
    onInStockChange(false);
    onSortChange(SORT_DEFAULT);
    onClearFilters?.();
    setSheetOpen(false);
  };

  /**
   * Get brand name by ID
   */
  const getBrandName = (brandId: string): string => {
    if (brandId === "all") return t("products.filters.all");
    const brand = brands.find((b) => b.id === brandId);
    return brand?.name || "";
  };

  /**
   * Get category name by ID
   */
  const getCategoryName = (categoryId: string): string => {
    if (categoryId === "all") return t("products.filters.all");
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "";
  };

  /**
   * Get model name by ID
   */
  const getModelName = (modelId: string): string => {
    if (modelId === "all") return t("products.filters.all");
    const model = models.find((m) => m.id === modelId);
    return model?.name || "";
  };

  const getSortLabel = (value: string): string =>
    sortOptions.find((option) => option.value === value)?.label ?? "";

  // Shared by the always-visible desktop panel and the mobile Sheet — one set of controls, two
  // places it can render (never forked state, per plan.md's mobile-drawer risk note).
  const filterFields = (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={t("products.filters.search")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          disabled={isLoading}
          aria-label={t("products.filters.search")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <label htmlFor="category-filter" className="text-sm font-medium">
            {t("products.filters.category")}
          </label>
          <Select value={selectedCategory} onValueChange={onCategoryChange} disabled={isLoading}>
            <SelectTrigger id="category-filter" aria-label={t("products.filters.category")}>
              <SelectValue placeholder={t("products.filters.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products.filters.all")}</SelectItem>
              {categories.map((category) => (
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
          <Select value={selectedBrand} onValueChange={onBrandChange} disabled={isLoading}>
            <SelectTrigger id="brand-filter" aria-label={t("products.filters.brand")}>
              <SelectValue placeholder={t("products.filters.brand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products.filters.all")}</SelectItem>
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
            value={selectedModel}
            onValueChange={onModelChange}
            disabled={isLoading || filteredModels.length === 0}
          >
            <SelectTrigger id="model-filter" aria-label={t("products.filters.model")}>
              <SelectValue placeholder={t("products.filters.model")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products.filters.all")}</SelectItem>
              {filteredModels.map((model) => (
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
          <Select value={sort} onValueChange={onSortChange} disabled={isLoading}>
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
          {showClearFilters && hasActiveFilters && (
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
                className="flex items-center gap-2 sm:hidden"
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

      {/* Desktop-only inline filters — the Sheet above covers mobile. */}
      <div className="hidden sm:block">{filterFields}</div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {t("products.filters.activeFilters")}:
          </span>

          {searchQuery.trim() && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("common.labels.search")}: "{searchQuery}"
              <button
                onClick={() => onSearchChange("")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeSearch")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedBrand !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.brand")}: {getBrandName(selectedBrand)}
              <button
                onClick={() => onBrandChange("all")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeBrand")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedCategory !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.category")}: {getCategoryName(selectedCategory)}
              <button
                onClick={() => onCategoryChange("all")}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t("products.filters.removeCategory")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedModel !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.model")}: {getModelName(selectedModel)}
              <button
                onClick={() => onModelChange("all")}
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

          {sort !== SORT_DEFAULT && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t("products.filters.sort")}: {getSortLabel(sort)}
              <button
                onClick={() => onSortChange(SORT_DEFAULT)}
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
};

export default ProductFilters;
