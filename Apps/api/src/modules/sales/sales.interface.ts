import type { Prisma } from '@prisma/client';
import type {
  ConfirmSaleCommand,
  CreateReturnCommand,
  JWTPayload,
  PaginatedResult,
  ReceiptDto,
  ReturnDto,
  ReturnListQuery,
  ReturnWholeSaleCommand,
  SaleDraftCommand,
  SaleDto,
  SaleListQuery,
  UpdateSaleDraftCommand,
} from '@dragon-telecom/contract';
import type { InvoiceIssueRequest } from '../billing/billing.interface';

export interface ISalesService {
  createDraft(cmd: SaleDraftCommand, staffId: string): Promise<SaleDto>;
  updateDraft(id: string, cmd: UpdateSaleDraftCommand, actor: JWTPayload): Promise<SaleDto>;
  deleteDraft(id: string, actor: JWTPayload): Promise<void>;
  // The transaction (spec BL#2) — returns the printed receipt, built from the committed
  // snapshot; `getSale` is the richer read-back afterward.
  confirm(id: string, cmd: ConfirmSaleCommand, actor: JWTPayload): Promise<ReceiptDto>;
  listStaffSales(query: SaleListQuery, staffId: string): Promise<PaginatedResult<SaleDto>>;
  listAdminSales(query: SaleListQuery): Promise<PaginatedResult<SaleDto>>;
  getSale(reference: string, actor: JWTPayload): Promise<SaleDto>;
  createReturn(cmd: CreateReturnCommand, staffId: string): Promise<SaleDto>;
  // S32 (P2) — splits one refund across every remaining line and delegates to createReturn.
  returnWholeSale(cmd: ReturnWholeSaleCommand, staffId: string): Promise<SaleDto>;
  // S12 — the admin Returns tab's read side (createReturn above is write-only).
  listReturns(query: ReturnListQuery): Promise<PaginatedResult<ReturnDto>>;
}

// Injected port (dependency inversion, plan §C-2/§I.2) — real implementation lives in catalog
// (`CatalogProductService.resolvePosPrices`, Sprint 1), assembled directly in
// `sales.routes.ts` (one-directional dependency, no adapter — the same shape purchasing's own
// `ICatalogRepricePort` established). Signature mirrors catalog's real method exactly (name
// included) so structural typing needs no shim. `resolvedPrice` is optional: `defaultSalePrice`
// is genuinely nullable, so an unresolved price is a real state, not an error catalog raises —
// `confirm` (Sprint 3) must treat a missing `resolvedPrice` as its own domain error.
export interface ICatalogPosPricingPort {
  resolvePosPrices(
    productIds: string[],
    categoryId: string | null,
  ): Promise<{ productId: string; productName: string; resolvedPrice?: number }[]>;
}

// Injected port (dependency inversion, credit-serialization fix, plan §C2/§C3; split into two
// orthogonal primitives, plan S5) — real implementation is clients' own composition-root
// singleton (`clientsService`, exported from clients.routes.ts), assembled directly in
// `sales.routes.ts` (one-directional dependency, no adapter — the same shape as
// ICatalogPosPricingPort above). PosClient belongs to the clients module; sales must write it
// only through this port, always inside its own transaction (`tx`), never via a post-commit
// listener.
export interface IClientCreditPort {
  applyDocumentCharge(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { totalSoldDelta: number; creditDelta: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
  applyLedgerPayment(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { amount: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}

// Injected port (dependency inversion, S5/R2) — real implementation is billing's own
// composition-root singleton (`billingService`, exported from billing.routes.ts), assembled
// directly in sales.routes.ts. Invoice and ClientPayment belong to the billing module; sales must
// create them only through this port, always inside its own transaction (`tx`), never by writing
// tx.invoice/tx.clientPayment directly and never via a post-commit listener.
export interface IBillingIssuePort {
  issueInvoiceInTx(
    tx: Prisma.TransactionClient,
    input: InvoiceIssueRequest,
  ): Promise<{ invoiceId: string; number: string }>;
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; amount: number; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
}
