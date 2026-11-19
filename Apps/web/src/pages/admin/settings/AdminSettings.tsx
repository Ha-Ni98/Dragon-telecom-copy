/**
 * Admin Settings Page
 * Complete settings management interface with all sections
 */

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Settings,
  Tag,
  Truck,
  Bell,
  Shield,
  Palette,
  Store,
  Receipt,
  Layers,
  Star,
  PackageX,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { ClientCategoriesSection } from "@/pages/admin/clients/components/client-categories-section";
import { DeliveryFeesSection } from "@/pages/admin/settings/components/delivery-fees-section";
import { StoreSettingsForm } from "@/pages/admin/settings/components/store-settings-form";
import { InvoicingSettingsForm } from "@/pages/admin/settings/components/invoicing-settings-form";
import { HierarchyPanel } from "@/pages/admin/settings/components/hierarchy-panel";
import { DisabledProductsPanel } from "@/pages/admin/settings/components/disabled-products-panel";
import { StorefrontSettings } from "@/pages/admin/settings/components/storefront-settings";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import type { StoreSettingsFormValues } from "@/pages/admin/settings/components/store-settings.schema";
import type { InvoicingSettingsFormValues } from "@/pages/admin/settings/components/invoicing-settings.schema";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlatformSettings, useUpdatePlatformSettings } from "@/hooks/usePlatform";
import {
  useCatalogFamilies,
  useCatalogBrands,
  useCatalogModels,
  useCreateCatalogFamily,
  useCreateCatalogBrand,
  useCreateCatalogModel,
  useUpdateCatalogFamily,
  useUpdateCatalogBrand,
  useUpdateCatalogModel,
  useSetModelFamilies,
} from "@/hooks/useCatalogTaxonomy";
import { useAdminCatalogProducts, useUpdateProduct } from "@/hooks/useCatalogProducts";
import { ImagePurpose, ProductEnabledFilter, type AdminProductDto } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";

// ADM-17 — Sprint 3 retyped the tabs whose existing component was structurally compatible with
// the real DTOs (Categories -> ClientCategoryDto; Delivery fees -> AdminFeesDto). Sprint 4 added
// the remaining four tabs as page-local primitives with placeholder data. Sprint 8 wires
// `usePlatformSettings`/`useUpdatePlatformSettings` (Store/Invoicing/Storefront) +
// `useCatalogFamilies/Brands/Models` (Hierarchy). "Accounts" was already dropped from the active
// tab tree here since Sprint 4: ADM-16 (Users & roles) owns user management (plan §Deletion
// Audit) — the stub `admin-accounts-section.tsx`/`admin-account-dialog.tsx` files themselves
// were deleted in Sprint 9 (zero remaining consumers).
//
// S17 rebuilt the Storefront tab: it now drives a server-searched product picker (a static
// 100-row page could neither show nor find a product outside it, so a featured product beyond
// that page rendered its raw uuid) plus a new featured-**families** picker capped at 6
// (StorefrontSettingsInputSchema's own `.max(6)`, mirrored client-side). Both lists are draft
// state batched into one real PATCH on Save — the old Save button only fired a toast; every
// actual write happened one PATCH per chip via onAdd/onRemove.
//
// S21 added the Disabled Products tab, driven by `useAdminCatalogProducts` with the new
// `enabledStatus: DISABLED` filter — `listAdminProducts` used to hardcode `isEnabled: true`, so a
// product disabled from /admin/products' row switch was unreachable again once it left that page.
// Families/brands/models needed no new tab: the Hierarchy tab already listed disabled rows (the
// admin taxonomy routes already passed includeDisabled); it only gained an Enable button.
export default function AdminSettings() {
  const { t } = useTranslation();

  // Configuration: Set to false to hide general settings tab
  const SHOW_GENERAL_SETTINGS = false;

  const [activeTab, setActiveTab] = useState(SHOW_GENERAL_SETTINGS ? "general" : "categories");
  const [sequenceDecreaseError, setSequenceDecreaseError] = useState(false);

  const settingsQuery = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();

  const families = useCatalogFamilies({}, true);
  const brands = useCatalogBrands(true);
  const models = useCatalogModels({}, true);
  const createFamily = useCreateCatalogFamily();
  const createBrand = useCreateCatalogBrand();
  const createModel = useCreateCatalogModel();
  const updateFamily = useUpdateCatalogFamily();
  const updateBrand = useUpdateCatalogBrand();
  const updateModel = useUpdateCatalogModel();
  const setModelFamilies = useSetModelFamilies();
  const hierarchyLoading = families.isLoading || brands.isLoading || models.isLoading;

  // S21 — the disabled-products list is its own paginated query; `enabledStatus` is part of the
  // ProductListQuery, so `qk.catalog.adminProducts.list(query)` already gives it a cache entry
  // distinct from /admin/products' own enabled-only list. No new query key is needed.
  const [disabledPage, setDisabledPage] = useState(1);
  const disabledProducts = useAdminCatalogProducts({
    enabledStatus: ProductEnabledFilter.DISABLED,
    page: disabledPage,
    limit: 15,
  });
  const updateProduct = useUpdateProduct();

  // --- Storefront tab (S17) ---
  // Draft state: the tab batches both lists into one PATCH instead of one PATCH per chip (the
  // old Save button did nothing at all — see the deleted handleSaveStorefront below). Seeded
  // from the server whenever the settings query resolves or refetches; local edits win until
  // Save or a fresh server value arrives.
  const [draftProductIds, setDraftProductIds] = useState<string[] | null>(null);
  const [draftFamilyIds, setDraftFamilyIds] = useState<string[] | null>(null);
  const savedProductIds = settingsQuery.data?.storefront.featuredProductIds;
  const savedFamilyIds = settingsQuery.data?.storefront.featuredFamilyIds;
  useEffect(() => {
    if (savedProductIds) setDraftProductIds(savedProductIds);
  }, [savedProductIds]);
  useEffect(() => {
    if (savedFamilyIds) setDraftFamilyIds(savedFamilyIds);
  }, [savedFamilyIds]);
  // Memoized so the `?? []` fallback doesn't mint a new array identity every render, which would
  // otherwise recompute every useMemo below on each render regardless of an actual change.
  const productIds = useMemo(
    () => draftProductIds ?? savedProductIds ?? [],
    [draftProductIds, savedProductIds],
  );
  const familyIds = useMemo(
    () => draftFamilyIds ?? savedFamilyIds ?? [],
    [draftFamilyIds, savedFamilyIds],
  );

  // Picker options: server-side search (a static 100-row page could neither show nor find a
  // product outside it — the real cause of the old picker's uuid-chip bug). 300 ms, the debounce
  // every other admin search on this app uses.
  const [productSearchInput, setProductSearchInput] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearchInput, 300);
  const productSearchResult = useAdminCatalogProducts({
    search: debouncedProductSearch || undefined,
    page: 1,
    limit: 20,
  });

  // Chip labels: resolved by id, so a featured product outside the search page still shows its
  // name instead of a raw uuid (catalog.service.ts#staffAdminWhere was taught the `ids` filter
  // the public list already honoured, for this).
  const featuredProductsResult = useAdminCatalogProducts(
    { ids: productIds.join(","), page: 1, limit: 100 },
    { enabled: productIds.length > 0 },
  );
  const featuredProductNameById = useMemo(
    () => new Map((featuredProductsResult.data?.items ?? []).map((p) => [p.id, p.name])),
    [featuredProductsResult.data],
  );
  const featuredProducts = useMemo(
    () => productIds.map((id) => ({ id, name: featuredProductNameById.get(id) ?? id })),
    [productIds, featuredProductNameById],
  );
  const productOptions: AutocompleteOption[] = useMemo(
    () =>
      (productSearchResult.data?.items ?? [])
        .filter((p) => !productIds.includes(p.id))
        .map((p) => ({ value: p.id, label: p.name })),
    [productSearchResult.data, productIds],
  );

  // Families reuse the Hierarchy tab's existing query — no extra request.
  const familyNameById = useMemo(
    () => new Map((families.data ?? []).map((f) => [f.id, f.name])),
    [families.data],
  );
  const featuredFamilies = useMemo(
    () => familyIds.map((id) => ({ id, name: familyNameById.get(id) ?? id })),
    [familyIds, familyNameById],
  );
  const familyOptions: AutocompleteOption[] = useMemo(
    () =>
      (families.data ?? [])
        .filter((f) => !familyIds.includes(f.id))
        .map((f) => ({ value: f.id, label: f.name })),
    [families.data, familyIds],
  );

  const MAX_FEATURED_FAMILIES = 6; // mirrors StorefrontSettingsInputSchema's own .max(6)

  const storefrontDirty =
    JSON.stringify(productIds) !== JSON.stringify(savedProductIds ?? []) ||
    JSON.stringify(familyIds) !== JSON.stringify(savedFamilyIds ?? []);

  const handleSaveStore = (values: StoreSettingsFormValues) => {
    updateSettings.mutate(
      { store: values },
      { onSuccess: () => toast.success(t("admin.settings.saveSuccess")) },
    );
  };

  // S26.1 — a logo commits immediately on upload rather than waiting for the text form's Save,
  // mirroring ProductImagesSection (an upload is its own mutation there too). This is also why
  // storeSettingsSchema no longer carries logoUrl: two writers for one field would race.
  const handleSaveStoreLogo = (patch: { logoUrl?: string; printLogoUrl?: string }) => {
    updateSettings.mutate(
      { store: patch },
      { onSuccess: () => toast.success(t("admin.settings.saveSuccess")) },
    );
  };

  const handleSaveInvoicing = (values: InvoicingSettingsFormValues) => {
    setSequenceDecreaseError(false);
    updateSettings.mutate(
      { invoicing: values },
      {
        onSuccess: () => toast.success(t("admin.settings.saveSuccess")),
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 409) {
            setSequenceDecreaseError(true);
          }
        },
      },
    );
  };

  const handleAddProduct = (id: string) =>
    setDraftProductIds((prev) => {
      const current = prev ?? savedProductIds ?? [];
      return current.includes(id) ? current : [...current, id];
    });
  const handleRemoveProduct = (id: string) =>
    setDraftProductIds((prev) => (prev ?? savedProductIds ?? []).filter((x) => x !== id));
  const handleAddFamily = (id: string) =>
    setDraftFamilyIds((prev) => {
      const current = prev ?? savedFamilyIds ?? [];
      if (current.includes(id) || current.length >= MAX_FEATURED_FAMILIES) return current;
      return [...current, id];
    });
  const handleRemoveFamily = (id: string) =>
    setDraftFamilyIds((prev) => (prev ?? savedFamilyIds ?? []).filter((x) => x !== id));

  const handleCreateFamily = (name: string) => {
    createFamily.mutate(
      { name },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.createSuccess")) },
    );
  };
  const handleCreateBrand = (name: string) => {
    createBrand.mutate(
      { name },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.createSuccess")) },
    );
  };
  const handleCreateModel = (name: string, brandId: string, familyIds: string[]) => {
    createModel.mutate(
      { name, brandId },
      {
        onSuccess: (model) => {
          toast.success(t("admin.settings.hierarchy.createSuccess"));
          if (familyIds.length > 0) {
            setModelFamilies.mutate({ id: model.id, command: { familyIds } });
          }
        },
      },
    );
  };
  const handleDisableFamily = (id: string) => {
    updateFamily.mutate(
      { id, command: { isEnabled: false } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.disableSuccess")) },
    );
  };
  const handleDisableBrand = (id: string) => {
    updateBrand.mutate(
      { id, command: { isEnabled: false } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.disableSuccess")) },
    );
  };
  const handleDisableModel = (id: string) => {
    updateModel.mutate(
      { id, command: { isEnabled: false } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.disableSuccess")) },
    );
  };
  const handleEnableFamily = (id: string) => {
    updateFamily.mutate(
      { id, command: { isEnabled: true } },
      {
        onSuccess: (family) => {
          toast.success(t("admin.settings.hierarchy.enableSuccess"));
          // Q5 — warn only, never block. A disabled parent does not hide anything (the storefront
          // filters on the product row alone), but the child family will not surface under it in
          // the family pickers until the parent is back.
          const parent = family.parentId
            ? (families.data ?? []).find((f) => f.id === family.parentId)
            : undefined;
          if (parent && !parent.isEnabled) {
            toast.warning(t("admin.settings.hierarchy.parentStillDisabled", { name: parent.name }));
          }
        },
      },
    );
  };
  const handleEnableBrand = (id: string) => {
    updateBrand.mutate(
      { id, command: { isEnabled: true } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.enableSuccess")) },
    );
  };
  const handleEnableModel = (id: string) => {
    updateModel.mutate(
      { id, command: { isEnabled: true } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.enableSuccess")) },
    );
  };

  // S26.1 — Brand.logoUrl / Family.iconUrl already existed and were already rendered by the
  // home page; these two handlers are the only missing piece (a way to set them). Both hooks'
  // existing `qk.catalog.families.all()` / `qk.catalog.brands.all()` invalidation already
  // refreshes the admin list and the public storefront list — no new query key needed.
  const handleSetFamilyIcon = (id: string, iconUrl: string) =>
    updateFamily.mutate(
      { id, command: { iconUrl } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.logoUpdateSuccess")) },
    );
  const handleSetBrandLogo = (id: string, logoUrl: string) =>
    updateBrand.mutate(
      { id, command: { logoUrl } },
      { onSuccess: () => toast.success(t("admin.settings.hierarchy.logoUpdateSuccess")) },
    );

  const handleEnableProduct = (product: AdminProductDto) => {
    updateProduct.mutate(
      { id: product.id, command: { isEnabled: true } },
      {
        onSuccess: () => {
          toast.success(t("admin.settings.disabledProducts.enableSuccess"));
          // Q5 — warn only. The product is live on the storefront immediately regardless; the
          // parent merely stays out of the filter dropdowns until it is re-enabled too.
          const stillDisabled = [
            !product.family.isEnabled ? product.family.name : null,
            !product.brand.isEnabled ? product.brand.name : null,
          ].filter(Boolean);
          if (stillDisabled.length > 0) {
            toast.warning(
              t("admin.settings.disabledProducts.parentDisabledToast", {
                names: stillDisabled.join(", "),
              }),
            );
          }
        },
      },
    );
  };

  const handleSaveStorefront = () => {
    updateSettings.mutate(
      { storefront: { featuredProductIds: productIds, featuredFamilyIds: familyIds } },
      { onSuccess: () => toast.success(t("admin.settings.saveSuccess")) },
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <SectionTitle as="h1" className="text-3xl font-bold">
          <span className="flex items-center gap-2">
            <Settings className="h-8 w-8" />
            {t("admin.settings.title")}
          </span>
        </SectionTitle>
        <p className="text-muted-foreground">{t("admin.settings.description")}</p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList
          className={`grid w-full grid-cols-2 ${SHOW_GENERAL_SETTINGS ? "lg:grid-cols-8" : "lg:grid-cols-7"}`}
        >
          {SHOW_GENERAL_SETTINGS && (
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t("admin.settings.general")}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.categories")}</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.delivery")}</span>
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.store")}</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.invoicing")}</span>
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.hierarchy")}</span>
          </TabsTrigger>
          <TabsTrigger value="disabled-products" className="flex items-center gap-2">
            <PackageX className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.disabledProducts")}</span>
          </TabsTrigger>
          <TabsTrigger value="storefront" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.settings.tabs.storefront")}</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab - Hidden but code preserved for future use */}
        {SHOW_GENERAL_SETTINGS && (
          <TabsContent value="general" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t("admin.settings.general.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.settings.general.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">{t("admin.settings.general.storeName")}</Label>
                    <Input id="storeName" defaultValue="Dragon Telecom" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storeEmail">{t("admin.settings.general.storeEmail")}</Label>
                    <Input id="storeEmail" defaultValue="contact@dragontelecom.dz" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storePhone">{t("admin.settings.general.storePhone")}</Label>
                    <Input id="storePhone" defaultValue="+213 21 123 456" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">{t("admin.settings.general.storeAddress")}</Label>
                    <Input id="storeAddress" defaultValue="Algiers, Algeria" />
                  </div>
                  <Button>
                    <Settings className="h-4 w-4 mr-2" />
                    {t("admin.settings.general.save")}
                  </Button>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t("admin.settings.notifications.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.settings.notifications.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.notifications.newOrders")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.notifications.newOrdersDesc")}
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.notifications.lowStock")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.notifications.lowStockDesc")}
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.notifications.customerMessages")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.notifications.customerMessagesDesc")}
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.notifications.systemUpdates")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.notifications.systemUpdatesDesc")}
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {t("admin.settings.security.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.settings.security.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">
                      {t("admin.settings.security.sessionTimeout")}
                    </Label>
                    <Select defaultValue="60">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">
                          30 {t("admin.settings.security.minutes")}
                        </SelectItem>
                        <SelectItem value="60">1 {t("admin.settings.security.hour")}</SelectItem>
                        <SelectItem value="120">2 {t("admin.settings.security.hours")}</SelectItem>
                        <SelectItem value="240">4 {t("admin.settings.security.hours")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.security.twoFactor")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.security.twoFactorDesc")}
                      </p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("admin.settings.security.loginNotifications")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("admin.settings.security.loginNotificationsDesc")}
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Button variant="outline">{t("admin.settings.security.changePassword")}</Button>
                </CardContent>
              </Card>

              {/* Appearance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    {t("admin.settings.appearance.title")}
                  </CardTitle>
                  <CardDescription>{t("admin.settings.appearance.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("admin.settings.appearance.theme")}</Label>
                    <Select defaultValue="system">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          {t("admin.settings.appearance.light")}
                        </SelectItem>
                        <SelectItem value="dark">{t("admin.settings.appearance.dark")}</SelectItem>
                        <SelectItem value="system">
                          {t("admin.settings.appearance.system")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.settings.appearance.language")}</Label>
                    <Select defaultValue="en">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{t("admin.settings.appearance.english")}</SelectItem>
                        <SelectItem value="fr">{t("admin.settings.appearance.french")}</SelectItem>
                        <SelectItem value="ar">{t("admin.settings.appearance.arabic")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.settings.appearance.currency")}</Label>
                    <Select defaultValue="dzd">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dzd">{t("admin.settings.appearance.dzd")}</SelectItem>
                        <SelectItem value="eur">{t("admin.settings.appearance.eur")}</SelectItem>
                        <SelectItem value="usd">{t("admin.settings.appearance.usd")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Client Categories Tab */}
        <TabsContent value="categories">
          <ClientCategoriesSection />
        </TabsContent>

        {/* Delivery Fees Tab */}
        <TabsContent value="delivery">
          <DeliveryFeesSection />
        </TabsContent>

        {/* Store Tab */}
        <TabsContent value="store" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.settings.store.logos.title")}</CardTitle>
              <CardDescription>{t("admin.settings.store.logos.description")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ImageUploadField
                value={settingsQuery.data?.store.logoUrl}
                purpose={ImagePurpose.STORE_LOGO}
                label={t("admin.settings.store.logos.storeLogo")}
                hint={t("admin.settings.store.logos.storeLogoHelp")}
                onUploaded={(url) => handleSaveStoreLogo({ logoUrl: url })}
                disabled={updateSettings.isPending}
              />
              <ImageUploadField
                value={settingsQuery.data?.store.printLogoUrl}
                purpose={ImagePurpose.PRINT_LOGO}
                label={t("admin.settings.store.logos.printLogo")}
                hint={t("admin.settings.store.logos.printLogoHelp")}
                onUploaded={(url) => handleSaveStoreLogo({ printLogoUrl: url })}
                disabled={updateSettings.isPending}
                previewClassName="h-20 w-40 bg-white"
              />
            </CardContent>
          </Card>

          {settingsQuery.isLoading ? (
            <TableSkeleton rows={3} columns={1} />
          ) : settingsQuery.isError ? (
            <NotFoundState
              icon={<Store className="h-6 w-6" />}
              title={t("admin.settings.saveError")}
              body={t("admin.settings.description")}
              action={
                <Button variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : (
            <StoreSettingsForm
              values={settingsQuery.data?.store}
              onSave={handleSaveStore}
              isSaving={updateSettings.isPending}
            />
          )}
        </TabsContent>

        {/* Invoicing Tab */}
        <TabsContent value="invoicing">
          {settingsQuery.isLoading ? (
            <TableSkeleton rows={4} columns={1} />
          ) : settingsQuery.isError ? (
            <NotFoundState
              icon={<Receipt className="h-6 w-6" />}
              title={t("admin.settings.saveError")}
              body={t("admin.settings.description")}
              action={
                <Button variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : (
            <InvoicingSettingsForm
              values={settingsQuery.data?.invoicing}
              onSave={handleSaveInvoicing}
              isSaving={updateSettings.isPending}
              sequenceDecreaseError={sequenceDecreaseError}
            />
          )}
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy">
          <HierarchyPanel
            families={families.data ?? []}
            brands={brands.data ?? []}
            models={models.data ?? []}
            isLoading={hierarchyLoading}
            onCreateFamily={handleCreateFamily}
            onCreateBrand={handleCreateBrand}
            onCreateModel={handleCreateModel}
            onDisableFamily={handleDisableFamily}
            onDisableBrand={handleDisableBrand}
            onDisableModel={handleDisableModel}
            onEnableFamily={handleEnableFamily}
            onEnableBrand={handleEnableBrand}
            onEnableModel={handleEnableModel}
            onSetFamilyIcon={handleSetFamilyIcon}
            onSetBrandLogo={handleSetBrandLogo}
          />
        </TabsContent>

        {/* Disabled Products Tab */}
        <TabsContent value="disabled-products">
          <DisabledProductsPanel
            products={disabledProducts.data?.items ?? []}
            isLoading={disabledProducts.isLoading}
            page={disabledProducts.data?.meta.page ?? 1}
            totalPages={disabledProducts.data?.meta.totalPages ?? 1}
            onPageChange={setDisabledPage}
            onEnable={handleEnableProduct}
            isEnabling={updateProduct.isPending}
          />
        </TabsContent>

        {/* Storefront Tab */}
        <TabsContent value="storefront">
          {settingsQuery.isLoading ? (
            <TableSkeleton rows={3} columns={1} />
          ) : settingsQuery.isError ? (
            <NotFoundState
              icon={<Star className="h-6 w-6" />}
              title={t("admin.settings.saveError")}
              body={t("admin.settings.description")}
              action={
                <Button variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : (
            <StorefrontSettings
              featuredProducts={featuredProducts}
              productOptions={productOptions}
              productSearch={productSearchInput}
              onProductSearchChange={setProductSearchInput}
              isProductSearchLoading={productSearchResult.isFetching}
              onAddProduct={handleAddProduct}
              onRemoveProduct={handleRemoveProduct}
              featuredFamilies={featuredFamilies}
              familyOptions={familyOptions}
              onAddFamily={handleAddFamily}
              onRemoveFamily={handleRemoveFamily}
              isDirty={storefrontDirty}
              onSave={handleSaveStorefront}
              isSaving={updateSettings.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
