import type { Prisma } from '@prisma/client';
import type {
  CancelInvoiceCommand,
  ClientPaymentDto,
  ClientPaymentListQuery,
  CreateClientPaymentCommand,
  InvoiceDto,
  InvoiceListQuery,
  PaginatedResult,
  SettingsDto,
} from '@dragon-telecom/contract';
import type { InvoiceIssueInput } from './billing.mapper';

// Mirrors platform/inventory's ExportResult — not a contract DTO; PDFs bypass the
// ApiResponse<T> envelope (plan §D-6), streamed by the controller instead of sendSuccess.
export type PdfResult = { filename: string; mime: 'application/pdf'; body: Buffer };

// The caller-supplied half of an invoice issuance — billing itself owns the client-name/address
// snapshot by default (resolved from posClientId), so those two fields are optional overrides
// rather than the always-required InvoiceIssueInput shape. S10: orders needs this for a
// registered client who was never approved as a PosClient (no posClientId, but a real name is
// known) — sales never hits this gap, since a POS sale only ever knows a PosClient or a walk-in.
// When omitted, issueInvoiceInTx falls back to its existing posClientId resolution / "Walk-in
// Customer" default exactly as before. clientAddressSnapshot was already optional on
// InvoiceIssueInput, so only clientNameSnapshot needs re-adding as optional here.
export type InvoiceIssueRequest = Omit<InvoiceIssueInput, 'number' | 'clientNameSnapshot'> & {
  clientNameSnapshot?: string;
};

export interface IBillingService {
  // Client — `req.user` (JWTPayload) carries `clientId`, never a `posClientId` directly (that's
  // `Client.posClientId`, a separate FK materialized at approval) — the service resolves it
  // internally, same "proxy through the linked PosClient" precedent clients' own getMe uses.
  // A client with no linked PosClient yet (never approved) simply has no invoices: empty list /
  // 404 on single reads, never an error.
  getMyInvoices(query: InvoiceListQuery, clientId: string): Promise<PaginatedResult<InvoiceDto>>;
  getMyInvoice(number: string, clientId: string): Promise<InvoiceDto>;
  getMyInvoicePdf(number: string, clientId: string): Promise<PdfResult>;

  // Staff — issued-by-me only.
  listStaffInvoices(query: InvoiceListQuery, staffId: string): Promise<PaginatedResult<InvoiceDto>>;
  getStaffInvoice(number: string, staffId: string): Promise<InvoiceDto>;
  getStaffInvoicePdf(number: string, staffId: string): Promise<PdfResult>;

  // Admin — all filters, no scoping.
  listAdminInvoices(query: InvoiceListQuery): Promise<PaginatedResult<InvoiceDto>>;
  getAdminInvoice(number: string): Promise<InvoiceDto>;
  getAdminInvoicePdf(number: string): Promise<PdfResult>;
  cancelInvoice(number: string, cmd: CancelInvoiceCommand, staffId: string): Promise<InvoiceDto>;

  // Client-payments ledger (staff|admin create; admin lists).
  createClientPayment(cmd: CreateClientPaymentCommand, staffId: string): Promise<ClientPaymentDto>;
  listClientPayments(query: ClientPaymentListQuery): Promise<PaginatedResult<ClientPaymentDto>>;

  // Injected-port methods (S5) — invoked by sibling modules INSIDE THEIR OWN transaction, never
  // by HTTP routes directly. S10 — order completion now calls these too (issueFromOrder and
  // billing.listener.ts are both deleted); every invoice/payment in the codebase is issued
  // in-transaction, none post-commit.
  issueInvoiceInTx(tx: Prisma.TransactionClient, input: InvoiceIssueRequest): Promise<{ invoiceId: string; number: string }>;
  // `repairId` (S13) tags an on-account row (`invoiceId` still null) with the repair it was
  // collected for, so it can be found again by linkRepairPaymentsToInvoiceInTx below once that
  // repair's invoice is issued at PICKED_UP.
  captureClientPaymentInTx(
    tx: Prisma.TransactionClient,
    input: { posClientId: string; invoiceId?: string; repairId?: string; amount: number; paidAt?: Date; staffId: string },
  ): Promise<{ paymentId: string; reference: string; previousCredit: number; newCredit: number }>;
  // S13/D5/R3 — at PICKED_UP the repair's on-account rows (invoiceId null) are re-pointed at the
  // invoice just issued, then the invoice's paidAmount/status are recomputed from the ledger, so
  // Invoice.paidAmount = Σ ClientPayment.amount holds for repair invoices exactly as it does for
  // sale and order invoices. A no-op when nothing was linked: a walk-in repair has no ledger rows
  // at all, and recomputing from an empty ledger would wipe the paidAmount the invoice was issued
  // with.
  linkRepairPaymentsToInvoiceInTx(tx: Prisma.TransactionClient, input: { repairId: string; invoiceId: string }): Promise<void>;
}

// Injected port (dependency inversion) — real implementation is platform's own PlatformService,
// constructed a second time directly in billing.routes.ts (Sprint 7): PlatformService needs only
// `prisma`, so a second instance alongside platform's own is harmless (no owned state, no
// duplicated writes — billing only ever calls getSettings). Narrowed to the one method the PDF
// header needs, not platform's whole surface (updateSettings/getPublicSettings are none of
// billing's business) — same narrowing precedent as inventory's ICatalogPricingPort.
export interface IStoreSettingsPort {
  getSettings(): Promise<SettingsDto>;
}

// Injected port (dependency inversion, credit-serialization fix, plan §C2/§C5) — real
// implementation is clients' own composition-root singleton (`clientsService`, exported from
// clients.routes.ts), assembled directly in `billing.routes.ts` (one-directional dependency, no
// adapter — the same shape as IStoreSettingsPort above). PosClient belongs to the clients
// module; billing must write it only through this port, always inside its own transaction
// (`tx`), never via a post-commit listener.
export interface IClientCreditPort {
  applyLedgerPayment(
    tx: Prisma.TransactionClient,
    posClientId: string,
    payload: { amount: number },
  ): Promise<{ previousCredit: number; newCredit: number }>;
}
