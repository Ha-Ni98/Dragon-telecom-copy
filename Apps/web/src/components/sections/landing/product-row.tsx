import { useRef } from "react";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductWithPricingDto } from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { ProductCard } from "@/components/shared/ProductCard";
import { HomeSectionHeader } from "@/components/sections/landing/home-section-header";
import { useTranslation } from "@/hooks/useTranslation";

// Card widths in the row. On a phone 42% leaves about 2.3 cards in view — the partial third card
// is what tells a thumb the row scrolls (the set). They widen with the viewport.
const CARD_WIDTH = "w-[42%] shrink-0 snap-start sm:w-[29%] md:w-[22%] lg:w-[18%]";

interface ProductRowProps {
  title: string;
  seeAllTo?: string;
  products: ProductWithPricingDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

// S39 — one home-page product row: a horizontally scrolling, snapping strip of ProductCards.
// - An empty row hides itself (PUB-01); a failed one shows a local retry, never taking the page
//   down. The `ul` is the ONLY scroller — its parent is min-w-0 — so the page itself never gains a
//   horizontal scrollbar.
// - Phones swipe. md+ also gets prev/next buttons, because a horizontal-only scroller is
//   unreachable with a plain mouse.
export function ProductRow({
  title,
  seeAllTo,
  products,
  isLoading,
  isError,
  onRetry,
}: ProductRowProps) {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <section className="min-w-0">
        <HomeSectionHeader title={title} />
        <ul className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:px-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className={CARD_WIDTH}>
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="mt-3 h-3 w-1/2" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-5 w-2/3" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="min-w-0">
        <HomeSectionHeader title={title} />
        <NotFoundState
          icon={<AlertCircle className="h-6 w-6" />}
          title={t("products.errorLoading")}
          body={t("products.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={onRetry}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="min-w-0">
      <HomeSectionHeader title={title} seeAllTo={seeAllTo} />
      <div className="relative">
        <ul
          ref={scrollerRef}
          // -mx-4 / px-4 lets the row bleed to the screen edge on phones (the partial card
          // touches it); both are cancelled from md up, where the container has its own gutter.
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0"
        >
          {products.map((product) => (
            <li key={product.id} className={CARD_WIDTH}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute -left-3 top-1/3 hidden rounded-full shadow md:inline-flex"
          aria-label={t("home.rows.scrollPrevious")}
          onClick={() => scrollBy(-1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute -right-3 top-1/3 hidden rounded-full shadow md:inline-flex"
          aria-label={t("home.rows.scrollNext")}
          onClick={() => scrollBy(1)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
