import type { ProductListQuery } from "@dragon-telecom/contract";
import { ProductRow } from "@/components/sections/landing/product-row";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { usePublicSettings } from "@/hooks/usePlatform";

// PUB-01's featured strip. S39: a scrolling ProductRow — the old inline search input, family
// select and grid/list toggle are gone (the catalog is where filtering belongs, and that bar
// competed with the hero and the category row for the first screen).
export function FeaturedProductsRow() {
  const { t } = useTranslation();

  // S15/F3 — the admin's explicit pick (settings.storefront.featuredProductIds) wins; `featured:
  // true` (products whose *family* is featured) is the fallback while no pick exists, so the
  // home page is never empty.
  const { data: publicSettings } = usePublicSettings();
  const featuredIds = publicSettings?.storefront.featuredProductIds ?? [];
  const productQuery: ProductListQuery = featuredIds.length
    ? { ids: featuredIds.join(","), page: 1, limit: Math.min(featuredIds.length, 24) }
    : { featured: true, page: 1, limit: 8 };
  const { data, isLoading, isError, refetch } = useCatalogProducts(productQuery, {
    enabled: publicSettings !== undefined,
  });

  // The ids query comes back by createdAt; the admin's picker is ORDERED, so follow it.
  const products = data?.items ?? [];
  const ordered = featuredIds.length
    ? [...products].sort((a, b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id))
    : products;

  return (
    <ProductRow
      cardLabel={t("home.rows.featuredLabel")}
      title={t("products.featured")}
      seeAllTo="/products"
      products={ordered}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
