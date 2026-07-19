// Clients domain — Sub-01 scaffolding. Every read returns a typed empty default; real HTTP
// wiring against @dragon-telecom/contract's CLIENTS_ROUTES lands in Sub-02 (see catalog.service.ts
// header comment for the numeric-id/view-model scope decision this follows).
import type {
  AdminClientsFilters,
  AdminClientsPaginatedResponse,
  AdminClientWithDetails,
  AdminClientsStats,
  ClientModificationData,
  Client,
  UserAccountData,
  PasswordResetData,
} from "@/types/draft-types/client.types";

// Stub write-paths that would otherwise need to fabricate a full entity throw this instead
// of faking success — real persistence lands in Sub-02.
const NOT_WIRED = 'This action is not available yet.';

const ALGERIAN_PHONE_REGEX = /^(\+213[0-9]{9}|0[0-9]{9})$/;

export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;
  return ALGERIAN_PHONE_REGEX.test(phone.replace(/\s+/g, ''));
}

// No registered-client store exists yet (Sub-02) — every phone number looks available.
export async function checkPhoneExists(_phone: string): Promise<boolean> {
  return false;
}

export async function registerClient(_formData: Partial<Client>): Promise<void> {}

export async function getAdminClients(filters: AdminClientsFilters): Promise<AdminClientsPaginatedResponse> {
  return {
    clients: [],
    pagination: {
      currentPage: filters.page || 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: filters.limit || 10,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

export async function getAdminClientById(_clientId: number): Promise<AdminClientWithDetails | null> {
  return null;
}

export async function modifyAdminClient(_clientId: number, _updates: ClientModificationData): Promise<void> {}

export async function deleteAdminClient(_clientId: number): Promise<void> {}

export async function searchAdminClients(_query: string): Promise<AdminClientWithDetails[]> {
  return [];
}

export async function getAdminClientsStats(): Promise<AdminClientsStats> {
  return { totalClients: 0, activeClients: 0, newThisMonth: 0, averageOrdersPerClient: 0 };
}

// The signed-in client's own account — distinct from admin client management above.
export async function getMyAccount(): Promise<UserAccountData | null> {
  return null;
}

export async function updateMyAccount(_updates: Partial<UserAccountData>): Promise<void> {}

export async function resetMyAccountPassword(_data: PasswordResetData): Promise<void> {
  throw new Error(NOT_WIRED);
}
