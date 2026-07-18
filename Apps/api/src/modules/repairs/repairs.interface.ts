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
  // + intake history row (§C-1) for both creator-scoping and later staff-resolution
  // (repair.pickedUp carries no staffId — sales' own listener reads this same history).
  createRepair(cmd: CreateRepairCommand, staffId: string): Promise<RepairDto>;
  updateRepair(id: string, cmd: UpdateRepairCommand, actor: JWTPayload): Promise<RepairDto>;
  // reserve(PENDING_REPAIR).
  addPart(id: string, cmd: AddRepairPartCommand, actor: JWTPayload): Promise<RepairDto>;
  // release.
  removePart(id: string, partId: string, actor: JWTPayload): Promise<RepairDto>;
  // transitions + history + events (INTAKE→PROCESSING→COMPLETED→PICKED_UP, or →CANCELLED).
  changeStatus(id: string, cmd: RepairStatusCommand, actor: JWTPayload): Promise<RepairDto>;
}
