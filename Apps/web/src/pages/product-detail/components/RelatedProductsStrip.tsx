import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProduct } from "@/hooks/useCatalogProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

// D7 (engine gap, plan.md): ProductDetailDto exposes only relatedIds, no summaries — there's no
// batch by-ids endpoint. Interim fix: a bounded per-id useCatalogProduct fan-out, one call per
// RelatedProductCard *instance* (each a separate component), not a loop inside one component —
// that's the part of the Rules of Hooks this has to respect. Flagged upstream: the detail
// endpoint returning related summaries directly would be the cleaner long-term fix.
const MAX_RELATED = 4;

function RelatedProductCard({ id }: { id: string }) {
  const { data: product, isLoading } = useCatalogProduct(id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  // An id that no longer resolves (disabled/deleted product) is simply omitted from the strip.
  if (!product) return null;

  return <ProductCard product={product} />;
}

interface RelatedProductsStripProps {
  relatedIds: string[];
}

export function RelatedProductsStrip({ relatedIds }: RelatedProductsStripProps) {
  const { t } = useTranslation();
  const boundedIds = relatedIds.slice(0, MAX_RELATED);

  if (boundedIds.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("product.relatedProducts")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {boundedIds.map((id) => (
          <RelatedProductCard key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
