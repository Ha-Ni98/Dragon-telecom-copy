import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { usePublicSettings } from "@/hooks/usePlatform";
import { ProductGrid } from "@/components/shared/ProductGrid";
import type { ProductListQuery } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";

// PUB-01: "featured ProductGrid (8 cards), inline search input, family select, grid/list
// toggle." Search submit and family selection are pure navigation to the Catalog page (scope
// confinement — this section links there, it doesn't own that destination); the grid/list
// toggle is local display only.
export function ProductsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFamily, setSelectedFamily] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // S15/F3 — the admin's explicit pick (settings.storefront.featuredProductIds) wins; `featured:
  // true` (products whose *family* is featured) is the fallback while no pick exists, so the
  // home page is never empty.
  const { data: publicSettings } = usePublicSettings();
  const featuredIds = publicSettings?.storefront.featuredProductIds ?? [];
  const productQuery: ProductListQuery = featuredIds.length
    ? { ids: featuredIds.join(","), page: 1, limit: Math.min(featuredIds.length, 24) }
    : { featured: true, page: 1, limit: 8 };
  const {
    data: productsResult,
    isLoading,
    isError,
    refetch,
  } = useCatalogProducts(productQuery, {
    enabled: publicSettings !== undefined,
  });
  // CategoriesSection now reads its own unconditional `{ withCount: true }` query (S15) — no
  // longer the same key this section uses, so this is a distinct network call.
  const { data: familiesData } = useCatalogFamilies({ featured: true, limit: 6, withCount: true });

  const products = productsResult?.items ?? [];
  const families = familiesData ?? [];

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/products?search=${encodeURIComponent(query)}`);
  };

  const handleFamilyChange = (familyId: string) => {
    setSelectedFamily(familyId);
    if (familyId !== "all") navigate(`/products?familyId=${familyId}`);
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <SectionTitle align="center" className="text-3xl md:text-4xl font-bold mb-4">
            {t("products.featured")}
          </SectionTitle>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("products.description")}
          </p>
        </div>

        {/* Search + family select + view toggle */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t("header.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </form>

          <Select value={selectedFamily} onValueChange={handleFamilyChange}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t("products.filters.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products.filters.all")}</SelectItem>
              {families.map((family) => (
                <SelectItem key={family.id} value={family.id}>
                  {family.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="px-3"
              aria-label={t("products.gridView")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="px-3"
              aria-label={t("products.listView")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ProductGrid
          products={products}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          columns={
            viewMode === "grid"
              ? { mobile: 1, tablet: 2, desktop: 4 }
              : { mobile: 1, tablet: 1, desktop: 1 }
          }
          showSkeletons
          skeletonCount={8}
        />

        {/* View All Products Button */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" onClick={() => navigate("/products")}>
            {t("products.viewAll")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
