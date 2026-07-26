import {
  SupplierResponseSchema,
  SupplierInvoiceResponseSchema,
  ConfirmResultResponseSchema,
  SupplierPaymentResponseSchema,
  SupplierDetailResponseSchema,
  SupplierStatsResponseSchema,
  SupplierInvoiceStatus,
  paginated,
  type SupplierDto,
  type SupplierInvoiceDto,
  type ConfirmResultDto,
  type SupplierPaymentDto,
  type SupplierDetailDto,
  type SupplierStatsDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";

const PAGE_META = { page: 1, limit: 10, total: 1, totalPages: 1 };

export const mockSupplier: SupplierDto = SupplierResponseSchema.parse({
  id: "c0000000-0000-4000-8000-000000000001",
  code: "SUP-0001",
  name: "Yalidine Parts Wholesale",
  contactName: "Karim Boudiaf",
  phone: "0560000001",
  credit: 0,
  totalPaid: 50000,
  totalInvoiced: 50000,
  invoiceCount: 3,
  isEnabled: true,
});

export const mockSuppliersPaginated: PaginatedResult<SupplierDto> = paginated(
  SupplierResponseSchema,
).parse({
  items: [mockSupplier],
  meta: { ...PAGE_META, total: 1 },
});

// DRAFT — projectedNewAverageCost present (spec: reprice projection on DRAFT reads only).
export const mockSupplierInvoiceDraft: SupplierInvoiceDto = SupplierInvoiceResponseSchema.parse({
  id: "c0000000-0000-4000-8000-000000000002",
  reference: "SINV-0001",
  supplierId: mockSupplier.id,
  supplierName: mockSupplier.name,
  status: SupplierInvoiceStatus.DRAFT,
  invoiceDate: "2026-01-05",
  shippingCost: 0,
  totalAmount: 30000,
  paidAmount: 0,
  staffName: "Amine Belkacem",
  lines: [
    {
      id: "c0000000-0000-4000-8000-000000000003",
      productId: mockProductWithPricing.id,
      productNameSnapshot: mockProductWithPricing.name,
      quantity: 10,
      unitCost: 3000,
      landedUnitCost: 3000,
      lineTotal: 30000,
      projectedNewAverageCost: 3000,
    },
  ],
});

// CONFIRMED — projectedNewAverageCost absent (spec: gone once confirmed).
export const mockSupplierInvoiceConfirmed: SupplierInvoiceDto = SupplierInvoiceResponseSchema.parse(
  {
    ...mockSupplierInvoiceDraft,
    id: "c0000000-0000-4000-8000-000000000004",
    reference: "SINV-0002",
    status: SupplierInvoiceStatus.CONFIRMED,
    previousCredit: 20000,
    newCredit: 50000,
    lines: [
      {
        id: "c0000000-0000-4000-8000-000000000005",
        productId: mockProductWithPricing.id,
        productNameSnapshot: mockProductWithPricing.name,
        quantity: 10,
        unitCost: 3000,
        landedUnitCost: 3000,
        lineTotal: 30000,
      },
    ],
  },
);

export const mockSupplierInvoicesPaginated: PaginatedResult<SupplierInvoiceDto> = paginated(
  SupplierInvoiceResponseSchema,
).parse({
  items: [mockSupplierInvoiceDraft, mockSupplierInvoiceConfirmed],
  meta: { ...PAGE_META, total: 2 },
});

export const mockConfirmResult: ConfirmResultDto = ConfirmResultResponseSchema.parse({
  reference: mockSupplierInvoiceConfirmed.reference,
  repriceCandidates: [
    {
      productId: mockProductWithPricing.id,
      name: mockProductWithPricing.name,
      averageCost: 3000,
      current: { defaultSalePrice: 4500, categoryPrices: [] },
    },
  ],
});

export const mockSupplierPayment: SupplierPaymentDto = SupplierPaymentResponseSchema.parse({
  reference: "SPAY-0001",
  supplierName: mockSupplier.name,
  supplierInvoiceReference: mockSupplierInvoiceConfirmed.reference,
  amount: 20000,
  previousCredit: 0,
  newCredit: 20000,
  paidAt: "2026-01-06T00:00:00.000Z",
  staffName: "Amine Belkacem",
});

export const mockSupplierPaymentsPaginated: PaginatedResult<SupplierPaymentDto> = paginated(
  SupplierPaymentResponseSchema,
).parse({ items: [mockSupplierPayment], meta: { ...PAGE_META, total: 1 } });

export const mockSupplierDetail: SupplierDetailDto = SupplierDetailResponseSchema.parse({
  supplier: mockSupplier,
  invoices: [mockSupplierInvoiceConfirmed],
  payments: [mockSupplierPayment],
  productHistory: [
    {
      productId: mockProductWithPricing.id,
      productName: mockProductWithPricing.name,
      totalQuantity: 10,
      lastPurchaseAt: "2026-01-05T00:00:00.000Z",
    },
  ],
});

export const mockSupplierStats: SupplierStatsDto = SupplierStatsResponseSchema.parse({
  totalSuppliers: 8,
  totalCredit: 12000,
  totalInvoiced: 200000,
});
