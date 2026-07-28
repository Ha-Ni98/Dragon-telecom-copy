import { useCallback, useState } from "react";

/**
 * Custom hook for recent searches with localStorage. Consumed by StorefrontSearch
 * (components/shared/StorefrontSearch.tsx) — the header's own search state (isSearchOpen/
 * searchQuery) moved into that component in S15; this file no longer exports it.
 */
export const useRecentSearches = () => {
  const STORAGE_KEY = "recent-searches";
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((s) => s !== query)].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== query);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
};
