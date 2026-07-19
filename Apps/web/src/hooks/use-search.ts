import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/lib/services/search.service';

/**
 * Custom hook for search suggestions with debouncing and TanStack Query
 */
export const useSearchSuggestions = (query: string, delay: number = 300) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  // Client-scoped suggestions (idClient) aren't wired yet — clients module integration is
  // Sub-02; anonymous suggestions (idClient: null) is the typed-empty-default for now.
  const idClient = null;


  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => searchService.getSuggestions(debouncedQuery, idClient, 4),
    enabled: debouncedQuery.length > 2,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors, retry up to 2 times on network errors
      if (error instanceof Error && error.message.includes('400')) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Custom hook for full search results with debouncing and TanStack Query
 */
export const useSearchResults = (query: string, delay: number = 500) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return useQuery({
    queryKey: ['search-results', debouncedQuery],
    queryFn: () => searchService.searchProducts(debouncedQuery, 20),
    enabled: debouncedQuery.length > 1,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors, retry up to 2 times on network errors
      if (error instanceof Error && error.message.includes('400')) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Custom hook for popular searches
 */
export const usePopularSearches = () => {
  return useQuery({
    queryKey: ['popular-searches'],
    queryFn: searchService.getPopularSearches,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

/**
 * Custom hook for hero product
 */
export const useHeroProduct = () => {
  return useQuery({
    queryKey: ['hero-product'],
    queryFn: searchService.getHeroProduct,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

/**
 * Custom hook for recent searches with localStorage
 */
export const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = searchService.getRecentSearches();
    setRecentSearches(saved);
  }, []);

  // Add search to recent searches
  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    searchService.saveRecentSearch(query);
  }, [recentSearches]);

  // Remove search from recent searches
  const removeRecentSearch = useCallback((query: string) => {
    const updated = recentSearches.filter(s => s !== query);
    setRecentSearches(updated);
    localStorage.setItem('recent-searches', JSON.stringify(updated));
  }, [recentSearches]);

  // Clear all recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
};

/**
 * Custom hook for search state management
 */
export const useSearchState = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Open search
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Close search
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  // Update search query
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Set searching state
  const setSearching = useCallback((searching: boolean) => {
    setIsSearching(searching);
  }, []);

  return {
    isSearchOpen,
    searchQuery,
    isSearching,
    openSearch,
    closeSearch,
    updateSearchQuery,
    setSearching,
  };
};

/**
 * Custom hook for search analytics (placeholder for future implementation)
 */
export const useSearchAnalytics = () => {
  const trackSearch = useCallback((query: string, results: number) => {
    // TODO: Implement search analytics
    console.log(`Search: "${query}" returned ${results} results`);
  }, []);

  const trackSuggestionClick = useCallback((query: string, suggestion: string) => {
    // TODO: Implement suggestion click analytics
    console.log(`Suggestion clicked: "${suggestion}" from query "${query}"`);
  }, []);

  const trackSearchResultClick = useCallback((query: string, resultId: number) => {
    // TODO: Implement search result click analytics
    console.log(`Search result clicked: ${resultId} from query "${query}"`);
  }, []);

  return {
    trackSearch,
    trackSuggestionClick,
    trackSearchResultClick,
  };
};

// Type guard to check if the user is a Client


