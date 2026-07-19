/**
 * Admin Products Filters Section Component
 * Wraps the filters component with state management and data fetching
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AdminProductsFilters } from './admin-products-filters';
import { useAdminProductsFilters } from '@/hooks/use-admin-products';
import { useBrands, useCategories } from '@/hooks/use-brands';
import { useModels } from '@/hooks/use-models';
import { AdminProductsFilters as AdminProductsFiltersType } from '@/types/draft-types/admin.types';

interface AdminProductsFiltersSectionProps {
  /** Callback when filters change */
  onFiltersChange: (filters: AdminProductsFiltersType) => void;
  /** Whether the component is in loading state */
  loading?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Admin Products Filters Section Component
 * Manages filter state and provides data to the filters component
 */
export function AdminProductsFiltersSection({
  onFiltersChange,
  loading = false,
  className = '',
}: AdminProductsFiltersSectionProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');

  // Get filter management functions
  const { setFilters, clearFilters } = useAdminProductsFilters();

  // Get brands, categories, and models data (using existing hooks)
  const { data: brandsData } = useBrands();
  const { data: categoriesData } = useCategories();
  const { data: modelsData } = useModels();

  const families = categoriesData ?? [];
  const brands = brandsData ?? [];
  const models = modelsData ?? [];

  /**
   * Handle search query change with debouncing
   * This is called by the AdminSearchInput when the debounced value changes
   */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Create filters object with the new search query
    const filters: AdminProductsFiltersType = {
      searchQuery: query,
      familyId: selectedFamily !== 'all' ? parseInt(selectedFamily) : undefined,
      brandId: selectedBrand !== 'all' ? parseInt(selectedBrand) : undefined,
      modelId: selectedModel !== 'all' ? parseInt(selectedModel) : undefined,
    };
    
    onFiltersChange(filters);
    setFilters(filters);
  }, [selectedFamily, selectedBrand, selectedModel, onFiltersChange, setFilters]);

  /**
   * Handle family selection change with proper coordination
   */
  const handleFamilyChange = useCallback((family: string) => {
    setSelectedFamily(family);
    // Reset model when family changes
    setSelectedModel('all');
    const filters: AdminProductsFiltersType = {
      searchQuery,
      familyId: family !== 'all' ? parseInt(family) : undefined,
      brandId: selectedBrand !== 'all' ? parseInt(selectedBrand) : undefined,
      modelId: undefined, // Reset model when family changes
    };
    
    onFiltersChange(filters);
    setFilters(filters);
  }, [searchQuery, selectedBrand, onFiltersChange, setFilters]);

  /**
   * Handle brand selection change with proper coordination
   */
  const handleBrandChange = useCallback((brand: string) => {
    setSelectedBrand(brand);
    // Reset model when brand changes
    setSelectedModel('all');
    const filters: AdminProductsFiltersType = {
      searchQuery,
      familyId: selectedFamily !== 'all' ? parseInt(selectedFamily) : undefined,
      brandId: brand !== 'all' ? parseInt(brand) : undefined,
      modelId: undefined, // Reset model when brand changes
    };
    
    onFiltersChange(filters);
    setFilters(filters);
  }, [searchQuery, selectedFamily, onFiltersChange, setFilters]);

  /**
   * Handle model selection change with proper coordination
   */
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    const filters: AdminProductsFiltersType = {
      searchQuery,
      familyId: selectedFamily !== 'all' ? parseInt(selectedFamily) : undefined,
      brandId: selectedBrand !== 'all' ? parseInt(selectedBrand) : undefined,
      modelId: model !== 'all' ? parseInt(model) : undefined,
    };
    
    onFiltersChange(filters);
    setFilters(filters);
  }, [searchQuery, selectedFamily, selectedBrand, onFiltersChange, setFilters]);

  /**
   * Handle clear filters with proper coordination
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedFamily('all');
    setSelectedBrand('all');
    setSelectedModel('all');
    
    const filters: AdminProductsFiltersType = {
      searchQuery: '',
    };
    
    onFiltersChange(filters);
    clearFilters();
  }, [onFiltersChange, clearFilters]);

  return (
    <AdminProductsFilters
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      selectedFamily={selectedFamily}
      onFamilyChange={handleFamilyChange}
      selectedBrand={selectedBrand}
      onBrandChange={handleBrandChange}
      selectedModel={selectedModel}
      onModelChange={handleModelChange}
      families={families}
      brands={brands}
      models={models}
      loading={loading}
      className={className}
      onClearFilters={handleClearFilters}
    />
  );
}
