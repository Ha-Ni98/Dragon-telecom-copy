import type {
  AddRepairPartCommand,
  CreateRepairCommand,
  JWTPayload,
  RepairDto,
  RepairListQuery,
  RepairStatusCommand,
  UpdateRepairCommand,
} from '@dragon-telecom/contract';

// RepairListQuerySchema carries no page/limit (only status?/technicianId?) — "board data"
// (spec), not a paginated list. Resolves the plan §II.2 "PaginatedResult<RepairDto> |
// RepairDto[]" hedge concretely to the plain array the contract's own query shape settles.
export interface IRepairsService {
  // staff(STAFF_REPAIRS): created-by-me (§C-1); admin: all.
  listRepairs(query: RepairListQuery, actor: JWTPayload): Promise<RepairDto[]>;
  // set-03 B1 — single-ticket read (ADM-13/STF-07 ticket detail). Unrestricted by creator,
  // same as every mutation below — the created-by-me rule is a LIST-only convenience filter
  // (§C-1), not a per-ticket ACL.
  getRepair(id: string, actor: JWTPayload): Promise<RepairDto>;
  // + intake history row (§C-1) for both creator-scoping and later staff-resolution
  // (repair.pickedUp carries no staffId — sales' own listener reads this same history).
  // Takes the full actor (not a bare staffId, deviating from the plan's literal signature):
  // CREATE is staff(STAFF_REPAIRS)|admin, and an ADMIN JWT never carries a staffId — the
  // service resolves actor.staffId ?? the shared system-staff fallback for the history row's
  // NOT NULL staffId column, same as every other mutation method here (Sprint 5 report).
  createRepair(cmd: CreateRepairCommand, actor: JWTPayload): Promise<RepairDto>;
  updateRepair(id: string, cmd: UpdateRepairCommand, actor: JWTPayload): Promise<RepairDto>;
  // reserve(PENDING_REPAIR).
  addPart(id: string, cmd: AddRepairPartCommand, actor: JWTPayload): Promise<RepairDto>;
  // release.
  removePart(id: string, partId: string, actor: JWTPayload): Promise<RepairDto>;
  // transitions + history + events (INTAKE→PROCESSING→COMPLETED→PICKED_UP, or →CANCELLED).
  changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto>;
}
