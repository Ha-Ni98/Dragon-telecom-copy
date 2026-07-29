import {
  SaleResponseSchema,
  ReceiptResponseSchema,
  SaleOrigin,
  SaleStatus,
  type SaleDto,
  type ReceiptDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";

export const mockSale: SaleDto = SaleResponseSchema.parse({
  id: "50000000-0000-4000-8000-000000000001",
  reference: "SAL-0001",
  origin: SaleOrigin.POS,
  status: SaleStatus.COMPLETED,
  posClientId: "50000000-0000-4000-8000-000000000002",
  posClientName: "Amine Belkacem",
  subtotal: 6_000,
  discountAmount: 0,
  totalAmount: 6_000,
  paidAmount: 6_000,
  previousCredit: 0,
  newCredit: 0,
  totalCost: 3_600,
  totalProfit: 2_400,
  soldAt: "2026-07-19T10:00:00.000Z",
  staffId: "50000000-0000-4000-8000-000000000003",
  staffName: "Sara Haddad",
  lines: [
    {
      id: "50000000-0000-4000-8000-000000000004",
      productId: mockProductWithPricing.id,
      productName: mockProductWithPricing.name,
      quantity: 2,
      resolvedPrice: 3_000,
      unitPrice: 3_000,
      costOfGoods: 1_800,
      profit: 1_200,
      lineTotal: 6_000,
    },
  ],
});

export const mockSalesPaginated: PaginatedResult<SaleDto> = {
  items: [mockSale],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const mockReceipt: ReceiptDto = ReceiptResponseSchema.parse({
  reference: mockSale.reference,
  lines: [
    {
      productName: mockProductWithPricing.name,
      quantity: 2,
      unitPrice: 3_000,
      lineTotal: 6_000,
    },
  ],
  total: 6_000,
  previousCredit: 0,
  grandTotal: 6_000,
  totalPaid: 6_000,
  newCredit: 0,
});
