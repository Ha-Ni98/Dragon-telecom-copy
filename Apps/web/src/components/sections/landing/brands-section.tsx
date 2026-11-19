import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetTile } from "@/components/shared/AssetTile";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { HomeSectionHeader } from "@/components/sections/landing/home-section-header";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogBrands } from "@/hooks/useCatalogTaxonomy";
import { catalogBrandLink } from "@/lib/deep-links";

// Shared by the loading skeleton and the real grid so the two can never drift apart.
const GRID_CLASS = "grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8";

// S39 — a grid of EVERY enabled brand: about 4 per row on a phone, 7–8 on desktop. The old
// carousel (and its 8-brand cap) is gone — a grid shows the whole range at a glance, and a
// shopper looking for their phone's brand should not have to page through. Each logo sits on the
// light AssetTile in both themes, so a dark transparent logo can never vanish and a newly added
// brand cannot break (no per-brand override exists or should be added).
export function BrandsSection() {
  const { t } = useTranslation();
  const { data: brands, isLoading, isError, refetch } = useCatalogBrands();

  if (isLoading) {
    return (
      <section className="min-w-0">
        <HomeSectionHeader title={t("brands.title")} />
        <ul className={GRID_CLASS}>
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // Error state — local to this section so a failed brands fetch never takes down the rest of
  // the home page (each landing section fails independently, PUB-01).
  if (isError) {
    return (
      <section className="min-w-0">
        <NotFoundState
          title={t("brands.errorLoading")}
          body={t("brands.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      </section>
    );
  }

  // Empty section hides itself (PUB-01).
  if (!brands || brands.length === 0) return null;

  return (
    <section className="min-w-0">
      <HomeSectionHeader title={t("brands.title")} />
      <ul className={GRID_CLASS}>
        {brands.map((brand) => (
          <li key={brand.id} className="min-w-0">
            <Link
              to={catalogBrandLink(brand.id)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-1 text-center transition-shadow hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              <AssetTile className="aspect-square w-full">
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt=""
                    className="h-full w-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-lg font-bold">{brand.name.charAt(0)}</span>
                )}
              </AssetTile>
              <span className="w-full truncate text-xs font-medium">{brand.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
