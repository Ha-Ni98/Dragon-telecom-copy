/**
 * Admin Statistics Filters Component
 * Provides date range and family filter controls for statistics
 */

import { useState, useCallback, useEffect } from "react";
import { Calendar, Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useTranslation } from "@/hooks/useTranslation";
import { generateDateRangeData } from "@/lib/date-utils";
import { format } from "date-fns";
import { RevenueSource } from "@dragon-telecom/contract";

// Page-local UI state — not part of any DTO (the query's `from`/`to`/`familyId`, URL-synced
// per plan §Page 6, is derived from this at the call site in Sprint 8).
export interface DateRangeFilter {
  type: "weekly" | "monthly" | "yearly" | "custom";
  startDate: Date;
  endDate: Date;
  label: string;
}

interface AdminStatisticsFiltersProps {
  selectedDateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  selectedFamily: string;
  onFamilyChange: (familyId: string) => void;
  /** Real families come from `useCatalogFamilies` (Sprint 8) — `id`/`name`, not the old
   * view-model's numeric `idFamily`/`familyName`. */
  families?: { id: string; name: string }[];
  /** S24 — revenue-source filter: all / products (sales+orders) / repairs. */
  selectedSource: RevenueSource;
  onSourceChange: (source: RevenueSource) => void;
  loading?: boolean;
  className?: string;
}

// Labels resolved via `t()` at render time, not stored here — real copy, not inline strings.
const DATE_RANGE_PRESETS = [
  { type: "weekly" as const, labelKey: "admin.statistics.filters.weekly" },
  { type: "monthly" as const, labelKey: "admin.statistics.filters.monthly" },
  { type: "yearly" as const, labelKey: "admin.statistics.filters.yearly" },
  { type: "custom" as const, labelKey: "admin.statistics.filters.custom" },
];

export function AdminStatisticsFilters({
  selectedDateRange,
  onDateRangeChange,
  selectedFamily,
  onFamilyChange,
  families = [],
  selectedSource,
  onSourceChange,
  loading = false,
  className = "",
}: AdminStatisticsFiltersProps) {
  const { t } = useTranslation();
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: selectedDateRange.startDate,
    to: selectedDateRange.endDate,
  });

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    selectedFamily !== "all" ||
    selectedDateRange.type !== "monthly" ||
    selectedSource !== RevenueSource.ALL;

  /**
   * Handle date range preset selection
   */
  const handleDateRangePreset = useCallback(
    (type: DateRangeFilter["type"]) => {
      if (type === "custom") {
        setIsCustomDatePickerOpen(true);
        return;
      }

      const newDateRange = generateDateRangeData(type);
      onDateRangeChange(newDateRange);
    },
    [onDateRangeChange],
  );

  /**
   * Handle custom date range selection
   */
  const handleCustomDateRange = useCallback(
    (range: { from: Date | undefined; to: Date | undefined }) => {
      setCustomDateRange(range);

      if (range.from && range.to) {
        const newDateRange: DateRangeFilter = {
          type: "custom",
          startDate: range.from,
          endDate: range.to,
          label: `${format(range.from, "MMM dd")} - ${format(range.to, "MMM dd, yyyy")}`,
        };
        onDateRangeChange(newDateRange);
        setIsCustomDatePickerOpen(false);
      }
    },
    [onDateRangeChange],
  );

  /**
   * Handle family selection change
   */
  const handleFamilyChange = useCallback(
    (family: string) => {
      onFamilyChange(family);
    },
    [onFamilyChange],
  );

  /**
   * Handle clear filters
   */
  const handleClearFilters = useCallback(() => {
    const defaultDateRange = generateDateRangeData("monthly");
    onDateRangeChange(defaultDateRange);
    onFamilyChange("all");
    onSourceChange(RevenueSource.ALL);
    setCustomDateRange({
      from: defaultDateRange.startDate,
      to: defaultDateRange.endDate,
    });
  }, [onDateRangeChange, onFamilyChange, onSourceChange]);

  /**
   * Get family name by ID
   */
  const getFamilyName = useCallback(
    (familyId: string): string => {
      if (familyId === "all") return t("admin.statistics.filters.allFamilies");
      const family = families.find((f) => f.id === familyId);
      return family?.name || "";
    },
    [families, t],
  );

  /**
   * Get revenue-source label (S24)
   */
  const getSourceLabel = useCallback(
    (source: RevenueSource): string => t(`admin.statistics.filters.source.${source}`),
    [t],
  );

  /**
   * Update custom date range when selectedDateRange changes
   */
  useEffect(() => {
    if (selectedDateRange.type === "custom") {
      setCustomDateRange({
        from: selectedDateRange.startDate,
        to: selectedDateRange.endDate,
      });
    }
  }, [selectedDateRange]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("admin.statistics.filters")}</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {t("common.status.active")}
              </Badge>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center gap-2"
              disabled={loading}
            >
              <X className="h-4 w-4" />
              {t("admin.statistics.filters.clearFilters")}
            </Button>
          )}
        </div>
        <CardDescription>{t("admin.statistics.filters.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Date Range Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t("admin.statistics.filters.dateRange")}</label>

            {/* Date Range Presets */}
            <div className="grid grid-cols-2 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.type}
                  variant={selectedDateRange.type === preset.type ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDateRangePreset(preset.type)}
                  disabled={loading}
                  className="justify-start"
                >
                  {preset.type === "custom" && <Calendar className="h-4 w-4 mr-2" />}
                  {t(preset.labelKey)}
                </Button>
              ))}
            </div>

            {/* Current Selection Display */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">{t("admin.statistics.filters.currentSelection")}:</div>
              <div>{selectedDateRange.label}</div>
              <div className="text-xs mt-1">
                {format(selectedDateRange.startDate, "MMM dd, yyyy")} -{" "}
                {format(selectedDateRange.endDate, "MMM dd, yyyy")}
              </div>
            </div>

            {/* Custom Date Picker */}
            <Popover open={isCustomDatePickerOpen} onOpenChange={setIsCustomDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={loading}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {customDateRange.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "MMM dd")} -{" "}
                        {format(customDateRange.to, "MMM dd, yyyy")}
                      </>
                    ) : (
                      format(customDateRange.from, "MMM dd, yyyy")
                    )
                  ) : (
                    <span>{t("admin.statistics.filters.pickDateRange")}</span>
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange.from}
                  selected={customDateRange}
                  onSelect={(range) => {
                    if (range) {
                      handleCustomDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Family Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t("admin.statistics.filters.family")}</label>

            <Select value={selectedFamily} onValueChange={handleFamilyChange} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.statistics.filters.selectFamily")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.statistics.filters.allFamilies")}</SelectItem>
                {families.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Current Family Selection Display */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">{t("admin.statistics.filters.currentSelection")}:</div>
              <div>{getFamilyName(selectedFamily)}</div>
            </div>
          </div>

          {/* Revenue Source Filter (S24) */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t("admin.statistics.filters.source")}</label>

            <Select
              value={selectedSource}
              onValueChange={(v) => onSourceChange(v as RevenueSource)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("admin.statistics.filters.selectSource")} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(RevenueSource).map((source) => (
                  <SelectItem key={source} value={source}>
                    {getSourceLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">{t("admin.statistics.filters.currentSelection")}:</div>
              <div>{getSourceLabel(selectedSource)}</div>
            </div>
          </div>
        </div>

        {/* S24 (Q3) — repair labour has no product/family, so a family filter necessarily
            excludes it from any REPAIRS/ALL figure. Surfaced rather than left silent. */}
        {selectedFamily !== "all" && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t("admin.statistics.filters.familyExcludesLabourNote")}
          </p>
        )}

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-sm font-medium mb-2">{t("products.filters.activeFilters")}:</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {selectedDateRange.label}
              </Badge>
              {selectedFamily !== "all" && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {getFamilyName(selectedFamily)}
                </Badge>
              )}
              {selectedSource !== RevenueSource.ALL && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {getSourceLabel(selectedSource)}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminStatisticsFilters;
