import { z } from 'zod';
import { ContentLocale } from '../../common/locale';
import { DocType, FeeSource } from './platform.enums';
import { HERO_SLIDE_CTA_MAX, HERO_SLIDE_TITLE_MAX } from './platform.constants';

export const WilayaResponseSchema = z.object({
  id: z.uuid(),
  wilayaCode: z.string(),
  frName: z.string(),
  arName: z.string(),
  communes: z.array(
    z.object({
      id: z.uuid(),
      communeCode: z.string(),
      frName: z.string(),
      arName: z.string(),
    }),
  ),
});
export type WilayaDto = z.infer<typeof WilayaResponseSchema>;

export const FeeResponseSchema = z.object({
  deliveryHome: z.number(),
  deliveryOffice: z.number(),
  source: z.enum(FeeSource),
});
export type FeeDto = z.infer<typeof FeeResponseSchema>;

export const SettingsResponseSchema = z.object({
  store: z.object({
    name: z.string(),
    // S26.1 — the store's description line, printed under the name on the thermal receipt
    // (e.g. "VENTE PIECES DE RECHANGE ET ACCESOIRRES MOBILES").
    activityLine: z.string().optional(),
    address: z.string().optional(),
    // S26.1 / owner decision Q2 — `phone` keeps its existing role and its existing consumers
    // (invoice PDF header, POS receipt, repair claim slip). `repairPhone` and `salesPhone` are
    // the two separately labelled numbers S27's receipt prints; each falls back to `phone`
    // when unset, so no printed document loses a number.
    phone: z.string().optional(),
    repairPhone: z.string().optional(),
    salesPhone: z.string().optional(),
    // S38 — storefront footer contact (Q2). Validated on write (platform.command.ts); optional
    // here because rows written before S38 have none, and a cleared field is a removed key.
    whatsappPhone: z.string().optional(),
    email: z.string().optional(),
    facebookUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    tiktokUrl: z.string().optional(),
    // Full-colour logo — screen and PDF.
    logoUrl: z.string().optional(),
    // S26.1 — a dedicated monochrome PNG for the thermal printer, uploaded already
    // black-and-white and stored without lossy encoding (a WebP/JPEG of a 1-bit image produces
    // edge artifacts the thermal head renders as grey fringing). Never used on screen.
    printLogoUrl: z.string().optional(),
  }),
  invoicing: z.object({
    prefixes: z.record(z.enum(DocType), z.string()),
    nextSequences: z.record(z.enum(DocType), z.number().int().min(0)),
    footerNote: z.string().optional(),
  }),
  delivery: z.object({
    defaultHome: z.number(),
    defaultOffice: z.number(),
  }),
  storefront: z.object({
    featuredProductIds: z.array(z.uuid()),
    featuredFamilyIds: z.array(z.uuid()),
    // Ordered; empty = the home Brands section is hidden.
    featuredBrandIds: z.array(z.uuid()),
    // Ordered; the desktop header bar's family links. Empty = only "Home" / "All products".
    navFamilyIds: z.array(z.uuid()),
    // S38 — the family feeding the home page's "Repair tools" row (S39). A stored id, not a
    // product flag; absent = the row hides.
    repairToolsFamilyId: z.uuid().optional(),
    metaDescription: z.string().optional(),
    linkPreviewImageUrl: z.string().optional(),
  }),
});
export type SettingsDto = z.infer<typeof SettingsResponseSchema>;

// S38 — the public subset now also carries the storefront footer's contact fields (the footer
// reads them; it used to be front-end static) and the storefront section's new fields.
// SETTINGS_PUBLIC route note: "featured products and families only" — plus, since S25, the store
// header. The POS receipt is printed by a STAFF cashier and must carry the shop's name, address,
// phone and logo, but GET /platform/settings is adminOnly; these four fields are already printed
// on every invoice PDF handed to a customer, so exposing them publicly discloses nothing new.
// `invoicing` (prefixes, next sequence numbers) and `delivery` stay internal — they are not here.
// S26.1 — the new header fields (activityLine, repairPhone, salesPhone, printLogoUrl) are public
// for the same reason: the STAFF-scoped POS receipt (S27) reads this route to print them, and
// every one of them is already destined for a document handed to a customer.
export const PublicSettingsResponseSchema = z.object({
  store: z.object({
    name: z.string(),
    activityLine: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    repairPhone: z.string().optional(),
    salesPhone: z.string().optional(),
    whatsappPhone: z.string().optional(),
    email: z.string().optional(),
    facebookUrl: z.string().optional(),
    instagramUrl: z.string().optional(),
    tiktokUrl: z.string().optional(),
    logoUrl: z.string().optional(),
    printLogoUrl: z.string().optional(),
  }),
  storefront: z.object({
    featuredProductIds: z.array(z.uuid()),
    featuredFamilyIds: z.array(z.uuid()),
    // Ordered; empty = the home Brands section is hidden.
    featuredBrandIds: z.array(z.uuid()),
    // Ordered; the desktop header bar's family links. Empty = only "Home" / "All products".
    navFamilyIds: z.array(z.uuid()),
    // S38 — the family feeding the home page's "Repair tools" row (S39). A stored id, not a
    // product flag; absent = the row hides.
    repairToolsFamilyId: z.uuid().optional(),
    metaDescription: z.string().optional(),
    linkPreviewImageUrl: z.string().optional(),
  }),
});
export type PublicSettingsDto = z.infer<typeof PublicSettingsResponseSchema>;

// ADMIN_FEES route note: "wilaya rows + commune overrides" — the editable grid.
// Named for the admin fee-editor UI, distinct from WilayaDto (public catalog listing):
// every wilaya row carries its own resolved fee (falls back to the settings default when
// no DeliveryFee row exists yet) plus only the communes that have an explicit override.
export const AdminFeesResponseSchema = z.object({
  wilayas: z.array(
    z.object({
      wilayaId: z.uuid(),
      wilayaCode: z.string(),
      frName: z.string(),
      arName: z.string(),
      deliveryHome: z.number(),
      deliveryOffice: z.number(),
      communes: z.array(
        z.object({
          communeId: z.uuid(),
          communeCode: z.string(),
          frName: z.string(),
          arName: z.string(),
          deliveryHome: z.number(),
          deliveryOffice: z.number(),
        }),
      ),
    }),
  ),
});
export type AdminFeesDto = z.infer<typeof AdminFeesResponseSchema>;

// S38 — one locale's slide copy. Shared by the DTOs and the commands.
export const HeroSlideLocaleTextSchema = z.object({
  title: z.string().trim().min(1).max(HERO_SLIDE_TITLE_MAX),
  ctaLabel: z.string().trim().min(1).max(HERO_SLIDE_CTA_MAX),
});
export const HeroSlideTextSchema = z.object({
  [ContentLocale.FR]: HeroSlideLocaleTextSchema,
  [ContentLocale.EN]: HeroSlideLocaleTextSchema,
});
export type HeroSlideText = z.infer<typeof HeroSlideTextSchema>;

// Admin view — everything the edit dialog needs. startsOn/endsOn are store-local days
// (endsOn inclusive), converted back from the stored UTC bounds by the mapper.
export const HeroSlideResponseSchema = z.object({
  id: z.uuid(),
  desktopImageUrl: z.string(),
  desktopImageKey: z.string(),
  mobileImageUrl: z.string(),
  mobileImageKey: z.string(),
  text: HeroSlideTextSchema,
  link: z.string(),
  isActive: z.boolean(),
  startsOn: z.iso.date().optional(),
  endsOn: z.iso.date().optional(),
  displayOrder: z.number().int().min(0),
  /** Server-computed: active AND inside its window right now. Drives the panel's badge. */
  isLive: z.boolean(),
});
export type HeroSlideDto = z.infer<typeof HeroSlideResponseSchema>;

// Public view — only what the storefront renders. No keys, no schedule.
export const PublicHeroSlideResponseSchema = z.object({
  id: z.uuid(),
  desktopImageUrl: z.string(),
  mobileImageUrl: z.string(),
  text: HeroSlideTextSchema,
  link: z.string(),
});
export type PublicHeroSlideDto = z.infer<typeof PublicHeroSlideResponseSchema>;
