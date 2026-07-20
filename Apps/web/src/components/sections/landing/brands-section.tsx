import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandWithCount } from '@/types/draft-types/main-page.types';
import { useBrands } from '@/hooks/use-brands';
import { NotFoundState } from '@/components/shared/NotFoundState';

/**
 * BrandsSection component props
 */
interface BrandsSectionProps {
  /** Custom className for styling */
  className?: string;
  /** Maximum number of brands to display */
  maxBrands?: number;
  /** Whether to show scroll buttons */
  showScrollButtons?: boolean;
  /** Whether to show "View All" button */
  showViewAllButton?: boolean;
}

/**
 * Brand card component
 */
interface BrandCardProps {
  brand: BrandWithCount;
  onBrandClick: (brandId: number, brandName: string) => void;
}

const BrandCard: React.FC<BrandCardProps> = ({ brand, onBrandClick }) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onBrandClick(brand.idBrand, brand.brandName);
  };

  return (
    <Card 
      className="group cursor-pointer product-card border-0 shadow-card hover:shadow-elegant transition-all duration-300 hover:scale-105"
      onClick={handleClick}
    >
      <CardContent className="p-6 text-center">
        {/* Brand Logo */}
        <div className="mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform w-20 h-20">
          {brand.logo ? (
            <img 
              src={brand.logo} 
              alt={brand.brandName}
              className="w-full h-full object-cover rounded-2xl"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {brand.brandName.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Brand Name */}
        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
          {brand.brandName}
        </h3>

        {/* Product Count */}
        <p className="text-sm text-muted-foreground mb-3">
          {brand.productCount} {t('brands.products')}
        </p>

        {/* View Products Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('brands.viewProducts')}
        </Button>
      </CardContent>
    </Card>
  );
};

/**
 * Brands section component for main page
 */
export const BrandsSection: React.FC<BrandsSectionProps> = ({
  className = '',
  maxBrands = 8,
  showScrollButtons = true,
  showViewAllButton = false
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: brandsData, isLoading, isError, refetch } = useBrands();
  const brands = useMemo(() => (brandsData ?? []).slice(0, maxBrands), [brandsData, maxBrands]);

  /**
   * Handle brand click - navigate to products page with brand filter
   */
  const handleBrandClick = (_brandId: number, brandName: string) => {
    navigate(`/products?brand=${encodeURIComponent(_brandId)}`);
  };

  /**
   * Handle scroll left
   */
  const handleScrollLeft = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  /**
   * Handle scroll right
   */
  const handleScrollRight = () => {
    const maxIndex = Math.max(0, brands.length - 4); // Show 4 brands at a time on desktop
    setCurrentIndex(prev => Math.min(maxIndex, prev + 1));
  };

  /**
   * Handle view all brands
   */
  const handleViewAllBrands = () => {
    navigate('/products?view=brands');
  };

  // Loading state
  if (isLoading) {
    return (
      <section className={`py-8 ${className}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Error state — local to this section so a failed brands fetch never takes down the rest of
  // the home page (each landing section fails independently, PUB-01).
  if (isError) {
    return (
      <section className={`py-16 ${className}`}>
        <div className="container mx-auto px-4">
          <NotFoundState
            title={t('brands.errorLoading')}
            body={t('brands.errorLoadingBody')}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.actions.tryAgain')}
              </Button>
            }
          />
        </div>
      </section>
    );
  }

  // Empty state
  if (brands.length === 0) {
    return (
      <section className={`py-16 ${className}`}>
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('brands.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('brands.noneAvailable')}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`py-16 ${className}`}>
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('brands.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('brands.description')}
          </p>
        </div>

        {/* Brands Grid */}
        <div className="relative">
          {/* Scroll Buttons - Desktop */}
          {showScrollButtons && brands.length > 4 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                onClick={handleScrollLeft}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm"
                onClick={handleScrollRight}
                disabled={currentIndex >= brands.length - 4}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Brands Container */}
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * (100 / Math.min(4, brands.length))}%)`
              }}
            >
              {brands.map((brand) => (
                <div 
                  key={brand.idBrand} 
                  className="flex-shrink-0 w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/4 px-2"
                >
                  <BrandCard 
                    brand={brand} 
                    onBrandClick={handleBrandClick}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* View All Button */}
        {showViewAllButton && (
          <div className="text-center mt-12">
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleViewAllBrands}
            >
              {t('brands.viewAll')}
              <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Mobile Scroll Indicators */}
        {showScrollButtons && brands.length > 2 && (
          <div className="flex justify-center mt-6 md:hidden">
            <div className="flex space-x-2">
              {Array.from({ length: Math.ceil(brands.length / 2) }).map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    Math.floor(currentIndex / 2) === i 
                      ? 'bg-primary' 
                      : 'bg-muted'
                  }`}
                  onClick={() => setCurrentIndex(i * 2)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrandsSection;
