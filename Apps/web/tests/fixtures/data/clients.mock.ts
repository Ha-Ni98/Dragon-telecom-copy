import {
  ValidatePhoneResultResponseSchema,
  ClientMeResponseSchema,
  AdminClientResponseSchema,
  PosClientResponseSchema,
  CartItemResponseSchema,
  ClientStatsResponseSchema,
  ClientStatus,
  PhoneAvailability,
  paginated,
  type ValidatePhoneResultDto,
  type ClientMeDto,
  type AdminClientDto,
  type PosClientDto,
  type CartItemDto,
  type ClientStatsDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";
import { mockProductWithPricing } from "./catalog.mock";

const PAGE_META = { page: 1, limit: 10, total: 1, totalPages: 1 };

export const mockPhoneAvailable: ValidatePhoneResultDto = ValidatePhoneResultResponseSchema.parse({
  isValid: true,
  status: PhoneAvailability.AVAILABLE,
});

export const mockPhoneRegistered: ValidatePhoneResultDto = ValidatePhoneResultResponseSchema.parse({
  isValid: true,
  status: PhoneAvailability.REGISTERED,
});

export const mockPhonePending: ValidatePhoneResultDto = ValidatePhoneResultResponseSchema.parse({
  isValid: true,
  status: PhoneAvailability.PENDING,
});

export const mockClientMe: ClientMeDto = ClientMeResponseSchema.parse({
  id: "aa000000-0000-4000-8000-000000000001",
  firstName: "Amine",
  lastName: "Belkacem",
  phone: "0550000001",
  wilayaId: "aa000000-0000-4000-8000-000000000010",
  communeId: "aa000000-0000-4000-8000-000000000020",
  createdAt: "2026-01-01T00:00:00.000Z",
  credit: 0,
  totalPaid: 15000,
  totalSold: 15000,
});

export const mockAdminClientPending: AdminClientDto = AdminClientResponseSchema.parse({
  id: "ac000000-0000-4000-8000-000000000001",
  code: "CL-0001",
  fullName: "Amine Belkacem",
  phone: "0550000001",
  wilayaFr: "Alger",
  communeFr: "Bab Ezzouar",
  status: ClientStatus.PENDING,
  isEnabled: true,
  totalOrders: 0,
  totalSpent: 0,
});

export const mockAdminClientApproved: AdminClientDto = AdminClientResponseSchema.parse({
  id: "ac000000-0000-4000-8000-000000000002",
  code: "CL-0002",
  fullName: "Sara Haddad",
  username: "sara.h",
  phone: "0550000002",
  wilayaFr: "Oran",
  communeFr: "Es Senia",
  categoryName: "Repair Shops",
  status: ClientStatus.APPROVED,
  isEnabled: true,
  totalOrders: 12,
  totalSpent: 240000,
  lastOrderDate: "2026-01-05T00:00:00.000Z",
  posClientId: "ad000000-0000-4000-8000-000000000001",
});

export const mockAdminClientsPaginated: PaginatedResult<AdminClientDto> = paginated(
  AdminClientResponseSchema,
).parse({
  items: [mockAdminClientPending, mockAdminClientApproved],
  meta: { ...PAGE_META, total: 2 },
});

export const mockPosClient: PosClientDto = PosClientResponseSchema.parse({
  id: "ad000000-0000-4000-8000-000000000001",
  code: "POS-0001",
  name: "Walk-in Customer",
  credit: 0,
  totalPaid: 5000,
  totalSold: 5000,
  isEnabled: true,
});

export const mockPosClientsPaginated: PaginatedResult<PosClientDto> = paginated(
  PosClientResponseSchema,
).parse({
  items: [mockPosClient],
  meta: { ...PAGE_META, total: 1 },
});

// CartItemDto.product nests the real ProductWithPricingDto — reuse catalog's fixture directly
// rather than duplicating it (integration sprints.md Sprint 4 handoff note).
export const mockCartItem: CartItemDto = CartItemResponseSchema.parse({
  productId: mockProductWithPricing.id,
  addedAt: "2026-01-03T00:00:00.000Z",
  product: mockProductWithPricing,
});

export const mockCart: CartItemDto[] = [mockCartItem];

export const mockClientStats: ClientStatsDto = ClientStatsResponseSchema.parse({
  totalClients: 40,
  pending: 5,
  approved: 30,
  rejected: 5,
  newThisMonth: 6,
});
