import { lazy, Suspense, memo } from "react";
import { HeroSlider } from "@/components/sections/landing/hero-slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Lazy load sections for better performance
const CategoriesSection = lazy(() =>
  import("@/components/sections/landing/categories-section").then((m) => ({
    default: m.CategoriesSection,
  })),
);
const FeaturedProductsRow = lazy(() =>
  import("@/components/sections/landing/featured-products-row").then((m) => ({
    default: m.FeaturedProductsRow,
  })),
);
const NewArrivalsRow = lazy(() =>
  import("@/components/sections/landing/new-arrivals-row").then((m) => ({
    default: m.NewArrivalsRow,
  })),
);
const RepairToolsRow = lazy(() =>
  import("@/components/sections/landing/repair-tools-row").then((m) => ({
    default: m.RepairToolsRow,
  })),
);
const BrandsSection = lazy(() =>
  import("@/components/sections/landing/brands-section").then((m) => ({
    default: m.BrandsSection,
  })),
);

// Compact loading placeholder shared by every section: a title bar and a strip of squares, at the
// widths the real rows use (S39).
const RowSkeleton = () => (
  <div className="min-w-0">
    <Skeleton className="mb-4 h-7 w-48" />
    <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:px-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          className="aspect-square w-[42%] shrink-0 sm:w-[29%] md:w-[22%] lg:w-[18%]"
        />
      ))}
    </div>
  </div>
);

// S39 order — hero → Categories → Featured → New arrivals → Repair tools → Brands. Categories and
// the first product row land on the first screen under the (~45%-tall) hero; Brands is now an
// every-brand grid that can run long, so it goes last. Each section fails independently
// (ErrorBoundary) and an empty one hides itself (PUB-01). `max-w-6xl px-4` lines the content up
// with the header and the footer.
const Index = memo(() => {
  return (
    <div>
      <main>
        <ErrorBoundary>
          <HeroSlider />
        </ErrorBoundary>
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:space-y-12">
          <ErrorBoundary>
            <Suspense fallback={<RowSkeleton />}>
              <CategoriesSection />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<RowSkeleton />}>
              <FeaturedProductsRow />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<RowSkeleton />}>
              <NewArrivalsRow />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <RepairToolsRow />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<RowSkeleton />}>
              <BrandsSection />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
});

Index.displayName = "Index";

export default Index;
