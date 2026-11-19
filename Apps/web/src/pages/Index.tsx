import { lazy, Suspense, memo } from "react";
import { HeroSection } from "@/components/sections/landing/hero-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Lazy load sections for better performance
const CategoriesSection = lazy(() => import("@/components/sections/landing/categories-section").then(module => ({ default: module.CategoriesSection })));
const BrandsSection = lazy(() => import("@/components/sections/landing/brands-section").then(module => ({ default: module.BrandsSection })));
const ProductsSection = lazy(() => import("@/components/sections/landing/products-section").then(module => ({ default: module.ProductsSection })));

// Loading skeleton for sections
const SectionSkeleton = () => (
  <div className="py-16">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <Skeleton className="h-8 w-64 mx-auto mb-4" />
        <Skeleton className="h-4 w-full max-w-96 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  </div>
);

const Index = memo(() => {
  return (
    <div>
      <main>
        <HeroSection />
        <div className="px-4 sm:px-8 md:px-12 py-8 ">
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <CategoriesSection />
            </Suspense>
          </ErrorBoundary>
        </div>
        <div className="px-4 sm:px-8 md:px-12 py-4 ">
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <BrandsSection />
            </Suspense>
          </ErrorBoundary>
        </div>
        <div className="px-4 sm:px-8 md:px-12 py-8 ">
          <ErrorBoundary>
            <Suspense fallback={<SectionSkeleton />}>
              <ProductsSection />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
