import type { ClientActivityType as PrismaClientActivityType, Prisma, PrismaClient } from '@prisma/client';
import {
  AuditLogResponseSchema,
  paginated,
  type AuditLogDto,
  type ClientActivityCommand,
  type ClientActivityDto,
  type ClientActivityQuery,
  type LogStatsDto,
  type LogsQuery,
  type PaginatedResult,
  type StaffSearchCommand,
  type StaffSearchDto,
  type StaffSearchesQuery,
} from '@dragon-telecom/contract';
import type { AuditEntry, IObservabilityService, ProductSearchedPayload } from './observability.interface';
import { ObservabilityMapper } from './observability.mapper';

const DAY_MS = 24 * 60 * 60 * 1000;

const dateRangeFilter = (from?: string, to?: string): Prisma.DateTimeFilter | undefined => {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
};

export class ObservabilityService implements IObservabilityService {
  constructor(private prisma: PrismaClient) {}

  // --- Beacons (append-only writes; emits nothing) ---

  async recordClientActivity(clientId: string, cmd: ClientActivityCommand): Promise<void> {
    await this.prisma.clientActivityLog.create({
      data: {
        clientId,
        type: cmd.type as PrismaClientActivityType,
        ...(cmd.query != null ? { query: cmd.query } : {}),
        ...(cmd.productId != null ? { productId: cmd.productId } : {}),
        ...(cmd.durationSeconds != null ? { durationSeconds: cmd.durationSeconds } : {}),
      },
    });
  }

  async recordStaffSearch(userId: string, cmd: StaffSearchCommand): Promise<void> {
    await this.prisma.staffSearchLog.create({
      data: {
        userId,
        query: cmd.query,
        ...(cmd.matchedProductId != null ? { matchedProductId: cmd.matchedProductId } : {}),
      },
    });
  }

  async recordProductSearched(payload: ProductSearchedPayload): Promise<void> {
    await this.prisma.staffSearchLog.create({
      data: {
        userId: payload.userId,
        query: payload.query,
        ...(payload.matchedProductId != null ? { matchedProductId: payload.matchedProductId } : {}),
      },
    });
  }

  // Idempotent by (actionType, entityType, entityId, description) — zero-schema, owner decision
  // (plan §8.1). `alwaysAppend` skips the check for inherently-repeatable events (interface note).
  async recordAuditEvent(entry: AuditEntry): Promise<void> {
    if (!entry.alwaysAppend) {
      const existing = await this.prisma.auditLog.findFirst({
        where: {
          actionType: entry.actionType,
          entityType: entry.entityType,
          entityId: entry.entityId,
          description: entry.description,
        },
      });
      if (existing) return;
    }

    await this.prisma.auditLog.create({
      data: {
        actionType: entry.actionType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        description: entry.description,
        ...(entry.userId != null ? { userId: entry.userId } : {}),
        ...(entry.ipAddress != null ? { ipAddress: entry.ipAddress } : {}),
      },
    });
  }

  // --- Reads ---

  async getClientActivity(clientId: string, query: ClientActivityQuery): Promise<ClientActivityDto[]> {
    const createdAt = dateRangeFilter(query.from, query.to);
    const entries = await this.prisma.clientActivityLog.findMany({
      where: {
        clientId,
        ...(query.type != null ? { type: query.type as PrismaClientActivityType } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map((entry) => ObservabilityMapper.toClientActivityDto(entry));
  }

  async listStaffSearches(query: StaffSearchesQuery): Promise<StaffSearchDto[]> {
    const createdAt = dateRangeFilter(query.from, query.to);
    const entries = await this.prisma.staffSearchLog.findMany({
      where: {
        ...(query.userId != null ? { userId: query.userId } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(query.q ? { query: { contains: query.q, mode: 'insensitive' } } : {}),
      },
      include: { user: true, matchedProduct: true },
      orderBy: { createdAt: 'desc' },
    });
    return entries.map((entry) => ObservabilityMapper.toStaffSearchDto(entry));
  }

  async listLogs(query: LogsQuery): Promise<PaginatedResult<AuditLogDto>> {
    const createdAt = dateRangeFilter(query.from, query.to);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actionType != null ? { actionType: query.actionType } : {}),
      ...(query.userId != null ? { userId: query.userId } : {}),
      ...(query.search ? { description: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = logs.map((log) => ObservabilityMapper.toAuditLogDto(log));
    return paginated(AuditLogResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async getLogStats(): Promise<LogStatsDto> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS);

    const [total, today, week, month] = await this.prisma.$transaction([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    return ObservabilityMapper.toLogStatsDto({ total, today, week, month });
  }
}
