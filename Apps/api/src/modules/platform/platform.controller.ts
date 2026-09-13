import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '@common/http/response';
import { BadRequestError } from '@common/errors';
import type {
  FeeQuery,
  FeesExportQuery,
  UpdateSettingsCommand,
  UploadImageCommand,
  UpsertFeesCommand,
} from '@dragon-telecom/contract';
import type { IPlatformService } from './platform.interface';

export class PlatformController {
  constructor(private service: IPlatformService) {}

  listWilayas = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listWilayas(), 200);
    } catch (error) {
      next(error);
    }
  };

  resolveFee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.resolveFee(req.validated.query as FeeQuery);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getAdminFees = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getAdminFees(), 200);
    } catch (error) {
      next(error);
    }
  };

  upsertFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.upsertFees(req.validated.body as UpsertFeesCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  importFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded (field name must be "file")');
      const result = await this.service.importFees(req.file.buffer);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  // Binary/text file download — deliberately bypasses the ApiResponse envelope (plan §8.4).
  exportFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filename, mime, body } = await this.service.exportFees(req.validated.query as FeesExportQuery);
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(body);
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getSettings(), 200);
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.updateSettings(req.validated.body as UpdateSettingsCommand);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  };

  getPublicSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getPublicSettings(), 200);
    } catch (error) {
      next(error);
    }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded (field name must be "image")');
      const result = await this.service.uploadImage(
        { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype },
        req.validated.body as UploadImageCommand,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
}
