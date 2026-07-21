/**
 * Admin Settings Page
 * Complete settings management interface with all sections
 */

import React, { useMemo, useState } from "react";
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
import { StorefrontSettings } from "@/pages/admin/settings/components/storefront-settings";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { NotFoundState } from "@/components/shared/NotFoundState";
import type { StoreSettingsFormValues } from "@/pages/admin/settings/components/store-settings.schema";
import type { InvoicingSettingsFormValues } from "@/pages/admin/settings/components/invoicing-settings.schema";
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
import { useAdminCatalogProducts } from "@/hooks/useCatalogProducts";

// ADM-17 — Sprint 3 retyped the tabs whose existing component was structurally compatible with
// the real DTOs (Categories -> ClientCategoryDto; Delivery fees -> AdminFeesDto). Sprint 4 added
// the remaining four tabs as page-local primitives with placeholder data. Sprint 8 wires
// `usePlatformSettings`/`useUpdatePlatformSettings` (Store/Invoicing/Storefront) +
// `useCatalogFamilies/Brands/Models` (Hierarchy). "Accounts" stays dropped from the active tree
// (not deleted): ADM-16 (Users & roles) now owns user management (plan §Deletion Audit) — the
// stub `admin-accounts-section.tsx`/`admin-account-dialog.tsx` are flagged for Sprint 9.
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

  // Product options for the Storefront featured-picker — same "one generous page, no
  // search-as-you-type UI in a wiring sprint" call as AdminInventory's adjustment-form product
  // picker (useAdminCatalogProducts({ page: 1, limit: 100 })). A featured product outside this
  // first 100 falls back to showing its raw id in the chip until it appears in this page.
  const adminProducts = useAdminCatalogProducts({ page: 1, limit: 100 });
  const featuredIds = useMemo(
    () => settingsQuery.data?.storefront.featuredProductIds ?? [],
    [settingsQuery.data],
  );
  const productNameById = useMemo(
    () => new Map((adminProducts.data?.items ?? []).map((p) => [p.id, p.name])),
    [adminProducts.data],
  );
  const featuredProducts = useMemo(
    () => featuredIds.map((id) => ({ id, name: productNameById.get(id) ?? id })),
    [featuredIds, productNameById],
  );
  const productOptions = useMemo(
    () =>
      (adminProducts.data?.items ?? [])
        .filter((p) => !featuredIds.includes(p.id))
        .map((p) => ({ value: p.id, label: p.name })),
    [adminProducts.data, featuredIds],
  );

  const handleSaveStore = (values: StoreSettingsFormValues) => {
    updateSettings.mutate(
      { store: values },
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

  const handleAddFeatured = (productId: string) => {
    updateSettings.mutate({ storefront: { featuredProductIds: [...featuredIds, productId] } });
  };

  const handleRemoveFeatured = (productId: string) => {
    updateSettings.mutate({
      storefront: { featuredProductIds: featuredIds.filter((id) => id !== productId) },
    });
  };

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

  const handleSaveStorefront = () => {
    toast.success(t("admin.settings.saveSuccess"));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          {t("admin.settings.title")}
        </h1>
        <p className="text-muted-foreground">{t("admin.settings.description")}</p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList
          className={`grid w-full grid-cols-2 ${SHOW_GENERAL_SETTINGS ? "lg:grid-cols-7" : "lg:grid-cols-6"}`}
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
        <TabsContent value="store">
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
              onAdd={handleAddFeatured}
              onRemove={handleRemoveFeatured}
              onSave={handleSaveStorefront}
              isSaving={updateSettings.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
