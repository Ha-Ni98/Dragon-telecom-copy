import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import type {
  CashRegisterDocumentsQuery,
  CashRegisterQuery,
  ChartParams,
  ChartsQuery,
  FilteredQuery,
  ReportParams,
  ReportQuery,
  TopProductsQuery,
} from '@dragon-telecom/contract';
import type { IStatisticsService } from './statistics.interface';

export class StatisticsController {
  constructor(private service: IStatisticsService) {}

  getAdminDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getAdminDashboard(), 200);
    } catch (error) {
      next(error);
    }
  };

  // Strictly staffId=me — never a query param (spec BL#5). staffId is genuinely absent for an
  // ADMIN caller (S18/P5) — the service treats that as "no staff to scope to", not "everyone".
  getStaffDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getStaffDashboard(req.user!.staffId), 200);
    } catch (error) {
      next(error);
    }
  };

  // S35 — never a query param: always today, whole store (one physical drawer). Profit is stripped
  // in the mapper.
  getStaffCashRegister = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getStaffCashRegister(), 200);
    } catch (error) {
      next(error);
    }
  };

  getOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getOverview(), 200);
    } catch (error) {
      next(error);
    }
  };

  getFiltered = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getFiltered(req.validated.query as FilteredQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  getChart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { chart } = req.validated.params as ChartParams;
      sendSuccess(res, await this.service.getChart(chart, req.validated.query as ChartsQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  getTopProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getTopProducts(req.validated.query as TopProductsQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  // CSV branch streams a Buffer/string body instead of the ApiResponse envelope (inventory/
  // platform/billing precedent) — the service returns an ExportResult only when format=csv.
  getReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.validated.params as ReportParams;
      const result = await this.service.getReport(type, req.validated.query as ReportQuery);
      if ('body' in result) {
        res.setHeader('Content-Type', result.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send(result.body);
        return;
      }
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // S33 — the Caisse summary for one store-local day (today when `date` is omitted).
  getCashRegister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getCashRegister(req.validated.query as CashRegisterQuery), 200);
    } catch (error) {
      next(error);
    }
  };

  // S33 — the drill-through list behind one Caisse figure.
  getCashRegisterDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getCashRegisterDocuments(req.validated.query as CashRegisterDocumentsQuery), 200);
    } catch (error) {
      next(error);
    }
  };
}
