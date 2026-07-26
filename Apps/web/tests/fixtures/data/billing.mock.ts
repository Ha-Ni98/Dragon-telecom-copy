import {
  InvoiceResponseSchema,
  ClientPaymentResponseSchema,
  InvoiceSource,
  InvoiceStatus,
  type InvoiceDto,
  type ClientPaymentDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockSale } from "./sales.mock";

export const mockInvoice: InvoiceDto = InvoiceResponseSchema.parse({
  number: "INV-0001",
  posClientId: "50000000-0000-4000-8000-000000000002",
  clientNameSnapshot: "Amine Belkacem",
  clientAddressSnapshot: "16 Rue Didouche Mourad, Alger",
  sourceType: InvoiceSource.SALE,
  sourceReference: mockSale.reference,
  status: InvoiceStatus.PAID,
  totalAmount: 6_000,
  paidAmount: 6_000,
  previousCredit: 0,
  newCredit: 0,
  totalCost: 3_600,
  totalProfit: 2_400,
  issuedAt: "2026-07-19T10:00:00.000Z",
  staffName: "Sara Haddad",
  lines: [
    {
      label: "Galaxy S21 Battery",
      quantity: 2,
      unitPrice: 3_000,
      costSnapshot: 1_800,
      profit: 1_200,
      lineTotal: 6_000,
      currentAverageCost: 1_800,
    },
  ],
});

export const mockInvoicesPaginated: PaginatedResult<InvoiceDto> = {
  items: [mockInvoice],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const mockClientPayment: ClientPaymentDto = ClientPaymentResponseSchema.parse({
  reference: "PAY-0001",
  posClientName: "Amine Belkacem",
  invoiceNumber: mockInvoice.number,
  amount: 2_000,
  previousCredit: 2_000,
  newCredit: 0,
  paidAt: "2026-07-19T11:00:00.000Z",
  staffName: "Sara Haddad",
});

export const mockClientPaymentsPaginated: PaginatedResult<ClientPaymentDto> = {
  items: [mockClientPayment],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};
