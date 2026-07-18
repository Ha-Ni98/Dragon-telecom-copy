import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  CancelInvoiceCommand,
  ClientPaymentListQuery,
  CreateClientPaymentCommand,
  InvoiceListQuery,
  InvoiceNumberParams,
} from '@dragon-telecom/contract';
import type { IBillingService, PdfResult } from './billing.interface';

export class BillingController {
  constructor(private service: IBillingService) {}

  // --- Client (JWTPayload carries clientId, not posClientId — resolved in the service) ---

  getMyInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getMyInvoices(req.validated.query as InvoiceListQuery, req.user!.clientId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getMyInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      sendSuccess(res, await this.service.getMyInvoice(number, req.user!.clientId!), 200);
    } catch (error) {
      next(error);
    }
  };

  getMyInvoicePdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      this.streamPdf(res, await this.service.getMyInvoicePdf(number, req.user!.clientId!));
    } catch (error) {
      next(error);
    }
  };

  // --- Staff (issued-by-me only) ---

  listStaffInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listStaffInvoices(req.validated.query as InvoiceListQuery, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getStaffInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      sendSuccess(res, await this.service.getStaffInvoice(number, req.user!.staffId!), 200);
    } catch (error) {
      next(error);
    }
  };

  getStaffInvoicePdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      this.streamPdf(res, await this.service.getStaffInvoicePdf(number, req.user!.staffId!));
    } catch (error) {
      next(error);
    }
  };

  // --- Admin ---

  listAdminInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listAdminInvoices(req.validated.query as InvoiceListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  getAdminInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      sendSuccess(res, await this.service.getAdminInvoice(number), 200);
    } catch (error) {
      next(error);
    }
  };

  getAdminInvoicePdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      this.streamPdf(res, await this.service.getAdminInvoicePdf(number));
    } catch (error) {
      next(error);
    }
  };

  cancelInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { number } = req.validated.params as InvoiceNumberParams;
      const result = await this.service.cancelInvoice(number, req.validated.body as CancelInvoiceCommand, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // --- Client-payments ledger (serves both STAFF_CLIENT_PAYMENTS and ADMIN_CLIENT_PAYMENTS) ---

  createClientPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createClientPayment(req.validated.body as CreateClientPaymentCommand, req.user!.staffId!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  listClientPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listClientPayments(req.validated.query as ClientPaymentListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  // PDFs bypass the ApiResponse<T> envelope (plan §D-6) — streamed directly, not via sendSuccess.
  private streamPdf(res: Response, pdf: PdfResult): void {
    res.setHeader('Content-Type', pdf.mime);
    res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    res.send(pdf.body);
  }
}
