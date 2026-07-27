// Clients domain — contract-typed, HTTP-wired (integration plan.md §2.3). The Sub-01 stub
// functions this file used to also carry (getAdminClients/getAdminClientById/modifyAdminClient/
// deleteAdminClient/searchAdminClients/getAdminClientsStats, consumed only by the
// use-admin-clients*/use-modify-client.ts stub hooks) were removed set-04 Sprint 9 once
// AdminClients.tsx/AdminClientDetail.tsx were confirmed fully rewired onto the real hooks below
// (useClientDirectory.ts, usePosClients.ts) with zero remaining stub consumers.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  CLIENT_ROUTES,
  POS_CLIENT_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type ValidatePhoneCommand,
  type ValidatePhoneResultDto,
  type RegisterClientCommand,
  type ClientMeDto,
  type UpdateMeCommand,
  type ChangeMyPasswordCommand,
  type CartItemDto,
  type AddCartItemCommand,
  type AdminClientListQuery,
  type AdminClientDto,
  type AdminClientOverviewDto,
  type ClientStatsDto,
  type ApproveClientCommand,
  type RejectClientCommand,
  type ResetClientPasswordCommand,
  type AdminUpdateClientCommand,
  type PosClientSearchQuery,
  type PosClientDto,
  type CreatePosClientCommand,
  type PosClientListQuery,
  type UpdatePosClientCommand,
} from "@dragon-telecom/contract";

// --- Web identity (public + client) ---

export async function validatePhone(
  command: ValidatePhoneCommand,
): Promise<ValidatePhoneResultDto> {
  const res = await api.post<ApiResponse<ValidatePhoneResultDto>>(
    apiPath(CLIENT_ROUTES.VALIDATE_PHONE),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Returns just the new client id — register does NOT log the client in (no tokens issued),
// matching IClientsService.register's real return shape (confirmed against Apps/api, not
// assumed from the DTO list — plan.md §6 flagged this as unconfirmed).
export async function register(command: RegisterClientCommand): Promise<{ id: string }> {
  const res = await api.post<ApiResponse<{ id: string }>>(apiPath(CLIENT_ROUTES.REGISTER), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getMe(): Promise<ClientMeDto> {
  const res = await api.get<ApiResponse<ClientMeDto>>(apiPath(CLIENT_ROUTES.ME));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateMe(command: UpdateMeCommand): Promise<ClientMeDto> {
  const res = await api.patch<ApiResponse<ClientMeDto>>(apiPath(CLIENT_ROUTES.ME), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function changeMyPassword(command: ChangeMyPasswordCommand): Promise<void> {
  const res = await api.post<ApiResponse<null>>(apiPath(CLIENT_ROUTES.ME_PASSWORD), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
}

// --- Cart (client) — favorites, no quantity ---

export async function getCart(): Promise<CartItemDto[]> {
  const res = await api.get<ApiResponse<CartItemDto[]>>(apiPath(CLIENT_ROUTES.CART));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Returns void — IClientsService.addCartItem has no return value (confirmed against Apps/api;
// the frontend re-fetches the cart via invalidation rather than trusting a write response).
export async function addToCart(command: AddCartItemCommand): Promise<void> {
  const res = await api.post<ApiResponse<null>>(apiPath(CLIENT_ROUTES.CART), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
}

// No `.data.success` check: this is the one real 204 in the whole backend
// (clients.controller.ts's removeCartItem), and the WHATWG Fetch spec forbids a body on a
// null-body status (204/205/304) — even though the backend calls sendSuccess(res, null, 204)
// (which does call .json(body)), that body cannot reliably survive the wire. Same pattern as
// auth.service.ts's logout(): axios rejects automatically on a non-2xx status, so a bare await
// is both correct and the only encoding that doesn't depend on an unreliable 204 body.
export async function removeFromCart(productId: string): Promise<void> {
  await api.delete(withParams(apiPath(CLIENT_ROUTES.CART_ITEM), { productId }));
}

// --- Admin client pipeline ---

export async function listAdminClients(
  query: AdminClientListQuery,
): Promise<PaginatedResult<AdminClientDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<AdminClientDto>>>(
    apiPath(CLIENT_ROUTES.ADMIN_LIST),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function adminClientStats(): Promise<ClientStatsDto> {
  const res = await api.get<ApiResponse<ClientStatsDto>>(apiPath(CLIENT_ROUTES.ADMIN_STATS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getAdminClient(id: string): Promise<AdminClientDto> {
  const res = await api.get<ApiResponse<AdminClientDto>>(
    withParams(apiPath(CLIENT_ROUTES.ADMIN_DETAIL), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getAdminClientOverview(id: string): Promise<AdminClientOverviewDto> {
  const res = await api.get<ApiResponse<AdminClientOverviewDto>>(
    withParams(apiPath(CLIENT_ROUTES.ADMIN_OVERVIEW), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function approveClient(
  id: string,
  command: ApproveClientCommand,
): Promise<AdminClientDto> {
  const res = await api.post<ApiResponse<AdminClientDto>>(
    withParams(apiPath(CLIENT_ROUTES.APPROVE), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function rejectClient(
  id: string,
  command: RejectClientCommand,
): Promise<AdminClientDto> {
  const res = await api.post<ApiResponse<AdminClientDto>>(
    withParams(apiPath(CLIENT_ROUTES.REJECT), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function resetClientPassword(
  id: string,
  command: ResetClientPasswordCommand,
): Promise<void> {
  const res = await api.post<ApiResponse<null>>(
    withParams(apiPath(CLIENT_ROUTES.RESET_PASSWORD), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
}

export async function updateAdminClient(
  id: string,
  command: AdminUpdateClientCommand,
): Promise<AdminClientDto> {
  const res = await api.patch<ApiResponse<AdminClientDto>>(
    withParams(apiPath(CLIENT_ROUTES.ADMIN_UPDATE), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// --- POS clients ---
// No GET-by-id route exists (POS_CLIENT_ROUTES.ADMIN_BY_ID is PATCH-only per the real backend
// router) — do not add a getPosClient(id); it would have no route to call.

export async function searchPosClients(query: PosClientSearchQuery): Promise<PosClientDto[]> {
  const res = await api.get<ApiResponse<PosClientDto[]>>(apiPath(POS_CLIENT_ROUTES.SEARCH), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function quickCreatePosClient(command: CreatePosClientCommand): Promise<PosClientDto> {
  const res = await api.post<ApiResponse<PosClientDto>>(
    apiPath(POS_CLIENT_ROUTES.QUICK_CREATE),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listPosClients(
  query: PosClientListQuery,
): Promise<PaginatedResult<PosClientDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<PosClientDto>>>(
    apiPath(POS_CLIENT_ROUTES.ADMIN),
    {
      params: query,
    },
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createPosClient(command: CreatePosClientCommand): Promise<PosClientDto> {
  const res = await api.post<ApiResponse<PosClientDto>>(apiPath(POS_CLIENT_ROUTES.ADMIN), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updatePosClient(
  id: string,
  command: UpdatePosClientCommand,
): Promise<PosClientDto> {
  const res = await api.patch<ApiResponse<PosClientDto>>(
    withParams(apiPath(POS_CLIENT_ROUTES.ADMIN_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
