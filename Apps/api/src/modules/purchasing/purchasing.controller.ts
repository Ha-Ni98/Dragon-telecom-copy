import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  CancelSupplierInvoiceCommand,
  CreateSupplierCommand,
  CreateSupplierInvoiceCommand,
  CreateSupplierPaymentCommand,
  SupplierIdParams,
  SupplierInvoiceIdParams,
  SupplierInvoiceListQuery,
  SupplierListQuery,
  SupplierPaymentListQuery,
  UpdateSupplierCommand,
  UpdateSupplierInvoiceCommand,
} from '@dragon-telecom/contract';
import type { IPurchasingService } from './purchasing.interface';

export class PurchasingController {
  constructor(private service: IPurchasingService) {}

  // --- Suppliers ---

  listSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listSuppliers(req.validated.query as SupplierListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  supplierStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.supplierStats(), 200);
    } catch (error) {
      next(error);
    }
  };

  getSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierIdParams;
      sendSuccess(res, await this.service.getSupplier(id), 200);
    } catch (error) {
      next(error);
    }
  };

  createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createSupplier(req.validated.body as CreateSupplierCommand);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierIdParams;
      const result = await this.service.updateSupplier(id, req.validated.body as UpdateSupplierCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // --- Supplier invoices ---

  listInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listInvoices(req.validated.query as SupplierInvoiceListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierInvoiceIdParams;
      sendSuccess(res, await this.service.getInvoice(id), 200);
    } catch (error) {
      next(error);
    }
  };

  createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAuth({types:[ADMIN], checkDB:true}) runs before this handler — ADMIN always
      // carries a Staff profile (identity's own createUser invariant), so staffId is always set.
      const result = await this.service.createInvoice(req.validated.body as CreateSupplierInvoiceCommand, req.user!.staffId!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  updateInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierInvoiceIdParams;
      const result = await this.service.updateInvoice(id, req.validated.body as UpdateSupplierInvoiceCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  confirmInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierInvoiceIdParams;
      const result = await this.service.confirmInvoice(id, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  cancelInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validated.params as SupplierInvoiceIdParams;
      const result = await this.service.cancelInvoice(id, req.validated.body as CancelSupplierInvoiceCommand, req.user!.staffId!);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // --- Payments ---

  listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listPayments(req.validated.query as SupplierPaymentListQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.createPayment(req.validated.body as CreateSupplierPaymentCommand, req.user!.staffId!);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
}
