import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Grid, List, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useFeaturedProducts, useProducts } from "@/hooks/use-products";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductCard } from "@/components/shared/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import type { ProductWithPricingDto } from "@dragon-telecom/contract";

const brands = ["All", "Apple", "Samsung", "Google", "OnePlus", "Dell", "Sony", "LG", "Nintendo", "Microsoft"];
const categories = ["All", "Smartphones", "Tablets", "Laptops", "Accessories", "TVs", "Gaming"];

export function ProductsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Use real authentication state; cart isn't wired yet (deferred to Sub-02, decision #2).
  const { isAuthenticated } = useAuth();
  const addToCart = useCallback(async (_productId: string) => {}, []);

  const { data: productsData, isLoading: isLoadingAll, isError: isErrorAll, refetch: refetchAll } = useProducts();
  const { data: featuredData, isLoading: isLoadingFeatured, isError: isErrorFeatured, refetch: refetchFeatured } = useFeaturedProducts(10);

  const allProducts = useMemo(() => productsData ?? [], [productsData]);
  const featuredProducts = useMemo(() => featuredData ?? [], [featuredData]);

  const handleAddToCart = useCallback(async (product: ProductWithPricingDto) => {
    try {
      addToCart(product.id);
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  }, [addToCart]);

  const handleViewProduct = useCallback((productId: string) => {
    // PUB-03: routes "by id — never by name" (D1).
    navigate(`/products/${productId}`);
  }, [navigate]);

  // Filter all products
  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === "All" || product.brand.name === selectedBrand;
    const matchesCategory = selectedCategory === "All" || product.family.name === selectedCategory;

    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Pagination for all products view
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  if (showAllProducts) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          {/* Header with Back Button */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => setShowAllProducts(false)}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t('public.products.backToFeatured')}
            </Button>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('public.products.allProducts')}</h2>
            <p className="text-lg text-muted-foreground">
              {t('public.products.allProductsSubtitle')}
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('header.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Brand Filter */}
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder={t('public.products.selectBrand')} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder={t('public.products.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="px-3"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-muted-foreground">
              {t('public.products.showingCount', { shown: paginatedProducts.length, total: filteredProducts.length })}
            </p>
          </div>

          {/* Products Grid */}
          {isLoadingAll ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : isErrorAll ? (
            <div className="mb-8">
              <NotFoundState
                title={t('products.errorLoading')}
                body={t('products.errorLoadingBody')}
                action={
                  <Button variant="outline" onClick={() => refetchAll()}>
                    {t('common.actions.tryAgain')}
                  </Button>
                }
              />
            </div>
          ) : paginatedProducts.length > 0 ? (
            <div className={viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              : "space-y-4 mb-8"
            }>
              {paginatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showPrice={isAuthenticated}
                  onAddToCart={() => handleAddToCart(product)}
                  onViewDetails={() => handleViewProduct(product.id)}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">{t('public.products.noProductsFound')}</p>
            </div>
          )}

          {/* Simple Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                {t('common.previous')}
              </Button>
              <span className="flex items-center px-4">
                {t('common.pagination.pageOf', { page: currentPage, total: totalPages })}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Featured Products View (default)
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('products.featured')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('products.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {isLoadingFeatured ? (
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
          ) : isErrorFeatured ? (
            <div className="col-span-full">
              <NotFoundState
                title={t('products.errorLoading')}
                body={t('products.errorLoadingBody')}
                action={
                  <Button variant="outline" onClick={() => refetchFeatured()}>
                    {t('common.actions.tryAgain')}
                  </Button>
                }
              />
            </div>
          ) : featuredProducts.length > 0 ? (
            featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showPrice={isAuthenticated}
                onAddToCart={() => handleAddToCart(product)}
                onViewDetails={() => handleViewProduct(product.id)}
                isAuthenticated={isAuthenticated}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-lg text-muted-foreground">{t('public.products.noProductsFound')}</p>
            </div>
          )}
        </div>

        {/* View All Products Button */}
        <div className="text-center mt-12">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/products')}
          >
            {t('products.viewAll')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
