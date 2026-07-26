import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { useAdminCatalogProduct } from "@/hooks/useCatalogProducts";
import { ProductInformationHeader } from "@/pages/admin/products/components/product-information-header";
import { ProductDetailsSection } from "@/pages/admin/products/components/product-details-section";
import { ProductImagesSection } from "@/pages/admin/products/components/product-images-section";
import { ProductPricingSection } from "@/pages/admin/products/components/enhanced-pricing-section";
import { ProductMovementsTab } from "@/pages/admin/products/components/product-movements-tab";
import { ProductSupplyHistoryTab } from "@/pages/admin/products/components/product-supply-history-tab";
import { ProductSalesHistoryTab } from "@/pages/admin/products/components/product-sales-history-tab";
import { useEditMode } from "@/pages/admin/products/use-edit-mode";
import { formatDZD } from "@/lib/utils";

// ADM-04 — set-03 Sprint 5 rewire. Was numeric-id + a fake in-memory hook chain
// (useProductInformationPageState/useProductPricing, Sub-01). Real hook: useAdminCatalogProduct
// (now carrying categoryPrices per A1). Edit-mode section pattern (spec: "one header Edit/Save/
// Cancel spanning all cards") — the header owns isEditMode; details+pricing forms live in
// use-edit-mode.ts's shared save/cancel orchestration. Images act immediately (their own
// mutations, not gated by edit mode — matches how an upload naturally commits). Supply/Sales
// history tabs are the A4 resolution: no new endpoints, useProductSupplyHistory/
// useProductSalesHistory (useProductHistory.ts, Sprint 2) over the existing purchasing/
// inventory reads. product-suppliers-table.tsx + add-supply-button.tsx are retired — "no stock
// entry here" (ADM-02's own note) applies to this page too.
export default function AdminProductInformation() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: product, isLoading, isError } = useAdminCatalogProduct(productId ?? "");
  const editMode = useEditMode(product);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.productInfo.back")}
        </Button>
        <NotFoundState
          title={t("admin.productInfo.notFound")}
          body={t("admin.productInfo.error")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProductInformationHeader
        product={product}
        isEditMode={editMode.isEditMode}
        isSaving={editMode.isSaving}
        onBack={() => navigate("/admin/products")}
        onToggleEdit={editMode.toggle}
        onSave={editMode.save}
        onCancel={editMode.cancel}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductDetailsSection
          product={product}
          isEditMode={editMode.isEditMode}
          register={editMode.detailsForm.register}
          errors={editMode.detailsForm.formState.errors}
        />
        <ProductImagesSection product={product} />
      </div>

      <ProductPricingSection
        product={product}
        isEditMode={editMode.isEditMode}
        register={editMode.pricingForm.register}
        control={editMode.pricingForm.control}
        errors={editMode.pricingForm.formState.errors}
        watch={editMode.pricingForm.watch}
      />

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:grid-cols-3 lg:grid-cols-6">
        <StockStat label={t("admin.productInfo.stock.onHand")} value={product.quantityOnHand} />
        <StockStat label={t("admin.productInfo.stock.reserved")} value={product.quantityReserved} />
        <StockStat
          label={t("admin.productInfo.stock.available")}
          value={product.availableQuantity}
        />
        <StockStat
          label={t("admin.productInfo.stock.avgCost")}
          value={product.avgStockPrice}
          money
        />
        <StockStat
          label={t("admin.productInfo.stock.stockValue")}
          value={product.quantityOnHand * product.avgStockPrice}
          money
        />
        <StockStat
          label={t("admin.productInfo.stock.threshold")}
          value={product.reorderThreshold}
        />
      </div>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">{t("admin.productInfo.tabs.movements")}</TabsTrigger>
          <TabsTrigger value="supply">{t("admin.productInfo.tabs.supplyHistory")}</TabsTrigger>
          <TabsTrigger value="sales">{t("admin.productInfo.tabs.salesHistory")}</TabsTrigger>
        </TabsList>
        <TabsContent value="movements">
          <ProductMovementsTab productId={product.id} />
        </TabsContent>
        <TabsContent value="supply">
          <ProductSupplyHistoryTab productId={product.id} />
        </TabsContent>
        <TabsContent value="sales">
          <ProductSalesHistoryTab productId={product.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockStat({ label, value, money }: { label: string; value: number; money?: boolean }) {
  const { language } = useTranslation();
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{money ? formatDZD(value, language) : value}</div>
    </div>
  );
}
