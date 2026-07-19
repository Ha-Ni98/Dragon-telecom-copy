/**
 * Admin Statistics Filters Component
 * Provides date range and family filter controls for statistics
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, Filter, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useTranslation } from '@/hooks/useTranslation';
import { DateRange, AdminStatisticsFiltersProps } from '@/types/draft-types/admin-statistics.types';
import { generateDateRangeData } from '@/mocks/admin-statistics';
import { format } from 'date-fns';

/**
 * Date range preset options
 */
const DATE_RANGE_PRESETS = [
  { type: 'weekly' as const, label: 'This Week' },
  { type: 'monthly' as const, label: 'This Month' },
  { type: 'yearly' as const, label: 'This Year' },
  { type: 'custom' as const, label: 'Custom Range' },
];

/**
 * Mock family data for filtering
 */
const MOCK_FAMILIES = [
  { idFamily: 1, familyName: 'Smartphones' },
  { idFamily: 2, familyName: 'Accessories' },
  { idFamily: 3, familyName: 'Watches' },
  { idFamily: 4, familyName: 'Batteries' },
  { idFamily: 5, familyName: 'Cables' },
  { idFamily: 6, familyName: 'Protection' },
];

/**
 * Admin Statistics Filters Component
 * Provides comprehensive filtering controls for statistics data
 */
export const AdminStatisticsFilters: React.FC<AdminStatisticsFiltersProps> = ({
  selectedDateRange,
  onDateRangeChange,
  selectedFamily,
  onFamilyChange,
  families = MOCK_FAMILIES,
  loading = false,
  className = '',
}) => {
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
  const hasActiveFilters = selectedFamily !== 'all' || selectedDateRange.type !== 'monthly';

  /**
   * Handle date range preset selection
   */
  const handleDateRangePreset = useCallback((type: DateRange['type']) => {
    if (type === 'custom') {
      setIsCustomDatePickerOpen(true);
      return;
    }

    const newDateRange = generateDateRangeData(type);
    onDateRangeChange(newDateRange);
  }, [onDateRangeChange]);

  /**
   * Handle custom date range selection
   */
  const handleCustomDateRange = useCallback((range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);
    
    if (range.from && range.to) {
      const newDateRange: DateRange = {
        type: 'custom',
        startDate: range.from,
        endDate: range.to,
        label: `${format(range.from, 'MMM dd')} - ${format(range.to, 'MMM dd, yyyy')}`,
      };
      onDateRangeChange(newDateRange);
      setIsCustomDatePickerOpen(false);
    }
  }, [onDateRangeChange]);

  /**
   * Handle family selection change
   */
  const handleFamilyChange = useCallback((family: string) => {
    onFamilyChange(family);
  }, [onFamilyChange]);

  /**
   * Handle clear filters
   */
  const handleClearFilters = useCallback(() => {
    const defaultDateRange = generateDateRangeData('monthly');
    onDateRangeChange(defaultDateRange);
    onFamilyChange('all');
    setCustomDateRange({
      from: defaultDateRange.startDate,
      to: defaultDateRange.endDate,
    });
  }, [onDateRangeChange, onFamilyChange]);

  /**
   * Get family name by ID
   */
  const getFamilyName = useCallback((familyId: string): string => {
    if (familyId === 'all') return t('admin.statistics.filters.allFamilies');
    const family = families.find(f => f.idFamily.toString() === familyId);
    return family?.familyName || '';
  }, [families, t]);

  /**
   * Update custom date range when selectedDateRange changes
   */
  useEffect(() => {
    if (selectedDateRange.type === 'custom') {
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
            <CardTitle className="text-lg">{t('admin.statistics.filters')}</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                Active
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
              {t('admin.statistics.filters.clearFilters')}
            </Button>
          )}
        </div>
        <CardDescription>
          Filter statistics data by date range and product family
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Range Filter */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {t('admin.statistics.filters.dateRange')}
            </label>
            
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
                  {preset.type === 'custom' && <Calendar className="h-4 w-4 mr-2" />}
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Current Selection Display */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">Current Selection:</div>
              <div>{selectedDateRange.label}</div>
              <div className="text-xs mt-1">
                {format(selectedDateRange.startDate, 'MMM dd, yyyy')} - {format(selectedDateRange.endDate, 'MMM dd, yyyy')}
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
                        {format(customDateRange.from, 'MMM dd')} - {format(customDateRange.to, 'MMM dd, yyyy')}
                      </>
                    ) : (
                      format(customDateRange.from, 'MMM dd, yyyy')
                    )
                  ) : (
                    <span>Pick a date range</span>
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
            <label className="text-sm font-medium">
              {t('admin.statistics.filters.family')}
            </label>
            
            <Select
              value={selectedFamily}
              onValueChange={handleFamilyChange}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a family" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('admin.statistics.filters.allFamilies')}
                </SelectItem>
                {families.map((family) => (
                  <SelectItem key={family.idFamily} value={family.idFamily.toString()}>
                    {family.familyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Current Family Selection Display */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">Current Selection:</div>
              <div>{getFamilyName(selectedFamily)}</div>
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-sm font-medium mb-2">Active Filters:</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {selectedDateRange.label}
              </Badge>
              {selectedFamily !== 'all' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {getFamilyName(selectedFamily)}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
