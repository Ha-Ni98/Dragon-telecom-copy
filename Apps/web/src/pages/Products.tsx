import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useProducts } from "@/hooks/use-products";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { ProductFilters } from "@/components/shared/ProductFilters";
import { ProductGrid } from "@/components/shared/ProductGrid";
import { ProductListHeader } from "@/components/shared/ProductListHeader";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import type { BrandDto, FamilyDto, DeviceModelDto } from "@dragon-telecom/contract";

/**
 * Products page component
 * Displays all products with search and filtering capabilities
 */

// Bridge (pub-pages Sprint 3): useBrands/useCategories/useModels (use-brands.ts/use-models.ts)
// are shared with out-of-set admin pages, so they stay on the draft-typed shape and can't feed
// the now-DTO-typed ProductFilters. Real brand/family/model data lands with Sprint 5's URL-driven
// rewire (useCatalogBrands/useCatalogFamilies/useCatalogModels) — until then these empty,
// correctly-typed arrays keep the filters compiling without changing behavior (they were always
// empty via the old stub too).
const EMPTY_BRANDS: BrandDto[] = [];
const EMPTY_CATEGORIES: FamilyDto[] = [];
const EMPTY_MODELS: DeviceModelDto[] = [];

export default function Products() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModel, setSelectedModel] = useState("all");

  // Hooks for data fetching
  const { data: productsData, isLoading: productsLoading, error: productsError } = useProducts();
  const brands = EMPTY_BRANDS;
  const categories = EMPTY_CATEGORIES;
  const models = EMPTY_MODELS;

  // Hooks for user interactions
  const { isAuthenticated } = useAuth();
  // Cart isn't wired yet (deferred to Sub-02, decision #2).
  const addToCart = useCallback(async (_productId: string) => {}, []);

  const allProducts = useMemo(() => productsData ?? [], [productsData]);

  // Handle URL parameters on component mount with validation
  useEffect(() => {
    const brandParam = searchParams.get('brand');
    const categoryParam = searchParams.get('category');
    const modelParam = searchParams.get('model');
    const searchParam = searchParams.get('search');
    // Validate and set brand parameter
    if (brandParam && brands.find(brand => brand.id === brandParam)) {
      setSelectedBrand(brandParam);
    }

    // Validate and set category parameter
    if (categoryParam && categories.some(category => category.id === categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    // Validate and set model parameter
    if (modelParam && models.some(model => model.id === modelParam)) {
      setSelectedModel(modelParam);
    }

    // Set search parameter
    if (searchParam) {
      setSearchQuery(decodeURIComponent(searchParam));
    }
  }, [searchParams, brands, categories, models]);

  // Update URL parameters when filters change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();

      if (searchQuery.trim()) {
        params.set('search', encodeURIComponent(searchQuery.trim()));
      }
      if (selectedBrand !== 'all') {
        params.set('brand', selectedBrand);
      }
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (selectedModel !== 'all') {
        params.set('model', selectedModel);
      }

      // Only update URL if parameters have changed
      const currentParams = searchParams.toString();
      const newParams = params.toString();

      if (currentParams !== newParams) {
        setSearchParams(params, { replace: true });
      }
    }, 300); // 300ms debounce for search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedBrand, selectedCategory, selectedModel, setSearchParams, searchParams]);

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Search filter
      const matchesSearch = searchQuery.trim() === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.family.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Brand filter
      const matchesBrand = selectedBrand === 'all' ||
        product.brand.id === selectedBrand;

      // Category filter
      const matchesCategory = selectedCategory === 'all' ||
        product.family.id === selectedCategory;

      // Model filter
      const matchesModel = selectedModel === 'all' ||
        product.model?.id === selectedModel;

      return matchesSearch && matchesBrand && matchesCategory && matchesModel;
    });
  }, [allProducts, searchQuery, selectedBrand, selectedCategory, selectedModel]);

  // Event handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleBrandChange = useCallback((brand: string) => {
    setSelectedBrand(brand);
    // Reset model when brand changes to prevent invalid combinations
    setSelectedModel('all');
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    // Reset model when category changes to prevent invalid combinations
    setSelectedModel('all');
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  // Get available models based on current brand and category selection
  const getAvailableModels = useMemo(() => {
    return models.filter(model => {
      const brandMatch = selectedBrand === 'all' || model.brandId === selectedBrand;
      const categoryMatch = selectedCategory === 'all' || model.familyIds.includes(selectedCategory);
      return brandMatch && categoryMatch;
    });
  }, [models, selectedBrand, selectedCategory]);

  // Validate current model selection against available models
  useEffect(() => {
    if (selectedModel !== 'all' && !getAvailableModels.some(model => model.id === selectedModel)) {
      setSelectedModel('all');
    }
  }, [selectedModel, getAvailableModels]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBrand('all');
    setSelectedCategory('all');
    setSelectedModel('all');
  }, []);

  const handleProductClick = useCallback((productId: string) => {
    // Navigate to product details page
    window.location.href = `/products/${productId}`;
  }, []);

  const handleAddToCart = useCallback(async (productId: string) => {
    if (!isAuthenticated) {
      toast.error(t('auth.loginRequired') || 'Please sign in to add items to cart');
      window.location.href = '/login';
      return;
    }
    const product = allProducts.find(product => product.id === productId);
    if (!product) {
      toast.error(t('products.productNotFound') || 'Product not found');
      return;
    }
    if (!product.inStock) {
      toast.error(t('products.outOfStock') || 'Product is out of stock');
      return;
    }

    try {
      await addToCart(product.id);
      toast.success(t('cart.addSuccess') || `${product.name} added to cart`);
    } catch (error) {
      toast.error(t('cart.addError') || 'Failed to add product to cart');
    }
  }, [isAuthenticated, allProducts, addToCart, t]);

  // Loading and error states
  const isLoadingData = productsLoading;
  const hasError = productsError;

  return (
    <div>
      <main className="py-8 px-4 sm:px-8 md:px-12">
        <div className="container mx-auto px-4">
          <ErrorBoundary>
            {/* Page Header */}
            <ProductListHeader
              title={t('products.page.title')}
              description={t('products.page.description')}
              totalProducts={allProducts.length}
              filteredCount={filteredProducts.length}
              isLoading={isLoadingData}
              showStats={true}
              averageRating={undefined}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Filters */}
            <div className="mb-8">
              <ProductFilters
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                selectedBrand={selectedBrand}
                onBrandChange={handleBrandChange}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                brands={brands}
                categories={categories}
                models={getAvailableModels}
                isLoading={isLoadingData}
                showClearFilters={true}
                onClearFilters={handleClearFilters}
              />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            {/* Products Grid */}
            <ProductGrid
              products={filteredProducts}
              isLoading={isLoadingData}
              error={hasError ? 'Failed to load products' : undefined}
              onProductClick={handleProductClick}
              onAddToCart={handleAddToCart}
              showPrice={isAuthenticated}
              columns={{
                mobile: 1,
                tablet: 2,
                desktop: 4
              }}
              showSkeletons={true}
              skeletonCount={9}
              enablePagination={true}
              itemsPerPage={15}
            />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
