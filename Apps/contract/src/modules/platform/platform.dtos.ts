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
    featuredFamilyIds: z.array(z.uuid()),
  }),
});
export type SettingsDto = z.infer<typeof SettingsResponseSchema>;

// SETTINGS_PUBLIC route note: "featured products and families only" — plus, since S25, the store
// header. The POS receipt is printed by a STAFF cashier and must carry the shop's name, address,
// phone and logo, but GET /platform/settings is adminOnly; these four fields are already printed
// on every invoice PDF handed to a customer, so exposing them publicly discloses nothing new.
// `invoicing` (prefixes, next sequence numbers) and `delivery` stay internal — they are not here.
export const PublicSettingsResponseSchema = z.object({
  store: z.object({
    name: z.string(),
    address: z.string().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().optional(),
  }),
  storefront: z.object({
    featuredProductIds: z.array(z.uuid()),
    featuredFamilyIds: z.array(z.uuid()),
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
