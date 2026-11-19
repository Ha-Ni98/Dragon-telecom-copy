import { ProductRow } from "@/components/sections/landing/product-row";
import { useTranslation } from "@/hooks/useTranslation";
import { useNewArrivals } from "@/hooks/useCatalogProducts";
import { catalogNewestLink } from "@/lib/deep-links";

// S39 — newest products, at most 3 per family: the cap is applied by the api in SQL, so one big
// delivery cannot fill the row.
export function NewArrivalsRow() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useNewArrivals();
  return (
    <ProductRow
      cardLabel={t("home.rows.newLabel")}
      title={t("home.rows.newArrivals")}
      seeAllTo={catalogNewestLink()}
      products={data ?? []}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
