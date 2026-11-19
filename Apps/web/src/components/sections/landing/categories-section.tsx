import { Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import type { FamilyDto } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { catalogFamilyLink } from "@/lib/deep-links";

export function CategoriesSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: publicSettings } = usePublicSettings();
  const featuredFamilyIds = publicSettings?.storefront.featuredFamilyIds ?? [];
  const { data: families, isLoading, isError, refetch } = useCatalogFamilies({ withCount: true });

  if (isLoading) {
    return (
      <section className="py-8">
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
      </section>
    );
  }

  // Local error — a failed families fetch never takes the rest of the home page down with it
  // (each landing section fails independently, PUB-01).
  if (isError) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <NotFoundState
            title={t("categories.errorLoading")}
            body={t("categories.errorLoadingBody")}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                {t("common.actions.tryAgain")}
              </Button>
            }
          />
        </div>
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
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <SectionTitle align="center" className="text-3xl md:text-4xl font-bold mb-4">
            {t("categories.title")}
          </SectionTitle>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("categories.description")}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((family) => (
            <Card
              key={family.id}
              className="group cursor-pointer product-card border-0 shadow-card transition-shadow hover:ring-2 hover:ring-highlight focus-within:ring-2 focus-within:ring-highlight"
              onClick={() => navigate(catalogFamilyLink(family.id))}
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                  {family.iconUrl ? (
                    <img
                      src={family.iconUrl}
                      alt={family.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-white" />
                  )}
                </div>
                <h3 className="font-semibold text-sm md:text-base mb-2 group-hover:text-primary transition-colors">
                  {family.name}
                </h3>
                {family.productCount !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {t("categories.productCount", { count: family.productCount })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
