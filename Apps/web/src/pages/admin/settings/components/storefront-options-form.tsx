import { useState } from "react";
import { Save } from "lucide-react";
import {
  ImagePurpose,
  LINK_PREVIEW_IMAGE_GUIDANCE,
  META_DESCRIPTION_MAX,
  type FamilyDto,
  type SettingsDto,
} from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { useTranslation } from "@/hooks/useTranslation";

// Local "no family" sentinel for the Select (Radix Select cannot hold an empty-string value) —
// the same pattern as ProductFilters' ALL.
const NO_FAMILY = "__none__";
const OPTIONS = "admin.settings.storefront.options";

interface StorefrontOptionsFormProps {
  storefront: SettingsDto["storefront"];
  /** Enabled families only — a disabled one cannot feed a storefront row. */
  families: FamilyDto[];
  onSave: (patch: { repairToolsFamilyId: string | null; metaDescription: string | null }) => void;
  /** Commits immediately on upload (the S26.1 logo rule: two writers for one field would race). */
  onSaveLinkPreviewImage: (url: string) => void;
  isSaving?: boolean;
}

// S38 — Settings → Storefront → "Home page & sharing": the family behind the home page's
// "Repair tools" row (S39 reads it), the site's meta description and its link-preview image.
// The text/select pair saves with one button; the image commits on upload and is therefore NOT
// part of this form's draft.
export function StorefrontOptionsForm({
  storefront,
  families,
  onSave,
  onSaveLinkPreviewImage,
  isSaving = false,
}: StorefrontOptionsFormProps) {
  const { t } = useTranslation();

  const savedFamilyId = storefront.repairToolsFamilyId;
  const familyStillValid =
    savedFamilyId !== undefined && families.some((f) => f.id === savedFamilyId);
  const savedValue = familyStillValid ? savedFamilyId : NO_FAMILY;
  const savedDescription = storefront.metaDescription ?? "";

  // Draft state, re-seeded whenever the saved value changes (a save, or a refetch).
  const [familyId, setFamilyId] = useState<string>(savedValue);
  const [description, setDescription] = useState<string>(savedDescription);
  const [seen, setSeen] = useState({ savedValue, savedDescription });
  if (seen.savedValue !== savedValue || seen.savedDescription !== savedDescription) {
    setSeen({ savedValue, savedDescription });
    setFamilyId(savedValue);
    setDescription(savedDescription);
  }

  const dirty = familyId !== savedValue || description.trim() !== savedDescription.trim();
  // A stored id that no longer matches an enabled family is shown as "None" with a hint.
  const familyMissing = savedFamilyId !== undefined && !familyStillValid;

  return (
    <Card>
      <CardHeader>
        <SectionTitle as="h2" className="text-lg font-semibold">
          {t(`${OPTIONS}.title`)}
        </SectionTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="repair-tools-family">{t(`${OPTIONS}.repairToolsFamily`)}</Label>
          <Select value={familyId} onValueChange={setFamilyId} disabled={isSaving}>
            <SelectTrigger id="repair-tools-family" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FAMILY}>{t(`${OPTIONS}.none`)}</SelectItem>
              {families.map((family) => (
                <SelectItem key={family.id} value={family.id}>
                  {family.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t(`${OPTIONS}.repairToolsFamilyHelp`)}</p>
          {familyMissing && (
            <p className="text-sm text-warning-foreground">
              {t(`${OPTIONS}.repairToolsFamilyMissing`)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-description">{t(`${OPTIONS}.metaDescription`)}</Label>
          <Textarea
            id="meta-description"
            value={description}
            maxLength={META_DESCRIPTION_MAX}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving}
          />
          <p className="text-sm text-muted-foreground">
            {t(`${OPTIONS}.metaDescriptionHelp`, {
              count: description.length,
              max: META_DESCRIPTION_MAX,
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() =>
              onSave({
                repairToolsFamilyId: familyId === NO_FAMILY ? null : familyId,
                metaDescription: description.trim() === "" ? null : description.trim(),
              })
            }
            disabled={isSaving || !dirty}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
          {dirty && (
            <span className="text-sm text-muted-foreground">
              {t("admin.settings.storefront.unsavedChanges")}
            </span>
          )}
        </div>

        <div className="space-y-2 border-t pt-6">
          <ImageUploadField
            value={storefront.linkPreviewImageUrl}
            purpose={ImagePurpose.LINK_PREVIEW}
            label={t(`${OPTIONS}.linkPreviewImage`)}
            hint={t(`${OPTIONS}.linkPreviewImageHelp`, {
              width: LINK_PREVIEW_IMAGE_GUIDANCE.width,
              height: LINK_PREVIEW_IMAGE_GUIDANCE.height,
            })}
            onUploaded={(url) => onSaveLinkPreviewImage(url)}
            disabled={isSaving}
            previewClassName="h-20 w-40"
          />
          <p className="text-xs text-muted-foreground">{t(`${OPTIONS}.linkPreviewShareNote`)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
