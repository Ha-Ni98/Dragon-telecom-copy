/**
 * Hook for admin clients search and filtering
 * Provides search functionality with debouncing and filter management
 */

import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AdminClientsFilters } from '@/types/draft-types/client.types';

/**
 * Search and filter state interface
 */
interface AdminClientsSearchState {
  searchQuery: string;
  status: string;
  page: number;
  limit: number;
}

/**
 * Hook for managing admin clients search and filtering
 * Provides debounced search and filter state management
 */
export function useAdminClientsSearch(initialFilters?: Partial<AdminClientsFilters>) {
  // Initial state
  const [filters, setFilters] = useState<AdminClientsSearchState>({
    searchQuery: initialFilters?.searchQuery || '',
    status: initialFilters?.status || 'all',
    page: initialFilters?.page || 1,
    limit: initialFilters?.limit || 10,
  });

  // Debounced search query (300ms delay)
  const debouncedSearchQuery = useDebouncedValue(filters.searchQuery, 300);

  // Memoized filters for API calls
  const apiFilters = useMemo(() => ({
    searchQuery: debouncedSearchQuery,
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
  }), [debouncedSearchQuery, filters.status, filters.page, filters.limit]);

  /**
   * Update search query
   */
  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: query,
      page: 1, // Reset to first page when searching
    }));
  }, []);

  /**
   * Update status filter
   */
  const setStatus = useCallback((status: string) => {
    setFilters(prev => ({
      ...prev,
      status,
      page: 1, // Reset to first page when filtering
    }));
  }, []);

  /**
   * Update page
   */
  const setPage = useCallback((page: number) => {
    setFilters(prev => ({
      ...prev,
      page,
    }));
  }, []);

  /**
   * Update limit
   */
  const setLimit = useCallback((limit: number) => {
    setFilters(prev => ({
      ...prev,
      limit,
      page: 1, // Reset to first page when changing limit
    }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      status: 'all',
      page: 1,
      limit: 10,
    });
  }, []);

  /**
   * Reset to initial filters
   */
  const resetFilters = useCallback(() => {
    setFilters({
      searchQuery: initialFilters?.searchQuery || '',
      status: initialFilters?.status || 'all',
      page: initialFilters?.page || 1,
      limit: initialFilters?.limit || 10,
    });
  }, [initialFilters]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return filters.searchQuery !== '' || filters.status !== 'all';
  }, [filters.searchQuery, filters.status]);

  /**
   * Get filter summary for display
   */
  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.searchQuery) {
      parts.push(`Search: "${filters.searchQuery}"`);
    }
    if (filters.status !== 'all') {
      parts.push(`Status: ${filters.status}`);
    }
    return parts.join(', ');
  }, [filters.searchQuery, filters.status]);

  return {
    // Current filters
    filters,
    apiFilters,
    hasActiveFilters,
    filterSummary,
    
    // Actions
    setSearchQuery,
    setStatus,
    setPage,
    setLimit,
    clearFilters,
    resetFilters,
    
    // Individual filter values
    searchQuery: filters.searchQuery,
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
  };
}
