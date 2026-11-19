import { NEW_ARRIVALS_DEFAULT_LIMIT, type ProductListQuery } from "@dragon-telecom/contract";
import { ProductRow } from "@/components/sections/landing/product-row";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import { catalogFamilyLink } from "@/lib/deep-links";

// S39 — products of the family chosen in Settings → Storefront (S38's repairToolsFamilyId; a stored
// id, not a product flag). The row is titled with that family's own name (owner request after the
// S39 review), not a fixed "Repair tools" label, so it reads right whatever family is chosen.
// The row hides when nothing is chosen, when the chosen family is not in the public (enabled)
// families list — the public products endpoint does not check a family's flag (S21 Q5), so this
// checks it, keeping S38's "hidden while the family is disabled" promise — and, via ProductRow,
// when the family has no products.
export function RepairToolsRow() {
  const { data: settings } = usePublicSettings();
  const { data: families } = useCatalogFamilies();

  const familyId = settings?.storefront.repairToolsFamilyId;
  const family = familyId ? (families ?? []).find((f) => f.id === familyId) : undefined;
  const familyEnabled = family !== undefined;

  const query: ProductListQuery = {
    page: 1,
    limit: NEW_ARRIVALS_DEFAULT_LIMIT,
    ...(familyId ? { familyId } : {}),
  };
  const { data, isLoading, isError, refetch } = useCatalogProducts(query, {
    enabled: familyEnabled,
  });

  if (!family || !familyId) return null;

  return (
    <ProductRow
      title={family.name}
      seeAllTo={catalogFamilyLink(familyId)}
      products={data?.items ?? []}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
    />
  );
}
