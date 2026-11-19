import { Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AssetTile } from "@/components/shared/AssetTile";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { HomeSectionHeader } from "@/components/sections/landing/home-section-header";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import type { FamilyDto } from "@dragon-telecom/contract";
import { catalogFamilyLink } from "@/lib/deep-links";

// S39 — a horizontally scrolling row of family tiles on phones, a full 6-column row from md up
// (the set). Each icon sits on the light AssetTile in both themes, so a dark transparent icon can
// never vanish. The tile's alt is "" because the family name is printed right under it.
export function CategoriesSection() {
  const { t } = useTranslation();
  const { data: publicSettings } = usePublicSettings();
  const featuredFamilyIds = publicSettings?.storefront.featuredFamilyIds ?? [];
  const { data: families, isLoading, isError, refetch } = useCatalogFamilies({ withCount: true });

  if (isLoading) {
    return (
      <section className="min-w-0">
        <HomeSectionHeader title={t("categories.title")} />
        <ul className="-mx-4 flex gap-3 overflow-hidden px-4 pb-3 pt-1.5 md:mx-0 md:grid md:grid-cols-6 md:px-0 md:py-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="w-[28%] shrink-0 sm:w-[20%] md:w-auto">
              <Skeleton className="aspect-square w-full max-w-[6rem] rounded-xl" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // Local error — a failed families fetch never takes the rest of the home page down with it
  // (each landing section fails independently, PUB-01).
  if (isError) {
    return (
      <section className="min-w-0">
        <NotFoundState
          title={t("categories.errorLoading")}
          body={t("categories.errorLoadingBody")}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t("common.actions.tryAgain")}
            </Button>
          }
        />
      </section>
    );
  }

  // S15/R2 — settings first, in the admin's own order; `Family.isFeatured` is the fallback
  // while no pick exists (S17 builds the picker). Six tiles either way.
  const items = featuredFamilyIds.length
    ? featuredFamilyIds
        .map((id) => (families ?? []).find((f) => f.id === id))
        .filter((f): f is FamilyDto => !!f)
    : (families ?? []).filter((f) => f.isFeatured).slice(0, 6);
  // Empty section hides itself (PUB-01).
  if (items.length === 0) return null;

  return (
    <section className="min-w-0">
      <HomeSectionHeader title={t("categories.title")} seeAllTo="/products" />
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1.5 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 md:py-0">
        {items.map((family) => (
          <li key={family.id} className="w-[28%] shrink-0 snap-start sm:w-[20%] md:w-auto">
            <Link
              to={catalogFamilyLink(family.id)}
              className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-shadow hover:ring-2 hover:ring-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              <AssetTile className="aspect-square w-full max-w-[6rem]">
                {family.iconUrl ? (
                  <img
                    src={family.iconUrl}
                    alt=""
                    className="h-full w-full object-contain p-3"
                    loading="lazy"
                  />
                ) : (
                  <Package className="h-8 w-8" aria-hidden="true" />
                )}
              </AssetTile>
              <span className="line-clamp-2 text-xs font-medium sm:text-sm">{family.name}</span>
              {family.productCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {t("categories.productCount", { count: family.productCount })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
