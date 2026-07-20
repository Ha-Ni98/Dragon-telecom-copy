// Identity admin domain (users/roles/pages/technicians — access-control back-office) — Sub-02,
// contract-typed, HTTP-wired (integration plan.md §2.1 bottom). Separate from the auth-session
// service (`auth.service.ts`, already real since Sub-01). No Sub-01 stub existed under this file
// name; `use-admin-settings.ts`'s admin-accounts slice (`useAdminAccounts`/`useCreateAdminAccount`/
// `useUpdateAdminAccount`/`useDeleteAdminAccount`, numeric ids, `AdminSettingsService`) stays
// untouched — real page rewiring is Sub-03.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  IDENTITY_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type UserListQuery,
  type UserDto,
  type CreateUserCommand,
  type UpdateUserCommand,
  type RoleDto,
  type CreateRoleCommand,
  type UpdateRoleCommand,
  type SetRolePagesCommand,
  type PagesQuery,
  type PageDto,
  type TechnicianDto,
  type CreateTechnicianCommand,
  type UpdateTechnicianCommand,
} from "@dragon-telecom/contract";

export async function listUsers(query: UserListQuery): Promise<PaginatedResult<UserDto>> {
  const res = await api.get<ApiResponse<PaginatedResult<UserDto>>>(apiPath(IDENTITY_ROUTES.USERS), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createUser(command: CreateUserCommand): Promise<UserDto> {
  const res = await api.post<ApiResponse<UserDto>>(apiPath(IDENTITY_ROUTES.USERS), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function getUser(id: string): Promise<UserDto> {
  const res = await api.get<ApiResponse<UserDto>>(
    withParams(apiPath(IDENTITY_ROUTES.USER_BY_ID), { id }),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateUser(id: string, command: UpdateUserCommand): Promise<UserDto> {
  const res = await api.patch<ApiResponse<UserDto>>(
    withParams(apiPath(IDENTITY_ROUTES.USER_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listRoles(): Promise<RoleDto[]> {
  const res = await api.get<ApiResponse<RoleDto[]>>(apiPath(IDENTITY_ROUTES.ROLES));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createRole(command: CreateRoleCommand): Promise<RoleDto> {
  const res = await api.post<ApiResponse<RoleDto>>(apiPath(IDENTITY_ROUTES.ROLES), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateRole(id: string, command: UpdateRoleCommand): Promise<RoleDto> {
  const res = await api.patch<ApiResponse<RoleDto>>(
    withParams(apiPath(IDENTITY_ROUTES.ROLE_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function setRolePages(id: string, command: SetRolePagesCommand): Promise<RoleDto> {
  const res = await api.put<ApiResponse<RoleDto>>(
    withParams(apiPath(IDENTITY_ROUTES.ROLE_PAGES), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// Bare array — PagesQuery carries no page/limit (integration plan.md §0.2 pagination rule).
// The seeded Page registry is STAFF-scope only (contract's own PageKey comment) — `scope=ADMIN`
// is a valid filter value but returns an empty array against this backend's current seed data.
export async function listPages(query: PagesQuery): Promise<PageDto[]> {
  const res = await api.get<ApiResponse<PageDto[]>>(apiPath(IDENTITY_ROUTES.PAGES), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function listTechnicians(): Promise<TechnicianDto[]> {
  const res = await api.get<ApiResponse<TechnicianDto[]>>(apiPath(IDENTITY_ROUTES.TECHNICIANS));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createTechnician(command: CreateTechnicianCommand): Promise<TechnicianDto> {
  const res = await api.post<ApiResponse<TechnicianDto>>(
    apiPath(IDENTITY_ROUTES.TECHNICIANS),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateTechnician(
  id: string,
  command: UpdateTechnicianCommand,
): Promise<TechnicianDto> {
  const res = await api.patch<ApiResponse<TechnicianDto>>(
    withParams(apiPath(IDENTITY_ROUTES.TECHNICIAN_BY_ID), { id }),
    command,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
