import type {
  BillingEvents,
  CancelInvoiceCommand,
  ClientPaymentDto,
  ClientPaymentListQuery,
  CreateClientPaymentCommand,
  InvoiceDto,
  InvoiceListQuery,
  OrdersEvents,
  PaginatedResult,
  SalesEvents,
} from '@dragon-telecom/contract';

// Mirrors platform/inventory's ExportResult — not a contract DTO; PDFs bypass the
// ApiResponse<T> envelope (plan §D-6), streamed by the controller instead of sendSuccess.
export type PdfResult = { filename: string; mime: 'application/pdf'; body: Buffer };

export interface IBillingService {
  // Client — via linked posClientId; 404 on foreign invoice numbers.
  getMyInvoices(query: InvoiceListQuery, posClientId: string): Promise<PaginatedResult<InvoiceDto>>;
  getMyInvoice(number: string, posClientId: string): Promise<InvoiceDto>;
  getMyInvoicePdf(number: string, posClientId: string): Promise<PdfResult>;

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

  // Internal — invoked only by this module's own listener (post-commit), never by HTTP routes.
  issueFromSale(payload: SalesEvents['sale.confirmed']): Promise<void>;
  issueFromOrder(payload: OrdersEvents['order.confirmed']): Promise<void>;
  applyClientPaymentRecorded(payload: BillingEvents['payment.clientRecorded']): Promise<void>;
}
