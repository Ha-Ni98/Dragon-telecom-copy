import type { Prisma } from '@prisma/client';
import type {
  AdminFeesDto,
  DocType,
  FeeDto,
  FeeQuery,
  FeesExportQuery,
  MediaImageDto,
  PublicSettingsDto,
  SettingsDto,
  UpdateSettingsCommand,
  UploadImageCommand,
  UpsertFeesCommand,
  WilayaDto,
} from '@dragon-telecom/contract';
import type { UploadFile } from '@common/storage/storage.types';

export type ImportFeesResult = { imported: number };
export type ExportFeesResult = { filename: string; mime: string; body: Buffer | string };

export interface IPlatformService {
  listWilayas(): Promise<WilayaDto[]>;
  resolveFee(query: FeeQuery): Promise<FeeDto>;
  getAdminFees(): Promise<AdminFeesDto>;
  upsertFees(cmd: UpsertFeesCommand): Promise<AdminFeesDto>;
  importFees(file: Buffer): Promise<ImportFeesResult>;
  exportFees(query: FeesExportQuery): Promise<ExportFeesResult>;
  getSettings(): Promise<SettingsDto>;
  updateSettings(cmd: UpdateSettingsCommand): Promise<SettingsDto>;
  getPublicSettings(): Promise<PublicSettingsDto>;
  // S26.1 — a thin delegation to the shared image pipeline; writes no row.
  uploadImage(file: UploadFile, cmd: UploadImageCommand): Promise<MediaImageDto>;
}

// Injected into every document module (orders, sales, purchasing, repairs, billing) — takes the
// caller's own transaction client so number allocation is atomic with the caller's write.
export interface ISequenceService {
  nextNumber(tx: Prisma.TransactionClient, docType: DocType): Promise<string>;
}

// Injected into orders. PICKUP callers never call this (fee 0 by rule — spec).
export interface IDeliveryFeeService {
  resolve(wilayaId: string, communeId: string | null, mode: 'home' | 'office'): Promise<number>;
}
