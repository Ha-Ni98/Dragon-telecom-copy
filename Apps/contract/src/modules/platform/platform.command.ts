import { z } from 'zod';
import { isDzPhone } from '../../common/phone';
import { DocType } from './platform.enums';
import { HeroSlideTextSchema } from './platform.dtos';
import {
  HERO_SLIDES_MAX,
  META_DESCRIPTION_MAX,
  isHeroSlideLink,
} from './platform.constants';

export const UpsertFeesSchema = z.object({
  rows: z.array(
    z.object({
      wilayaId: z.uuid(),
      communeId: z.uuid().nullable().optional(),
      deliveryHome: z.number().min(0),
      deliveryOffice: z.number().min(0),
    }),
  ),
});
export type UpsertFeesCommand = z.infer<typeof UpsertFeesSchema>;

const StoreSettingsInputSchema = z.object({
  name: z.string().optional(),
  activityLine: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  repairPhone: z.string().optional(),
  salesPhone: z.string().optional(),
  // S38 — footer contact. `null` clears the field (the only way to unset an optional leaf);
  // validated, unlike the older free-text phones, so wa.me / mailto: / social links always work.
  whatsappPhone: z.string().refine(isDzPhone).nullable().optional(),
  email: z.email().nullable().optional(),
  facebookUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
  instagramUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
  tiktokUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
  logoUrl: z.string().optional(),
  printLogoUrl: z.string().optional(),
});

const InvoicingSettingsInputSchema = z.object({
  prefixes: z.record(z.enum(DocType), z.string()).optional(),
  // Lowering a next-sequence is a backend 409 (SEQUENCE_DECREASE_FORBIDDEN), not
  // contract-enforceable without reading current state.
  nextSequences: z.record(z.enum(DocType), z.number().int().min(0)).optional(),
  footerNote: z.string().optional(),
});

const DeliverySettingsInputSchema = z.object({
  defaultHome: z.number().min(0).optional(),
  defaultOffice: z.number().min(0).optional(),
});

const StorefrontSettingsInputSchema = z.object({
  featuredProductIds: z.array(z.uuid()).optional(),
  // Ordered; empty = the home Categories section is hidden. The old max-6 cap was removed at the
  // owner's request (the desktop row simply wraps past 6).
  featuredFamilyIds: z.array(z.uuid()).optional(),
  // Ordered; empty = the home Brands section is hidden.
  featuredBrandIds: z.array(z.uuid()).optional(),
  // Ordered; the desktop header bar's family links after "Home" / "All products". Empty = only
  // those two links.
  navFamilyIds: z.array(z.uuid()).optional(),
  // S38 — `null` clears (see UpdateSettingsSchema).
  repairToolsFamilyId: z.uuid().nullable().optional(),
  metaDescription: z.string().trim().max(META_DESCRIPTION_MAX).nullable().optional(),
  linkPreviewImageUrl: z.string().nullable().optional(),
});

// Partial of SettingsDto — every section, and every field within a section, is
// independently optional (a PATCH may touch just one leaf field). S38: a leaf sent as `null` is
// removed from the stored section (the only way to clear an optional field); `undefined` / absent
// leaves it untouched.
export const UpdateSettingsSchema = z.object({
  store: StoreSettingsInputSchema.optional(),
  invoicing: InvoicingSettingsInputSchema.optional(),
  delivery: DeliverySettingsInputSchema.optional(),
  storefront: StorefrontSettingsInputSchema.optional(),
});
export type UpdateSettingsCommand = z.infer<typeof UpdateSettingsSchema>;

// S38 — images travel as the KEYS returned by POST /admin/media/images (purpose
// HERO_DESKTOP / HERO_MOBILE). The API validates each key's folder + format and its existence
// in R2, then derives the URL itself — a client-sent URL is never stored.
const HeroSlideScheduleShape = {
  startsOn: z.iso.date().nullable().optional(),
  endsOn: z.iso.date().nullable().optional(),
};
const endsNotBeforeStarts = (v: { startsOn?: string | null | undefined; endsOn?: string | null | undefined }) =>
  v.startsOn == null || v.endsOn == null || v.endsOn >= v.startsOn;

export const CreateHeroSlideSchema = z
  .object({
    desktopImageKey: z.string().min(1),
    mobileImageKey: z.string().min(1),
    text: HeroSlideTextSchema,
    link: z.string().trim().refine(isHeroSlideLink),
    isActive: z.boolean().optional(),
    ...HeroSlideScheduleShape,
  })
  .refine(endsNotBeforeStarts, { path: ['endsOn'] });
export type CreateHeroSlideCommand = z.infer<typeof CreateHeroSlideSchema>;

// Every field optional; schedule fields accept null (= remove that bound). The service
// re-checks endsOn >= startsOn against the stored value when only one bound is sent.
export const UpdateHeroSlideSchema = z
  .object({
    desktopImageKey: z.string().min(1).optional(),
    mobileImageKey: z.string().min(1).optional(),
    text: HeroSlideTextSchema.optional(),
    link: z.string().trim().refine(isHeroSlideLink).optional(),
    isActive: z.boolean().optional(),
    ...HeroSlideScheduleShape,
  })
  .refine(endsNotBeforeStarts, { path: ['endsOn'] });
export type UpdateHeroSlideCommand = z.infer<typeof UpdateHeroSlideSchema>;

export const ReorderHeroSlidesSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(HERO_SLIDES_MAX),
});
export type ReorderHeroSlidesCommand = z.infer<typeof ReorderHeroSlidesSchema>;
