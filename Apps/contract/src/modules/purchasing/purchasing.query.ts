import { z } from 'zod';
import { BooleanQuerySchema } from '../../common/types';
import { SupplierInvoiceStatus } from './purchasing.enums';

export const SupplierListQuerySchema = z.object({
  search: z.string().optional(),
  isEnabled: BooleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type SupplierListQuery = z.infer<typeof SupplierListQuerySchema>;

export const SupplierInvoiceListQuerySchema = z.object({
  supplierId: z.uuid().optional(),
  status: z.enum(SupplierInvoiceStatus).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type SupplierInvoiceListQuery = z.infer<typeof SupplierInvoiceListQuerySchema>;

export const SupplierPaymentListQuerySchema = z.object({
  supplierId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type SupplierPaymentListQuery = z.infer<typeof SupplierPaymentListQuerySchema>;

export const SupplierIdParamsSchema = z.object({ id: z.uuid() });
export type SupplierIdParams = z.infer<typeof SupplierIdParamsSchema>;

export const SupplierInvoiceIdParamsSchema = z.object({ id: z.uuid() });
export type SupplierInvoiceIdParams = z.infer<typeof SupplierInvoiceIdParamsSchema>;
