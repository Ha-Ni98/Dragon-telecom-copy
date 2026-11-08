import { z } from 'zod';
import { ProductWithPricingResponseSchema } from '../catalog/catalog.dtos';
import { ClientStatus, PhoneAvailability, PurchaseDocumentKind } from './clients.enums';

export const ValidatePhoneResultResponseSchema = z.object({
  isValid: z.boolean(),
  status: z.enum(PhoneAvailability),
});
export type ValidatePhoneResultDto = z.infer<typeof ValidatePhoneResultResponseSchema>;

// NO category, NO raw status (spec) — the client's own view stays a level above the
// admin-facing pipeline state.
export const ClientMeResponseSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.email().optional(),
  storeName: z.string().optional(),
  wilayaId: z.uuid(),
  communeId: z.uuid(),
  address: z.string().optional(),
  createdAt: z.iso.datetime(),
  credit: z.number(),
  totalPaid: z.number(),
  totalSold: z.number(),
});
export type ClientMeDto = z.infer<typeof ClientMeResponseSchema>;

export const AdminClientResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  fullName: z.string(),
  storeName: z.string().optional(),
  username: z.string().optional(),
  phone: z.string(),
  email: z.email().optional(),
  wilayaFr: z.string(),
  communeFr: z.string(),
  categoryName: z.string().optional(),
  status: z.enum(ClientStatus),
  isEnabled: z.boolean(),
  totalOrders: z.number().int().min(0),
  totalSpent: z.number(),
  lastOrderDate: z.iso.datetime().optional(),
  posClientId: z.uuid().optional(),
  createdAt: z.iso.datetime(),
});
export type AdminClientDto = z.infer<typeof AdminClientResponseSchema>;

// The client-detail Overview tab, and the source of the "previous credit" preview on the
// clients-list record-payment action. Money is proxied from the linked PosClient (0 when the
// client has never been approved, so no PosClient exists yet — same convention as
// ClientMeResponseSchema). totalProductQuantity is Σ InvoiceLine.quantity over the client's
// non-cancelled invoices (S8 R1) — source-agnostic across SALE/ORDER/REPAIR, and stable across
// S9's order-lines rework.
export const AdminClientOverviewResponseSchema = z.object({
  clientId: z.uuid(),
  posClientId: z.uuid().optional(),
  totalSold: z.number(),
  totalPaid: z.number(),
  credit: z.number(),
  orderCount: z.number().int().min(0),
  totalProductQuantity: z.number().int().min(0),
});
export type AdminClientOverviewDto = z.infer<typeof AdminClientOverviewResponseSchema>;

export const PosClientResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  categoryId: z.uuid().optional(),
  categoryName: z.string().optional(),
  credit: z.number(),
  totalPaid: z.number(),
  totalSold: z.number(),
  linkedClientId: z.uuid().optional(),
  isEnabled: z.boolean(),
});
export type PosClientDto = z.infer<typeof PosClientResponseSchema>;

// product nests catalog's real ProductWithPricingResponseSchema (a value import, not
// import type) so CartItemDto stays a single z.infer per rules §3.1 — a plan §3.3
// deviation from "import type", but rules win on HOW (§0) and the dependency is still
// one-directional (catalog never imports from clients), so no cycle risk.
export const CartItemResponseSchema = z.object({
  productId: z.uuid(),
  addedAt: z.iso.datetime(),
  product: ProductWithPricingResponseSchema,
});
export type CartItemDto = z.infer<typeof CartItemResponseSchema>;

// ADMIN_STATS has no field list in the spec beyond the route note ("+ stats route") — modelled
// minimally on the client pipeline's own status breakdown (plan-client-purch.md §I.2, §D-1).
export const ClientStatsResponseSchema = z.object({
  totalClients: z.number().int().min(0),
  pending: z.number().int().min(0),
  approved: z.number().int().min(0),
  rejected: z.number().int().min(0),
  newThisMonth: z.number().int().min(0),
});
export type ClientStatsDto = z.infer<typeof ClientStatsResponseSchema>;

// S36 — one product a client bought, aggregated over their completed POS sales and completed
// online orders (never repair parts). Amounts are the stored line totals (before any sale-level
// discount, owner Q3). Returns are shown separately, never netted: `amountRefunded` is the cash
// handed back (Σ ReturnLine.refundAmount, owner Q2) — a return credited to the client's account
// adds to `quantityReturned` and 0 here. No cost or profit, for admin and staff alike.
export const PurchasedProductResponseSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  quantityBought: z.number().int(),
  totalAmount: z.number(),
  quantityReturned: z.number().int(),
  amountRefunded: z.number(),
  lastBoughtAt: z.iso.datetime(),
});
export type PurchasedProductDto = z.infer<typeof PurchasedProductResponseSchema>;

// S36 — one document behind a purchased product. SALE/ORDER rows: the line's own quantity,
// unitPrice and lineTotal (`amount`). RETURN rows: returned quantity and refunded cash (`amount`),
// with the sale/order they came from in `sourceKind`/`sourceReference` (the row links to it).
export const PurchasedProductDocumentResponseSchema = z.object({
  kind: z.enum(PurchaseDocumentKind),
  documentId: z.uuid(),
  reference: z.string(),
  at: z.iso.datetime(),
  quantity: z.number().int(),
  unitPrice: z.number().optional(),
  amount: z.number(),
  sourceKind: z.enum([PurchaseDocumentKind.SALE, PurchaseDocumentKind.ORDER]).optional(),
  sourceReference: z.string().optional(),
});
export type PurchasedProductDocumentDto = z.infer<typeof PurchasedProductDocumentResponseSchema>;
