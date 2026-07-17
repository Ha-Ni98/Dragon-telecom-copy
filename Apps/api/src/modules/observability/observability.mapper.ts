import type { AuditLog, ClientActivityLog, Product, StaffSearchLog, User } from '@prisma/client';
import {
  AuditLogResponseSchema,
  ClientActivityResponseSchema,
  LogStatsResponseSchema,
  StaffSearchResponseSchema,
  type AuditLogDto,
  type ClientActivityDto,
  type ClientActivityType,
  type LogStatsDto,
  type StaffSearchDto,
} from '@dragon-telecom/contract';

type ClientActivityWithProduct = ClientActivityLog & { product: Product | null };
type StaffSearchWithRelations = StaffSearchLog & { user: User; matchedProduct: Product | null };
type AuditLogWithUser = AuditLog & { user: User | null };
type LogStatsCounts = { total: number; today: number; week: number; month: number };

export class ObservabilityMapper {
  static toClientActivityDto(entry: ClientActivityWithProduct): ClientActivityDto {
    const dto: ClientActivityDto = {
      type: entry.type as ClientActivityType,
      ...(entry.query != null ? { query: entry.query } : {}),
      ...(entry.product != null ? { product: { id: entry.product.id, name: entry.product.name } } : {}),
      ...(entry.durationSeconds != null ? { durationSeconds: entry.durationSeconds } : {}),
      createdAt: entry.createdAt.toISOString(),
    };
    return ClientActivityResponseSchema.parse(dto);
  }

  static toStaffSearchDto(entry: StaffSearchWithRelations): StaffSearchDto {
    const dto: StaffSearchDto = {
      userId: entry.userId,
      userName: entry.user.username,
      query: entry.query,
      ...(entry.matchedProduct != null
        ? { matchedProduct: { id: entry.matchedProduct.id, name: entry.matchedProduct.name } }
        : {}),
      createdAt: entry.createdAt.toISOString(),
    };
    return StaffSearchResponseSchema.parse(dto);
  }

  // actionType stays an open string (spec: "adding an actionType = adding a listener, zero
  // schema change") — never cast to an enum.
  static toAuditLogDto(entry: AuditLogWithUser): AuditLogDto {
    const dto: AuditLogDto = {
      id: entry.id,
      ...(entry.user != null ? { user: { id: entry.user.id, username: entry.user.username } } : {}),
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
      ...(entry.ipAddress != null ? { ipAddress: entry.ipAddress } : {}),
      createdAt: entry.createdAt.toISOString(),
    };
    return AuditLogResponseSchema.parse(dto);
  }

  static toLogStatsDto(counts: LogStatsCounts): LogStatsDto {
    return LogStatsResponseSchema.parse(counts);
  }
}
