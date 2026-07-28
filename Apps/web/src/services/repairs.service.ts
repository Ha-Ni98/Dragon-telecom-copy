// Repairs domain (repairs + nested parts + status) — Sub-02, contract-typed, HTTP-wired
// (integration plan.md §2.11). Tier 5 — no MVP UI consumes this yet; the data layer is built
// ahead of Sub-03. No Sub-01 stub exists under this file name.
import { api } from "@/lib/axios";
import { apiPath, withParams } from "@/lib/api-path";
import {
  REPAIR_ROUTES,
  type ApiResponse,
  type PaginatedResult,
  type RecordRepairPaymentCommand,
  type RepairDto,
  type RepairListQuery,
  type CreateRepairCommand,
  type UpdateRepairCommand,
  type AddRepairPartCommand,
  type RepairStatusCommand,
  type TechnicianRepairStatsDto,
} from "@dragon-telecom/contract";

// Every route in this domain is a genuine STAFF_*/ADMIN_* dual-mounted pair (confirmed against
// repairs.routes.ts — unlike sales, where only list/detail are actually paired).
export type RepairsScope = "staff" | "admin";

// S13/R2 — the board is now paginated at 10/page (RepairListQuery carries page/limit + an
// intake-date range), not the unbounded "board data" array it used to be.
export async function listRepairs(
  scope: RepairsScope,
  query: RepairListQuery,
): Promise<PaginatedResult<RepairDto>> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_LIST : REPAIR_ROUTES.STAFF_LIST;
  const res = await api.get<ApiResponse<PaginatedResult<RepairDto>>>(apiPath(route), {
    params: query,
  });
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// set-03 B1 — single-ticket read (ticket detail drawer); backend route added alongside it
// (REPAIR_ROUTES.STAFF_BY_ID/ADMIN_BY_ID, same `:id` path as update, mounted on GET).
export async function getRepair(scope: RepairsScope, id: string): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_BY_ID : REPAIR_ROUTES.STAFF_BY_ID;
  const res = await api.get<ApiResponse<RepairDto>>(withParams(apiPath(route), { id }));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function createRepair(
  scope: RepairsScope,
  command: CreateRepairCommand,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_CREATE : REPAIR_ROUTES.STAFF_CREATE;
  const res = await api.post<ApiResponse<RepairDto>>(apiPath(route), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

export async function updateRepair(
  scope: RepairsScope,
  id: string,
  command: UpdateRepairCommand,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_UPDATE : REPAIR_ROUTES.STAFF_UPDATE;
  const res = await api.patch<ApiResponse<RepairDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// "reserve(PENDING_REPAIR)" per the backend interface comment — cross-invalidates inventory
// (see useAddRepairPart in useRepairs.ts).
export async function addRepairPart(
  scope: RepairsScope,
  id: string,
  command: AddRepairPartCommand,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_PARTS : REPAIR_ROUTES.STAFF_PARTS;
  const res = await api.post<ApiResponse<RepairDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// "release" per the backend interface comment — returns the updated RepairDto (200), not void
// (confirmed against repairs.controller.ts's removePart), and like addPart cross-invalidates
// inventory.
export async function removeRepairPart(
  scope: RepairsScope,
  id: string,
  partId: string,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_PART_BY_ID : REPAIR_ROUTES.STAFF_PART_BY_ID;
  const res = await api.delete<ApiResponse<RepairDto>>(withParams(apiPath(route), { id, partId }));
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// POST, not PATCH — confirmed against repairs.routes.ts (plan.md's table says PATCH; the real
// router mounts STAFF_STATUS/ADMIN_STATUS with `router.post`).
export async function updateRepairStatus(
  scope: RepairsScope,
  id: string,
  command: RepairStatusCommand,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_STATUS : REPAIR_ROUTES.STAFF_STATUS;
  const res = await api.post<ApiResponse<RepairDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S13/D5 — a cumulative payment at any pre-pickup step.
export async function recordRepairPayment(
  scope: RepairsScope,
  id: string,
  command: RecordRepairPaymentCommand,
): Promise<RepairDto> {
  const route = scope === "admin" ? REPAIR_ROUTES.ADMIN_PAYMENTS : REPAIR_ROUTES.STAFF_PAYMENTS;
  const res = await api.post<ApiResponse<RepairDto>>(withParams(apiPath(route), { id }), command);
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}

// S13/R1 — admin-only; no scope parameter (there is no staff route for this yet, S18 aligns it).
export async function listTechnicianStats(): Promise<TechnicianRepairStatsDto[]> {
  const res = await api.get<ApiResponse<TechnicianRepairStatsDto[]>>(
    apiPath(REPAIR_ROUTES.ADMIN_TECHNICIAN_STATS),
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
