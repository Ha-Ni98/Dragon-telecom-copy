import { z } from 'zod';
import { DocType } from './platform.enums';

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
  address: z.string().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().optional(),
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
  // Max 6 — the home page's family strip is a 6-tile grid (S17 builds the picker that enforces
  // it in the UI; this is the server-side bound).
  featuredFamilyIds: z.array(z.uuid()).max(6).optional(),
});

// Partial of SettingsDto — every section, and every field within a section, is
// independently optional (a PATCH may touch just one leaf field).
export const UpdateSettingsSchema = z.object({
  store: StoreSettingsInputSchema.optional(),
  invoicing: InvoicingSettingsInputSchema.optional(),
  delivery: DeliverySettingsInputSchema.optional(),
  storefront: StorefrontSettingsInputSchema.optional(),
});
export type UpdateSettingsCommand = z.infer<typeof UpdateSettingsSchema>;
