import { NEW_ARRIVALS_DEFAULT_LIMIT, type ProductListQuery } from "@dragon-telecom/contract";
import { ProductRow } from "@/components/sections/landing/product-row";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import { catalogFamilyLink } from "@/lib/deep-links";

// S39 — products of the family chosen in Settings → Storefront (S38's repairToolsFamilyId; a stored
// id, not a product flag). The row hides when nothing is chosen, when the chosen family is not in
// the public (enabled) families list — the public products endpoint does not check a family's
// flag (S21 Q5), so this checks it, keeping S38's "hidden while the family is disabled" promise —
// and, via ProductRow, when the family has no products.
export function RepairToolsRow() {
  const { t } = useTranslation();
  const { data: settings } = usePublicSettings();
  const { data: families } = useCatalogFamilies();

  const familyId = settings?.storefront.repairToolsFamilyId;
  const familyEnabled = !!familyId && (families ?? []).some((family) => family.id === familyId);

  const query: ProductListQuery = {
    page: 1,
    limit: NEW_ARRIVALS_DEFAULT_LIMIT,
    ...(familyId ? { familyId } : {}),
  };
  const { data, isLoading, isError, refetch } = useCatalogProducts(query, {
    enabled: familyEnabled,
  });

  if (!familyEnabled || !familyId) return null;

  return (
    <ProductRow
      title={t("home.rows.repairTools")}
      seeAllTo={catalogFamilyLink(familyId)}
      products={data?.items ?? []}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
