import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { AssetTile } from "@/components/shared/AssetTile";
import { Plus, Layers, Image as ImageIcon } from "lucide-react";
import {
  ImagePurpose,
  LOGO_IMAGE_GUIDANCE,
  type FamilyDto,
  type BrandDto,
  type DeviceModelDto,
} from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface HierarchyPanelProps {
  families: FamilyDto[];
  brands: BrandDto[];
  models: DeviceModelDto[];
  isLoading?: boolean;
  onCreateFamily: (name: string) => void;
  onCreateBrand: (name: string) => void;
  onCreateModel: (name: string, brandId: string, familyIds: string[]) => void;
  onDisableFamily: (id: string) => void;
  onDisableBrand: (id: string) => void;
  onDisableModel: (id: string) => void;
  /** S21 — the row is already rendered with a "Disabled" badge; this is the way back. Optional
   *  only so a pre-existing test rendering this component with the older prop set still
   *  type-checks (it never exercises a disabled row, so the Enable branch never renders there);
   *  every real caller (AdminSettings.tsx) always supplies all three. */
  onEnableFamily?: (id: string) => void;
  onEnableBrand?: (id: string) => void;
  onEnableModel?: (id: string) => void;
  /** S26.1 — Brand.logoUrl / Family.iconUrl have existed in the schema and been rendered by the
   *  home page since the start; there was simply no way to set them. Optional for the same
   *  reason onEnable* above is: an existing test renders this component without them. */
  onSetFamilyIcon?: (id: string, iconUrl: string) => void;
  onSetBrandLogo?: (id: string, logoUrl: string) => void;
}

// ADM-17 Hierarchy tab — the real rebuild replacing the old `product-hierarchy-section.tsx`
// (Sprint 3 finding: that stub modeled one family+brand per model with hard delete,
// structurally incompatible with `DeviceModelDto.familyIds` — a real multi-select — and the
// disable-only convention every other taxonomy DTO follows). Dumb (owns only local form state);
// Sprint 8 wires `useCatalogFamilies/Brands/Models` + `useCreate*`/`useSetModelFamilies`.
// S21 — rows can now be re-enabled from here too; the list has always included disabled rows (the
// admin taxonomy routes pass includeDisabled).
export function HierarchyPanel({
  families,
  brands,
  models,
  isLoading = false,
  onCreateFamily,
  onCreateBrand,
  onCreateModel,
  onDisableFamily,
  onDisableBrand,
  onDisableModel,
  onEnableFamily,
  onEnableBrand,
  onEnableModel,
  onSetFamilyIcon,
  onSetBrandLogo,
}: HierarchyPanelProps) {
  const { t } = useTranslation();
  const assetGuidance = t("admin.settings.hierarchy.assetGuidance", {
    min: LOGO_IMAGE_GUIDANCE.minSize,
    padding: LOGO_IMAGE_GUIDANCE.paddingPercent,
  });
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelBrandId, setNewModelBrandId] = useState("");
  const [newModelFamilyIds, setNewModelFamilyIds] = useState<string[]>([]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TableSkeleton rows={4} columns={1} />
        <TableSkeleton rows={4} columns={1} />
        <TableSkeleton rows={4} columns={1} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("admin.settings.hierarchy.disableOnly")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              {t("admin.settings.hierarchy.tabs.families")}
            </CardTitle>
            {/* S39 — upload guidance: those uploads are compact icon buttons with no room for a
                hint, so it lives under the panel title. */}
            <CardDescription>{assetGuidance}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder={t("admin.settings.hierarchy.addFamily")}
              />
              <Button
                size="sm"
                onClick={() => {
                  onCreateFamily(newFamilyName);
                  setNewFamilyName("");
                }}
                disabled={!newFamilyName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {families.map((family) => (
                <div
                  key={family.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetTile className="h-8 w-8 shrink-0 rounded">
                      {family.iconUrl ? (
                        <img src={family.iconUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </AssetTile>
                    <span className="truncate">{family.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnabledBadge isEnabled={family.isEnabled} />
                    <ImageUploadField
                      compact
                      purpose={ImagePurpose.FAMILY_ICON}
                      label={t("admin.settings.hierarchy.icon")}
                      onUploaded={(url) => onSetFamilyIcon?.(family.id, url)}
                    />
                    {family.isEnabled ? (
                      <Button variant="ghost" size="sm" onClick={() => onDisableFamily(family.id)}>
                        {t("common.actions.disable")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEnableFamily?.(family.id)}
                      >
                        {t("common.actions.enable")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.settings.hierarchy.tabs.brands")}</CardTitle>
            <CardDescription>{assetGuidance}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder={t("admin.settings.hierarchy.addBrand")}
              />
              <Button
                size="sm"
                onClick={() => {
                  onCreateBrand(newBrandName);
                  setNewBrandName("");
                }}
                disabled={!newBrandName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {brands.map((brand) => (
                <div
                  key={brand.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetTile className="h-8 w-8 shrink-0 rounded">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </AssetTile>
                    <span className="truncate">{brand.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnabledBadge isEnabled={brand.isEnabled} />
                    <ImageUploadField
                      compact
                      purpose={ImagePurpose.BRAND_LOGO}
                      label={t("admin.settings.hierarchy.logo")}
                      onUploaded={(url) => onSetBrandLogo?.(brand.id, url)}
                    />
                    {brand.isEnabled ? (
                      <Button variant="ghost" size="sm" onClick={() => onDisableBrand(brand.id)}>
                        {t("common.actions.disable")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onEnableBrand?.(brand.id)}>
                        {t("common.actions.enable")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.settings.hierarchy.tabs.models")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-lg border p-2">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder={t("admin.settings.hierarchy.addModel")}
              />
              <Select value={newModelBrandId} onValueChange={setNewModelBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.settings.hierarchy.brand")} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t("admin.settings.hierarchy.families")}
                </span>
                {families.map((family) => (
                  <label key={family.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newModelFamilyIds.includes(family.id)}
                      onCheckedChange={(checked) =>
                        setNewModelFamilyIds((current) =>
                          checked
                            ? [...current, family.id]
                            : current.filter((id) => id !== family.id),
                        )
                      }
                    />
                    {family.name}
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  onCreateModel(newModelName, newModelBrandId, newModelFamilyIds);
                  setNewModelName("");
                  setNewModelFamilyIds([]);
                }}
                disabled={!newModelName.trim() || !newModelBrandId}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("admin.settings.hierarchy.addModel")}
              </Button>
            </div>
            <div className="space-y-1">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>{model.name}</span>
                  <div className="flex items-center gap-2">
                    <EnabledBadge isEnabled={model.isEnabled} />
                    {model.isEnabled ? (
                      <Button variant="ghost" size="sm" onClick={() => onDisableModel(model.id)}>
                        {t("common.actions.disable")}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onEnableModel?.(model.id)}>
                        {t("common.actions.enable")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
