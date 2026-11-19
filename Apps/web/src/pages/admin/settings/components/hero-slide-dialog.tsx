import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Save, X } from "lucide-react";
import {
  HERO_IMAGE_GUIDANCE,
  IMAGE_MAX_UPLOAD_BYTES,
  ImagePurpose,
  type HeroSlideDto,
  type MediaImageDto,
} from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FieldError } from "@/components/shared/FieldError";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import { useTranslation } from "@/hooks/useTranslation";
import {
  EMPTY_HERO_SLIDE_FORM,
  heroSlideSchema,
  heroSlideToFormValues,
  type HeroSlideFormValues,
} from "@/pages/admin/settings/components/hero-slide.schema";

interface HeroSlideDialogProps {
  /** Present = edit mode. */
  slide?: HeroSlideDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: HeroSlideFormValues) => void;
  isSaving: boolean;
}

// Accepted aspect-ratio bands (width / height) around the guidance sizes. Outside the band the
// dialog shows a SOFT warning — a mismatched ratio is still cropped by object-cover, so it is
// never an error and never blocks saving.
const RATIO_BAND = { desktop: [2.6, 3.8], mobile: [0.85, 1.18] } as const;

type Dims = { width: number; height: number };

// S38 — create/edit one hero slide. A dumb RHF form: the panel owns the mutations. The two
// banners are uploads through the shared pipeline (ImageUploadField → HERO_DESKTOP / HERO_MOBILE);
// the form keeps the returned KEY (submitted) and URL (preview only). Slide text is per content
// locale (FR + EN) and real text rendered over the image, never baked into it.
export function HeroSlideDialog({
  slide,
  open,
  onOpenChange,
  onSubmit,
  isSaving,
}: HeroSlideDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!slide;
  const [dims, setDims] = useState<{ desktop?: Dims; mobile?: Dims }>({});
  const [uploading, setUploading] = useState({ desktop: false, mobile: false });
  // Returns the SAME object when nothing changed: ImageUploadField reports through an effect keyed
  // on this callback, and an inline callback is a new function every render — a fresh object here
  // would re-render, re-fire the effect and loop.
  const setUploadPending = (kind: "desktop" | "mobile", pending: boolean) =>
    setUploading((prev) => (prev[kind] === pending ? prev : { ...prev, [kind]: pending }));

  const form = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideSchema(t)),
    values: slide ? heroSlideToFormValues(slide) : EMPTY_HERO_SLIDE_FORM,
  });
  // The form lives above the Dialog's content, so closing does not unmount it — start every
  // opening from the slide being edited (or empty), never from the previous one's values. Keyed on
  // the slide's id, not its object: a list refetch must not wipe what the admin is typing.
  useEffect(() => {
    if (!open) return;
    form.reset(slide ? heroSlideToFormValues(slide) : EMPTY_HERO_SLIDE_FORM);
    setDims({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slide?.id]);

  const errors = form.formState.errors;
  const maxMb = IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024);

  const handleUploaded = (kind: "desktop" | "mobile") => (url: string, image: MediaImageDto) => {
    form.setValue(`${kind}ImageKey`, image.key, { shouldDirty: true, shouldValidate: true });
    form.setValue(`${kind}ImageUrl`, url, { shouldDirty: true });
    setDims((prev) => ({ ...prev, [kind]: { width: image.width, height: image.height } }));
  };

  const ratioWarning = (kind: "desktop" | "mobile") => {
    const d = dims[kind];
    if (!d) return null;
    const ratio = d.width / d.height;
    const [min, max] = RATIO_BAND[kind];
    if (ratio >= min && ratio <= max) return null;
    return (
      <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
        <AlertTriangle className="mt-[0.15em] h-[1em] w-[1em] shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          {t("admin.settings.storefront.hero.ratioWarning", {
            width: d.width,
            height: d.height,
            targetWidth: HERO_IMAGE_GUIDANCE[kind].width,
            targetHeight: HERO_IMAGE_GUIDANCE[kind].height,
          })}
        </span>
      </p>
    );
  };

  const busy = isSaving || uploading.desktop || uploading.mobile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("admin.settings.storefront.hero.dialog.editTitle")
              : t("admin.settings.storefront.hero.dialog.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <ImageUploadField
                  value={form.watch("desktopImageUrl") || undefined}
                  purpose={ImagePurpose.HERO_DESKTOP}
                  label={t("admin.settings.storefront.hero.desktopImage")}
                  hint={t("admin.settings.storefront.hero.desktopImageHelp", {
                    width: HERO_IMAGE_GUIDANCE.desktop.width,
                    height: HERO_IMAGE_GUIDANCE.desktop.height,
                    max: maxMb,
                  })}
                  onUploaded={handleUploaded("desktop")}
                  onPendingChange={(pending) => setUploadPending("desktop", pending)}
                  disabled={isSaving}
                  previewClassName="h-20 w-full max-w-[16rem]"
                />
                {ratioWarning("desktop")}
                <FieldError>{errors.desktopImageKey?.message}</FieldError>
              </div>
              <div className="min-w-0 space-y-2">
                <ImageUploadField
                  value={form.watch("mobileImageUrl") || undefined}
                  purpose={ImagePurpose.HERO_MOBILE}
                  label={t("admin.settings.storefront.hero.mobileImage")}
                  hint={t("admin.settings.storefront.hero.mobileImageHelp", {
                    width: HERO_IMAGE_GUIDANCE.mobile.width,
                    height: HERO_IMAGE_GUIDANCE.mobile.height,
                    max: maxMb,
                  })}
                  onUploaded={handleUploaded("mobile")}
                  onPendingChange={(pending) => setUploadPending("mobile", pending)}
                  disabled={isSaving}
                  previewClassName="h-24 w-24"
                />
                {ratioWarning("mobile")}
                <FieldError>{errors.mobileImageKey?.message}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["titleFr", "admin.settings.storefront.hero.titleFr"],
                  ["titleEn", "admin.settings.storefront.hero.titleEn"],
                  ["ctaFr", "admin.settings.storefront.hero.ctaFr"],
                  ["ctaEn", "admin.settings.storefront.hero.ctaEn"],
                ] as const
              ).map(([name, labelKey]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>{t(labelKey)}</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.settings.storefront.hero.link")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="/register" disabled={isSaving} />
                  </FormControl>
                  <FormDescription>{t("admin.settings.storefront.hero.linkHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>{t("admin.settings.storefront.hero.isActive")}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startsOn"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>{t("admin.settings.storefront.hero.startsOn")}</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endsOn"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>{t("admin.settings.storefront.hero.endsOn")}</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" disabled={isSaving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.settings.storefront.hero.scheduleHelp")}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
