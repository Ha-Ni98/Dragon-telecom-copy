import { z } from 'zod';
import { SupplierInvoiceStatus } from './purchasing.enums';

export const SupplierResponseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.email().optional(),
  location: z.string().optional(),
  credit: z.number(),
  totalPaid: z.number(),
  totalInvoiced: z.number(),
  invoiceCount: z.number().int().min(0),
  lastDeliveryAt: z.iso.datetime().optional(),
  isEnabled: z.boolean(),
});
export type SupplierDto = z.infer<typeof SupplierResponseSchema>;

export const SupplierInvoiceResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  supplierReference: z.string().optional(),
  supplierId: z.uuid(),
  supplierName: z.string(),
  status: z.enum(SupplierInvoiceStatus),
  invoiceDate: z.iso.date(),
  dueDate: z.iso.date().optional(),
  shippingCost: z.number(),
  amountOnly: z.number().optional(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  previousCredit: z.number().optional(),
  newCredit: z.number().optional(),
  note: z.string().optional(),
  staffName: z.string(),
  lines: z.array(
    z.object({
      id: z.uuid(),
      productId: z.uuid(),
      productNameSnapshot: z.string(),
      quantity: z.number().int(),
      unitCost: z.number(),
      landedUnitCost: z.number(),
      lineTotal: z.number(),
      serialNumbers: z.string().optional(),
      // Projection on DRAFT reads only (spec) — absent once CONFIRMED.
      projectedNewAverageCost: z.number().optional(),
    }),
  ),
});
export type SupplierInvoiceDto = z.infer<typeof SupplierInvoiceResponseSchema>;

// current mirrors catalog's category-price shape (categoryId/categoryName/price) for the
// reprice-prompt UI — inlined rather than imported, since the plan documents no
// purchasing -> catalog dependency edge.
export const ConfirmResultResponseSchema = z.object({
  reference: z.string(),
  repriceCandidates: z.array(
    z.object({
      productId: z.uuid(),
      name: z.string(),
      averageCost: z.number(),
      current: z.object({
        guestPrice: z.number().optional(),
        defaultSalePrice: z.number().optional(),
        categoryPrices: z.array(
          z.object({ categoryId: z.uuid(), categoryName: z.string(), price: z.number() }),
        ),
      }),
    }),
  ),
});
export type ConfirmResultDto = z.infer<typeof ConfirmResultResponseSchema>;

export const SupplierPaymentResponseSchema = z.object({
  reference: z.string(),
  supplierName: z.string(),
  supplierInvoiceReference: z.string().optional(),
  amount: z.number(),
  previousCredit: z.number(),
  newCredit: z.number(),
  paidAt: z.iso.datetime(),
  staffName: z.string(),
});
export type SupplierPaymentDto = z.infer<typeof SupplierPaymentResponseSchema>;

// SUPPLIER_DETAIL route note: "aggregate: invoices, payments, product history" — no
// field list given; modelled minimally from the three named sections.
export const SupplierDetailResponseSchema = z.object({
  supplier: SupplierResponseSchema,
  invoices: z.array(SupplierInvoiceResponseSchema),
  payments: z.array(SupplierPaymentResponseSchema),
  productHistory: z.array(
    z.object({
      productId: z.uuid(),
      productName: z.string(),
      totalQuantity: z.number().int(),
      lastPurchaseAt: z.iso.datetime(),
    }),
  ),
});
export type SupplierDetailDto = z.infer<typeof SupplierDetailResponseSchema>;

// SUPPLIER_STATS route has no field list in the spec at all; modelled on the same
// shape as catalog's ProductStatsDto (total + credit/invoiced roll-ups).
export const SupplierStatsResponseSchema = z.object({
  totalSuppliers: z.number().int().min(0),
  totalCredit: z.number(),
  totalInvoiced: z.number(),
});
export type SupplierStatsDto = z.infer<typeof SupplierStatsResponseSchema>;
