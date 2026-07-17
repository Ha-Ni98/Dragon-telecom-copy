import type {
  AuditLogDto,
  ClientActivityCommand,
  ClientActivityDto,
  ClientActivityQuery,
  LogStatsDto,
  LogsQuery,
  PaginatedResult,
  StaffSearchCommand,
  StaffSearchDto,
  StaffSearchesQuery,
} from '@dragon-telecom/contract';

// The audit row's persistence shape — module-local, not a contract DTO (mirrors identity's
// RequestContext). `eventKey` deliberately absent: idempotency is a zero-schema pre-insert
// existence check on (actionType, entityType, entityId, description) — owner decision, Sprint O1
// — not a dedicated dedup column.
export type AuditEntry = {
  actionType: string;
  entityType: string;
  entityId: string;
  description: string;
  userId?: string;
  ipAddress?: string;
};

// catalog.events.ts's `product.searched` payload shape, mirrored locally rather than importing
// `CatalogEvents` — keeps this interface self-contained the same way `AuditEntry` is.
export type ProductSearchedPayload = { userId: string; query: string; matchedProductId?: string };

export interface IObservabilityService {
  // Beacons
  recordClientActivity(clientId: string, cmd: ClientActivityCommand): Promise<void>;
  recordStaffSearch(userId: string, cmd: StaffSearchCommand): Promise<void>;

  // Reads
  getClientActivity(clientId: string, query: ClientActivityQuery): Promise<ClientActivityDto[]>;
  listStaffSearches(query: StaffSearchesQuery): Promise<StaffSearchDto[]>;
  listLogs(query: LogsQuery): Promise<PaginatedResult<AuditLogDto>>;
  getLogStats(): Promise<LogStatsDto>;

  // Internal — called only by observability.listener.ts, no route of their own
  recordAuditEvent(entry: AuditEntry): Promise<void>;
  recordProductSearched(payload: ProductSearchedPayload): Promise<void>;
}
