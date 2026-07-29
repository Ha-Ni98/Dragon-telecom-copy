import type { Prisma } from '@prisma/client';
import type {
  CancelSupplierInvoiceCommand,
  ConfirmResultDto,
  CreateSupplierCommand,
  CreateSupplierInvoiceCommand,
  CreateSupplierPaymentCommand,
  PaginatedResult,
  SupplierDetailDto,
  SupplierDto,
  SupplierInvoiceDto,
  SupplierInvoiceListQuery,
  SupplierListQuery,
  SupplierPaymentDto,
  SupplierPaymentListQuery,
  SupplierStatsDto,
  UpdateSupplierCommand,
  UpdateSupplierInvoiceCommand,
} from '@dragon-telecom/contract';

export interface IPurchasingService {
  // Suppliers (admin)
  listSuppliers(query: SupplierListQuery): Promise<PaginatedResult<SupplierDto>>;
  supplierStats(): Promise<SupplierStatsDto>;
  getSupplier(id: string): Promise<SupplierDetailDto>;
  createSupplier(cmd: CreateSupplierCommand): Promise<SupplierDto>;
  updateSupplier(id: string, cmd: UpdateSupplierCommand): Promise<SupplierDto>;

  // Supplier invoices (admin)
  listInvoices(query: SupplierInvoiceListQuery): Promise<PaginatedResult<SupplierInvoiceDto>>;
  getInvoice(id: string): Promise<SupplierInvoiceDto>;
  createInvoice(cmd: CreateSupplierInvoiceCommand, staffId: string): Promise<SupplierInvoiceDto>;
  updateInvoice(id: string, cmd: UpdateSupplierInvoiceCommand): Promise<SupplierInvoiceDto>;
  confirmInvoice(id: string, staffId: string): Promise<ConfirmResultDto>;
  cancelInvoice(id: string, cmd: CancelSupplierInvoiceCommand, staffId: string): Promise<SupplierInvoiceDto>;

  // Payments (admin ledger)
  listPayments(query: SupplierPaymentListQuery): Promise<PaginatedResult<SupplierPaymentDto>>;
  createPayment(cmd: CreateSupplierPaymentCommand, staffId: string): Promise<SupplierPaymentDto>;
}

// Injected port (dependency inversion) — real implementation lives in catalog
// (`CatalogProductService.getRepriceCandidates`/`getCostBasis`, plan §C-3/Sprint 1), assembled
// directly in purchasing.routes.ts (one-directional dependency, no adapter — the same shape
// clients.routes.ts already established for its own catalog/identity imports in Sprint 4).
// Signatures mirror catalog's real methods exactly so structural typing needs no shim.
export interface ICatalogRepricePort {
  getRepriceCandidates(
    tx: Prisma.TransactionClient,
    productIds: string[],
  ): Promise<
    {
      productId: string;
      name: string;
      avgStockPrice: number;
      quantityOnHand: number;
      current: {
        guestPrice?: number;
        defaultSalePrice?: number;
        categoryPrices: { categoryId: string; categoryName: string; price: number }[];
      };
    }[]
  >;
  getCostBasis(
    productIds: string[],
  ): Promise<{ productId: string; name: string; avgStockPrice: number; avgPrice: number; quantityOnHand: number }[]>;
}
