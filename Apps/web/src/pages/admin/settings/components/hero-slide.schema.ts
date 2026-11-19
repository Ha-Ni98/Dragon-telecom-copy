import { z } from "zod";
import {
  ContentLocale,
  HERO_SLIDE_CTA_MAX,
  HERO_SLIDE_TITLE_MAX,
  isHeroSlideLink,
  type CreateHeroSlideCommand,
  type HeroSlideDto,
  type UpdateHeroSlideCommand,
} from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// S38 — the hero slide dialog's form. The two images live in the form as the KEY (what the
// command carries — the API validates it and derives the URL itself) plus the URL (preview only,
// never submitted). Dates are store-local days ("" = no bound), matching the DTO's startsOn /
// endsOn. The text fields are flat here (titleFr…) and folded into the contract's per-locale
// `text` object by the converters below.
export function heroSlideSchema(t: ReturnType<typeof useTranslation>["t"]) {
  const copy = (max: number) =>
    z
      .string()
      .trim()
      .min(1, t("common.validation.required"))
      .max(max, t("common.validation.maxLength", { max }));
  const day = z.union([z.literal(""), z.iso.date()]);
  return z
    .object({
      desktopImageKey: z
        .string()
        .min(1, t("admin.settings.storefront.hero.validation.imageRequired")),
      desktopImageUrl: z.string(),
      mobileImageKey: z
        .string()
        .min(1, t("admin.settings.storefront.hero.validation.imageRequired")),
      mobileImageUrl: z.string(),
      titleFr: copy(HERO_SLIDE_TITLE_MAX),
      titleEn: copy(HERO_SLIDE_TITLE_MAX),
      ctaFr: copy(HERO_SLIDE_CTA_MAX),
      ctaEn: copy(HERO_SLIDE_CTA_MAX),
      link: z
        .string()
        .trim()
        .refine(isHeroSlideLink, t("admin.settings.storefront.hero.validation.linkInvalid")),
      isActive: z.boolean(),
      startsOn: day,
      endsOn: day,
    })
    .refine((v) => v.startsOn === "" || v.endsOn === "" || v.endsOn >= v.startsOn, {
      path: ["endsOn"],
      message: t("admin.settings.storefront.hero.validation.endBeforeStart"),
    });
}

export type HeroSlideFormValues = z.infer<ReturnType<typeof heroSlideSchema>>;

export const EMPTY_HERO_SLIDE_FORM: HeroSlideFormValues = {
  desktopImageKey: "",
  desktopImageUrl: "",
  mobileImageKey: "",
  mobileImageUrl: "",
  titleFr: "",
  titleEn: "",
  ctaFr: "",
  ctaEn: "",
  link: "",
  isActive: true,
  startsOn: "",
  endsOn: "",
};

export function heroSlideToFormValues(slide: HeroSlideDto): HeroSlideFormValues {
  return {
    desktopImageKey: slide.desktopImageKey,
    desktopImageUrl: slide.desktopImageUrl,
    mobileImageKey: slide.mobileImageKey,
    mobileImageUrl: slide.mobileImageUrl,
    titleFr: slide.text[ContentLocale.FR].title,
    titleEn: slide.text[ContentLocale.EN].title,
    ctaFr: slide.text[ContentLocale.FR].ctaLabel,
    ctaEn: slide.text[ContentLocale.EN].ctaLabel,
    link: slide.link,
    isActive: slide.isActive,
    startsOn: slide.startsOn ?? "",
    endsOn: slide.endsOn ?? "",
  };
}

const toText = (v: HeroSlideFormValues): CreateHeroSlideCommand["text"] => ({
  [ContentLocale.FR]: { title: v.titleFr, ctaLabel: v.ctaFr },
  [ContentLocale.EN]: { title: v.titleEn, ctaLabel: v.ctaEn },
});

export function toCreateHeroSlideCommand(v: HeroSlideFormValues): CreateHeroSlideCommand {
  return {
    desktopImageKey: v.desktopImageKey,
    mobileImageKey: v.mobileImageKey,
    text: toText(v),
    link: v.link,
    isActive: v.isActive,
    ...(v.startsOn !== "" ? { startsOn: v.startsOn } : {}),
    ...(v.endsOn !== "" ? { endsOn: v.endsOn } : {}),
  };
}

// Only the fields that changed. A date emptied from a previously set value is sent as `null`
// (= remove that bound); one that was never set and is still empty is simply omitted.
export function toUpdateHeroSlideCommand(
  v: HeroSlideFormValues,
  initial: HeroSlideFormValues,
): UpdateHeroSlideCommand {
  const textChanged =
    v.titleFr !== initial.titleFr ||
    v.titleEn !== initial.titleEn ||
    v.ctaFr !== initial.ctaFr ||
    v.ctaEn !== initial.ctaEn;
  const bound = (next: string, prev: string): string | null | undefined =>
    next === prev ? undefined : next === "" ? null : next;
  const startsOn = bound(v.startsOn, initial.startsOn);
  const endsOn = bound(v.endsOn, initial.endsOn);
  return {
    ...(v.desktopImageKey !== initial.desktopImageKey
      ? { desktopImageKey: v.desktopImageKey }
      : {}),
    ...(v.mobileImageKey !== initial.mobileImageKey ? { mobileImageKey: v.mobileImageKey } : {}),
    ...(textChanged ? { text: toText(v) } : {}),
    ...(v.link !== initial.link ? { link: v.link } : {}),
    ...(v.isActive !== initial.isActive ? { isActive: v.isActive } : {}),
    ...(startsOn !== undefined ? { startsOn } : {}),
    ...(endsOn !== undefined ? { endsOn } : {}),
  };
}
