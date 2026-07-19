/**
 * Admin Logs Filters Component
 * Provides comprehensive filtering controls for admin logs
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { Calendar, Filter, X, User, Activity, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminLogsFilters as AdminLogsFiltersType } from '@/types/draft-types/logs.types';
import { ActionTypeCode, ActionTypeLabels } from '@/types/draft-types/enums.types';
import { usePlatformUsers } from '@/hooks/use-admin-logs';
import { format } from 'date-fns';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * Props for AdminLogsFilters component
 */
interface AdminLogsFiltersProps {
  /** Callback when filters change */
  onFiltersChange: (filters: AdminLogsFiltersType) => void;
  /** Whether the component is in loading state */
  loading?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Date range preset options
 */
const DATE_RANGE_PRESETS = [
  { type: 'today', label: 'Today' },
  { type: 'yesterday', label: 'Yesterday' },
  { type: 'thisWeek', label: 'This Week' },
  { type: 'thisMonth', label: 'This Month' },
  { type: 'custom', label: 'Custom Range' },
];

/**
 * Admin Logs Filters Component
 * Provides comprehensive filtering controls for logs data
 */
export const AdminLogsFilters: React.FC<AdminLogsFiltersProps> = memo(({
  onFiltersChange,
  loading = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const { data: platformUsersData } = usePlatformUsers();
  const platformUsers = platformUsersData ?? [];

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Debounced search query
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // State for popover controls
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = selectedUser !== 'all' || 
                          selectedActionType !== 'all' || 
                          selectedDateRange !== 'all' || 
                          debouncedSearchQuery.trim() !== '';

  /**
   * Generate date range based on preset
   */
  const generateDateRange = useCallback((preset: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          from: yesterday.toISOString().split('T')[0],
          to: yesterday.toISOString().split('T')[0],
        };
      case 'thisWeek':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return {
          from: startOfWeek.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        };
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          from: startOfMonth.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0],
        };
      default:
        return { from: undefined, to: undefined };
    }
  }, []);

  /**
   * Handle search query change
   */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Handle user selection change
   */
  const handleUserChange = useCallback((userId: string) => {
    setSelectedUser(userId);
  }, []);

  /**
   * Handle action type selection change
   */
  const handleActionTypeChange = useCallback((actionType: string) => {
    setSelectedActionType(actionType);
  }, []);

  /**
   * Handle date range preset selection
   */
  const handleDateRangePreset = useCallback((preset: string) => {
    setSelectedDateRange(preset);
    
    if (preset === 'custom') {
      setIsCustomDatePickerOpen(true);
      return;
    }

    const dateRange = generateDateRange(preset);
    setCustomDateRange({
      from: dateRange.from ? new Date(dateRange.from) : undefined,
      to: dateRange.to ? new Date(dateRange.to) : undefined,
    });
  }, [generateDateRange]);

  /**
   * Handle custom date range selection
   */
  const handleCustomDateRange = useCallback((range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);
    
    if (range.from && range.to) {
      setSelectedDateRange('custom');
      setIsCustomDatePickerOpen(false);
    }
  }, []);

  /**
   * Handle clear filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedUser('all');
    setSelectedActionType('all');
    setSelectedDateRange('all');
    setCustomDateRange({ from: undefined, to: undefined });
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsCustomDatePickerOpen(false);
    }
  }, []);

  /**
   * Update filters when state changes
   */
  useEffect(() => {
    const filters: AdminLogsFiltersType = {
      searchQuery: debouncedSearchQuery,
      page: 1,
      limit: 20,
      userId: selectedUser !== 'all' ? parseInt(selectedUser) : undefined,
      actionType: selectedActionType !== 'all' ? parseInt(selectedActionType) : undefined,
      dateFrom: customDateRange.from?.toISOString().split('T')[0],
      dateTo: customDateRange.to?.toISOString().split('T')[0],
    };

    onFiltersChange(filters);
  }, [debouncedSearchQuery, selectedUser, selectedActionType, customDateRange, onFiltersChange]);

  /**
   * Get user name by ID
   */
  const getUserName = (userId: string): string => {
    if (userId === 'all') return t('admin.logs.filters.allUsers');
    const user = platformUsers.find(u => u.idUser.toString() === userId);
    return user?.userName || '';
  };

  /**
   * Get action type label by code
   */
  const getActionTypeLabel = (actionTypeCode: string): string => {
    if (actionTypeCode === 'all') return t('admin.logs.filters.allActions');
    const code = parseInt(actionTypeCode) as ActionTypeCode;
    return ActionTypeLabels[code] || 'Unknown Action';
  };

  /**
   * Get date range label
   */
  const getDateRangeLabel = (): string => {
    if (selectedDateRange === 'all') return t('admin.logs.filters.allDates');
    if (selectedDateRange === 'custom' && customDateRange.from && customDateRange.to) {
      return `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd, yyyy')}`;
    }
    return DATE_RANGE_PRESETS.find(preset => preset.type === selectedDateRange)?.label || '';
  };

  return (
    <Card className={className} onKeyDown={handleKeyDown}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" aria-hidden="true" />
              <span>{t('admin.logs.filters.title')}</span>
            </CardTitle>
            <CardDescription>{t('admin.logs.filters.description')}</CardDescription>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>{t('admin.logs.filters.clearAll')}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Query */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>{t('admin.logs.filters.search')}</span>
            </label>
            <Input
              placeholder={t('admin.logs.filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {/* User Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>{t('admin.logs.filters.user')}</span>
            </label>
            <Select
              value={selectedUser}
              onValueChange={handleUserChange}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.logs.filters.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.logs.filters.allUsers')}</SelectItem>
                {platformUsers.map((user) => (
                  <SelectItem key={user.idUser} value={user.idUser.toString()}>
                    {user.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>{t('admin.logs.filters.actionType')}</span>
            </label>
            <Select
              value={selectedActionType}
              onValueChange={handleActionTypeChange}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.logs.filters.selectActionType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.logs.filters.allActions')}</SelectItem>
                {Object.entries(ActionTypeLabels).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>{t('admin.logs.filters.dateRange')}</span>
            </label>
            <Select
              value={selectedDateRange}
              onValueChange={handleDateRangePreset}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.logs.filters.selectDateRange')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.logs.filters.allDates')}</SelectItem>
                {DATE_RANGE_PRESETS.map((preset) => (
                  <SelectItem key={preset.type} value={preset.type}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {selectedDateRange === 'custom' && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  {t('admin.logs.filters.customDateRange')}
                </label>
                <Popover open={isCustomDatePickerOpen} onOpenChange={setIsCustomDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange.from && customDateRange.to ? (
                        `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd, yyyy')}`
                      ) : (
                        t('admin.logs.filters.selectDateRange')
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={customDateRange}
                      onSelect={(range) => handleCustomDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">{t('admin.logs.filters.activeFilters')}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {debouncedSearchQuery && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Search className="h-3 w-3" />
                  <span>{t('admin.logs.filters.search')}: "{debouncedSearchQuery}"</span>
                </Badge>
              )}
              {selectedUser !== 'all' && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>{t('admin.logs.filters.user')}: {getUserName(selectedUser)}</span>
                </Badge>
              )}
              {selectedActionType !== 'all' && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Activity className="h-3 w-3" />
                  <span>{t('admin.logs.filters.actionType')}: {getActionTypeLabel(selectedActionType)}</span>
                </Badge>
              )}
              {selectedDateRange !== 'all' && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{t('admin.logs.filters.dateRange')}: {getDateRangeLabel()}</span>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
