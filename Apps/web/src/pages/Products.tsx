import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useProducts } from "@/hooks/use-products";
import { useBrands, useCategories } from "@/hooks/use-brands";
import { useModels } from "@/hooks/use-models";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { ProductFilters } from "@/components/shared/ProductFilters";
import { ProductGrid } from "@/components/shared/ProductGrid";
import { ProductListHeader } from "@/components/shared/ProductListHeader";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

/**
 * Products page component
 * Displays all products with search and filtering capabilities
 */

export default function Products() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModel, setSelectedModel] = useState("all");
  // Loading states for user interactions (for future use)
  // const [isAddingToCart, setIsAddingToCart] = useState<number | null>(null);
  // const [isAddingToWishlist, setIsAddingToWishlist] = useState<number | null>(null);
  
  // Hooks for data fetching
  const { data: productsData, isLoading: productsLoading, error: productsError } = useProducts();
  const { data: brandsData, isLoading: brandsLoading } = useBrands();
  const { data: categoriesData } = useCategories();
  const { data: modelsData } = useModels();

  // Hooks for user interactions
  const { isAuthenticated } = useAuth();
  // Cart isn't wired yet (deferred to Sub-02, decision #2).
  const addToCart = useCallback(async (_product: unknown, _quantity: number) => {}, []);

  const allProducts = useMemo(() => productsData ?? [], [productsData]);
  const brands = useMemo(() => brandsData ?? [], [brandsData]);
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const models = useMemo(() => modelsData ?? [], [modelsData]);

  // Handle URL parameters on component mount with validation
  useEffect(() => {
    const brandParam = searchParams.get('brand');
    const categoryParam = searchParams.get('category');
    const modelParam = searchParams.get('model');
    const searchParam = searchParams.get('search');
    // Validate and set brand parameter
    if (brandParam && brands.find(brand => brand.idBrand.toString() === brandParam)) {
      setSelectedBrand(brandParam);
    }

    // Validate and set category parameter
    if (categoryParam && categories.some(category => category.idFamily.toString() === categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    // Validate and set model parameter
    if (modelParam && models.some(model => model.idModel.toString() === modelParam)) {
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
        product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.family.familyName.toLowerCase().includes(searchQuery.toLowerCase());

      // Brand filter
      const matchesBrand = selectedBrand === 'all' || 
        product.brand.idBrand.toString() === selectedBrand;

      // Category filter
      const matchesCategory = selectedCategory === 'all' || 
        product.family.idFamily.toString() === selectedCategory;

      // Model filter
      const matchesModel = selectedModel === 'all' || 
        product.model.idModel.toString() === selectedModel;

      return matchesSearch && matchesBrand && matchesCategory && matchesModel;
    });
  }, [allProducts, searchQuery, selectedBrand, selectedCategory, selectedModel]);

  // Calculate statistics

  const featuredCount = useMemo(() => {
    return filteredProducts.filter(product => product.isNew).length;
  }, [filteredProducts]);

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
      const brandMatch = selectedBrand === 'all' || model.idBrand.toString() === selectedBrand;
      const categoryMatch = selectedCategory === 'all' || model.idFamily.toString() === selectedCategory;
      return brandMatch && categoryMatch;
    });
  }, [models, selectedBrand, selectedCategory]);

  // Validate current model selection against available models
  useEffect(() => {
    if (selectedModel !== 'all' && !getAvailableModels.some(model => model.idModel.toString() === selectedModel)) {
      setSelectedModel('all');
    }
  }, [selectedModel, getAvailableModels]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBrand('all');
    setSelectedCategory('all');
    setSelectedModel('all');
  }, []);

  const handleProductClick = useCallback((productId: number) => {
    // Navigate to product details page
    window.location.href = `/product/${productId}`;
  }, []);

  const handleAddToCart = useCallback(async (productId: number) => {
    if (!isAuthenticated) {
      toast.error(t('auth.loginRequired') || 'Please sign in to add items to cart');
      window.location.href = '/login';
      return;
    }
    const product = allProducts.find(product => product.idProduct === productId);
    if (!product) {
      toast.error(t('products.productNotFound') || 'Product not found');
      return;
    }
    if (!product.inStock) {
      toast.error(t('products.outOfStock') || 'Product is out of stock');
      return;
    }

    try {
      // setIsAddingToCart(product.idProduct); // For future loading state
      await addToCart(product, 1);
      toast.success(t('cart.addSuccess') || `${product.productName} added to cart`);
    } catch (error) {
      toast.error(t('cart.addError') || 'Failed to add product to cart');
    } finally {
      // setIsAddingToCart(null); // For future loading state
    }
  }, [isAuthenticated, allProducts, addToCart, t]);



  // Loading and error states
  const isLoadingData = productsLoading || brandsLoading;
  const hasError = productsError;

  // SEO Meta Tags
  useEffect(() => {
    const pageTitle = t('products.page.title') || 'All Products';
    const pageDescription = t('products.page.description') || 'Discover our complete collection of premium electronics and accessories';
    
    // Update document title
    document.title = `${pageTitle} | Dragon Telecom`;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', pageDescription);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = pageDescription;
      document.head.appendChild(meta);
    }
    
    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    const keywords = 'products, electronics, smartphones, tablets, laptops, accessories, dragon telecom';
    if (metaKeywords) {
      metaKeywords.setAttribute('content', keywords);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'keywords';
      meta.content = keywords;
      document.head.appendChild(meta);
    }
    
    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', pageTitle);
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', pageDescription);
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', window.location.href);
    }
  }, [t, filteredProducts.length]);

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
              featuredCount={featuredCount}
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