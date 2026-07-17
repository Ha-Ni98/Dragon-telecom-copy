import { z } from 'zod';
import { DocType, FeeSource } from './platform.enums';

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
    address: z.string().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().optional(),
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
  }),
});
export type SettingsDto = z.infer<typeof SettingsResponseSchema>;

// SETTINGS_PUBLIC route note: "featured products only" — trimmed to the one
// public-safe section rather than the full SettingsDto (store/invoicing/delivery
// are internal-only).
export const PublicSettingsResponseSchema = z.object({
  storefront: z.object({
    featuredProductIds: z.array(z.uuid()),
  }),
});
export type PublicSettingsDto = z.infer<typeof PublicSettingsResponseSchema>;
