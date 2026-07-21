/**
 * Admin Settings Page
 * Complete settings management interface with all sections
 */

import React, { useState } from "react";
import { Settings, Tag, Truck, Bell, Shield, Palette } from "lucide-react";
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

// ADM-17 — Sprint 3 retypes only the tabs whose existing component was structurally
// compatible with the real DTOs (Categories -> ClientCategoryDto; Delivery fees -> AdminFeesDto).
// Two tabs are dropped from the active tree here, not deleted (Sprint 9 grep-gates the actual
// file removal):
//  - "Accounts": ADM-16 (Users & roles) now owns user management (plan §Deletion Audit) — the
//    stub `admin-accounts-section.tsx`/`admin-account-dialog.tsx` are flagged for Sprint 9.
//  - "Hierarchy": the existing `product-hierarchy-section.tsx` models one family+brand per
//    model (delete support) — structurally incompatible with the real taxonomy DTOs' disable-
//    only convention and `SetModelFamiliesCommand`'s families **multi-select** (a model can
//    belong to several families). This isn't a rename/retype, it's a rebuild — correctly
//    Sprint 4's "hierarchy-panel" (new), not this sprint's job.
export default function AdminSettings() {
  const { t } = useTranslation();

  // Configuration: Set to false to hide general settings tab
  const SHOW_GENERAL_SETTINGS = false;

  const [activeTab, setActiveTab] = useState(SHOW_GENERAL_SETTINGS ? "general" : "categories");

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
          className={`grid w-full grid-cols-2 ${SHOW_GENERAL_SETTINGS ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}
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
      </Tabs>
    </div>
  );
}
