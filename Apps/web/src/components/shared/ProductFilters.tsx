import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { Brand, Family, Model } from '@/types/draft-types';

/**
 * ProductFilters component props
 */
interface ProductFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Currently selected brand */
  selectedBrand: string;
  /** Callback when brand selection changes */
  onBrandChange: (brand: string) => void;
  /** Currently selected category */
  selectedCategory: string;
  /** Callback when category selection changes */
  onCategoryChange: (category: string) => void;
  /** Currently selected model */
  selectedModel: string;
  /** Callback when model selection changes */
  onModelChange: (model: string) => void;
  /** Available brands for filtering */
  brands: Brand[];
  /** Available categories for filtering */
  categories: Family[];
  /** Available models for filtering */
  models: Model[];
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
 * Provides search input and dropdown filters for brand, category, and model
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
  brands,
  categories,
  models,
  isLoading = false,
  className = '',
  showClearFilters = true,
  onClearFilters
}) => {
  const { t } = useTranslation();

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = selectedBrand !== 'all' || 
                          selectedCategory !== 'all' || 
                          selectedModel !== 'all' || 
                          searchQuery.trim() !== '';

  /**
   * Get filtered models based on selected brand and category
   */
  const getFilteredModels = (): Model[] => {
    return models.filter(model => {
      const brandMatch = selectedBrand === 'all' || model.idBrand.toString() === selectedBrand;
      const categoryMatch = selectedCategory === 'all' || model.idFamily.toString() === selectedCategory;
      return brandMatch && categoryMatch;
    });
  };

  /**
   * Handle clear filters
   */
  const handleClearFilters = () => {
    onSearchChange('');
    onBrandChange('all');
    onCategoryChange('all');
    onModelChange('all');
    onClearFilters?.();
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
   * Get category name by ID
   */
  const getCategoryName = (categoryId: string): string => {
    if (categoryId === 'all') return t('products.filters.all');
    const category = categories.find(c => c.idFamily.toString() === categoryId);
    return category?.familyName || '';
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
          <h3 className="text-lg font-semibold">{t('products.filters.title')}</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              {t('common.status.active')}
            </Badge>
          )}
        </div>
        
        {showClearFilters && hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
            {t('products.filters.clearAll')}
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={t('products.filters.search')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          disabled={isLoading}
          aria-label={t('products.filters.search')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Category Filter */}
        <div className="space-y-2">
          <label htmlFor="category-filter" className="text-sm font-medium">
            {t('products.filters.category')}
          </label>
          <Select
            value={selectedCategory}
            onValueChange={onCategoryChange}
            disabled={isLoading}
          >
            <SelectTrigger id="category-filter" aria-label={t('products.filters.category')}>
              <SelectValue placeholder={t('products.filters.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('products.filters.all')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.idFamily} value={category.idFamily.toString()}>
                  {category.familyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      {/* Category Filter */}



      {/* Filter Controls */}
      
        {/* Brand Filter */}
        <div className="space-y-2">
          <label htmlFor="brand-filter" className="text-sm font-medium">
            {t('products.filters.brand')}
          </label>
          <Select
            value={selectedBrand}
            onValueChange={onBrandChange}
            disabled={isLoading}
          >
            <SelectTrigger id="brand-filter" aria-label={t('products.filters.brand')}>
              <SelectValue placeholder={t('products.filters.brand')} />
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
          <label htmlFor="model-filter" className="text-sm font-medium">
            {t('products.filters.model')}
          </label>
          <Select
            value={selectedModel}
            onValueChange={onModelChange}
            disabled={isLoading || filteredModels.length === 0}
          >
            <SelectTrigger id="model-filter" aria-label={t('products.filters.model')}>
              <SelectValue placeholder={t('products.filters.model')} />
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

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{t('products.filters.activeFilters')}:</span>
          
          {searchQuery.trim() && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t('common.labels.search')}: "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t('products.filters.removeSearch')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedBrand !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t('products.filters.brand')}: {getBrandName(selectedBrand)}
              <button
                onClick={() => onBrandChange('all')}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t('products.filters.removeBrand')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedCategory !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t('products.filters.category')}: {getCategoryName(selectedCategory)}
              <button
                onClick={() => onCategoryChange('all')}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t('products.filters.removeCategory')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {selectedModel !== 'all' && (
            <Badge variant="outline" className="flex items-center gap-1">
              {t('products.filters.model')}: {getModelName(selectedModel)}
              <button
                onClick={() => onModelChange('all')}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
                aria-label={t('products.filters.removeModel')}
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
