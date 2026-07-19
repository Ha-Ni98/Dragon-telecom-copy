/**
 * Admin Products Filters Component
 * Provides search and filter controls for the admin products table
 */

import React, { useCallback } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminSearchInput } from '@/components/shared/admin-search-input';
import { Brand, Family, Model } from '@/types/draft-types';

/**
 * AdminProductsFilters component props
 */
interface AdminProductsFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Currently selected family */
  selectedFamily: string;
  /** Callback when family selection changes */
  onFamilyChange: (family: string) => void;
  /** Currently selected brand */
  selectedBrand: string;
  /** Callback when brand selection changes */
  onBrandChange: (brand: string) => void;
  /** Currently selected model */
  selectedModel: string;
  /** Callback when model selection changes */
  onModelChange: (model: string) => void;
  /** Available families for filtering */
  families: Family[];
  /** Available brands for filtering */
  brands: Brand[];
  /** Available models for filtering */
  models: Model[];
  /** Whether the component is in loading state */
  loading?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Whether to show the clear filters button */
  showClearFilters?: boolean;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
}

/**
 * AdminProductsFilters component for search and filtering admin products
 * Provides search input and dropdown filters for family, brand, and model
 */
export const AdminProductsFilters: React.FC<AdminProductsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedFamily,
  onFamilyChange,
  selectedBrand,
  onBrandChange,
  selectedModel,
  onModelChange,
  families,
  brands,
  models,
  loading = false,
  className = '',
  showClearFilters = true,
  onClearFilters
}) => {
  const { t } = useTranslation();

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = selectedFamily !== 'all' || 
                          selectedBrand !== 'all' || 
                          selectedModel !== 'all' || 
                          searchQuery.trim() !== '';

  /**
   * Get filtered models based on selected brand and family
   */
  const getFilteredModels = (): Model[] => {
    return models.filter(model => {
      const brandMatch = selectedBrand === 'all' || model.idBrand.toString() === selectedBrand;
      const familyMatch = selectedFamily === 'all' || model.idFamily.toString() === selectedFamily;
      return brandMatch && familyMatch;
    });
  };

  /**
   * Handle clear filters
   */
  const handleClearFilters = () => {
    onSearchChange('');
    onFamilyChange('all');
    onBrandChange('all');
    onModelChange('all');
    onClearFilters?.();
  };

  /**
   * Get family name by ID
   */
  const getFamilyName = (familyId: string): string => {
    if (familyId === 'all') return t('products.filters.all');
    const family = families.find(f => f.idFamily.toString() === familyId);
    return family?.familyName || '';
  };

  /**
   * Get brand name by ID
   */
  const getBrandName = (brandId: string): string => {
    if (brandId === 'all') return t('products.filters.all');
    const brand = brands.find(b => b.idBrand.toString() === brandId);
    return brand?.brandName || '';
  };

  /**
   * Get model name by ID
   */
  const getModelName = (modelId: string): string => {
    if (modelId === 'all') return t('products.filters.all');
    const model = models.find(m => m.idModel.toString() === modelId);
    return model?.modelName || '';
  };

  const filteredModels = getFilteredModels();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and Filter Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('admin.products.filter')}</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              Active
            </Badge>
          )}
        </div>
        
        {showClearFilters && hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center gap-2"
            disabled={loading}
          >
            <X className="h-4 w-4" />
            {t('admin.products.clearFilters')}
          </Button>
        )}
      </div>

      {/* Search Input */}
      <AdminSearchInput
        value={searchQuery}
        onDebouncedChange={onSearchChange}
        disabled={loading}
      />

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Family Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('admin.products.selectFamily')}
          </label>
          <Select 
            value={selectedFamily} 
            onValueChange={onFamilyChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.products.selectFamily')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.filters.all')}</SelectItem>
              {families.map((family) => (
                <SelectItem key={family.idFamily} value={family.idFamily.toString()}>
                  {family.familyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('admin.products.selectBrand')}
          </label>
          <Select 
            value={selectedBrand} 
            onValueChange={onBrandChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.products.selectBrand')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.filters.all')}</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.idBrand} value={brand.idBrand.toString()}>
                  {brand.brandName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Model Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {t('admin.products.selectModel')}
          </label>
          <Select 
            value={selectedModel} 
            onValueChange={onModelChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.products.selectModel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.filters.all')}</SelectItem>
              {filteredModels.map((model) => (
                <SelectItem key={model.idModel} value={model.idModel.toString()}>
                  {model.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchQuery.trim() && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              Search: "{searchQuery}"
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onSearchChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {selectedFamily !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              Family: {getFamilyName(selectedFamily)}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onFamilyChange('all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {selectedBrand !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              Brand: {getBrandName(selectedBrand)}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onBrandChange('all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {selectedModel !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              Model: {getModelName(selectedModel)}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onModelChange('all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
