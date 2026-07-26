import {
  ClientActivityResponseSchema,
  StaffSearchResponseSchema,
  AuditLogResponseSchema,
  LogStatsResponseSchema,
  ClientActivityType,
  type ClientActivityDto,
  type StaffSearchDto,
  type AuditLogDto,
  type LogStatsDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";

export const mockClientActivity: ClientActivityDto = ClientActivityResponseSchema.parse({
  type: ClientActivityType.PRODUCT_VIEW,
  product: { id: mockProductWithPricing.id, name: mockProductWithPricing.name },
  durationSeconds: 45,
  createdAt: "2026-07-19T12:00:00.000Z",
});

export const mockClientActivities: ClientActivityDto[] = [mockClientActivity];

export const mockStaffSearch: StaffSearchDto = StaffSearchResponseSchema.parse({
  userId: "30000000-0000-4000-8000-000000000001",
  userName: "Sara Haddad",
  query: "galaxy s21 battery",
  matchedProduct: { id: mockProductWithPricing.id, name: mockProductWithPricing.name },
  createdAt: "2026-07-19T12:05:00.000Z",
});

export const mockStaffSearches: StaffSearchDto[] = [mockStaffSearch];

export const mockAuditLog: AuditLogDto = AuditLogResponseSchema.parse({
  id: "30000000-0000-4000-8000-000000000002",
  user: { id: "30000000-0000-4000-8000-000000000001", username: "sara.haddad" },
  actionType: "product.updated",
  entityType: "Product",
  entityId: mockProductWithPricing.id,
  description: "Updated pricing for Galaxy S21 Battery",
  ipAddress: "10.0.0.5",
  createdAt: "2026-07-19T12:10:00.000Z",
});

export const mockAuditLogsPaginated: PaginatedResult<AuditLogDto> = {
  items: [mockAuditLog],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const mockLogStats: LogStatsDto = LogStatsResponseSchema.parse({
  total: 340,
  today: 12,
  week: 58,
  month: 210,
});
