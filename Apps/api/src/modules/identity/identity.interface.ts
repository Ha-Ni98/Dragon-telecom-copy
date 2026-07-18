import type { Prisma } from '@prisma/client';
import type {
  CreateRoleCommand,
  CreateTechnicianCommand,
  CreateUserCommand,
  JWTPayload,
  LoginCommand,
  LoginResultDto,
  PageDto,
  PagesQuery,
  PaginatedResult,
  RefreshCommand,
  RefreshResultDto,
  RoleDto,
  SetRolePagesCommand,
  TechnicianDto,
  UpdateRoleCommand,
  UpdateTechnicianCommand,
  UpdateUserCommand,
  UserDto,
  UserListQuery,
} from '@dragon-telecom/contract';

export type RequestContext = { ipAddress?: string; userAgent?: string };

export interface IIdentityService {
  // Auth & sessions
  login(cmd: LoginCommand, ctx: RequestContext): Promise<LoginResultDto>;
  refresh(cmd: RefreshCommand, ctx: RequestContext): Promise<RefreshResultDto>;
  logout(userId: string): Promise<void>;
  getEffectivePages(user: JWTPayload): Promise<string[]>;

  // Users — createUser/resetPassword take an optional `tx` so the clients module can call
  // them atomically inside its own transaction (spec's injected-service connection rule).
  listUsers(query: UserListQuery): Promise<PaginatedResult<UserDto>>;
  getUser(id: string): Promise<UserDto>;
  createUser(cmd: CreateUserCommand, tx?: Prisma.TransactionClient): Promise<UserDto>;
  updateUser(id: string, cmd: UpdateUserCommand): Promise<UserDto>;
  resetPassword(userId: string, newPassword: string, tx?: Prisma.TransactionClient): Promise<void>;

  // Provisions a bare `type: CLIENT` User row (no Staff profile) — CreateUserCommand can't
  // express CLIENT (its `type` is ADMIN|STAFF only), and a client's profile lives entirely on
  // the clients module's own `Client` row, not on Staff. Always called inside the clients
  // module's own transaction (the approve flow's injected-service connection rule) — `tx` is
  // required, unlike createUser/resetPassword's optional one, since there is no standalone
  // (non-transactional) caller for this method.
  provisionClientUser(input: { username: string; password: string }, tx: Prisma.TransactionClient): Promise<{ userId: string }>;

  // Roles & pages
  listRoles(): Promise<RoleDto[]>;
  createRole(cmd: CreateRoleCommand): Promise<RoleDto>;
  updateRole(id: string, cmd: UpdateRoleCommand): Promise<RoleDto>;
  setRolePages(id: string, cmd: SetRolePagesCommand): Promise<RoleDto>;
  listPages(query: PagesQuery): Promise<PageDto[]>;

  // Technicians — plain rows, never linked to a user; no delete.
  listTechnicians(): Promise<TechnicianDto[]>;
  createTechnician(cmd: CreateTechnicianCommand): Promise<TechnicianDto>;
  updateTechnician(id: string, cmd: UpdateTechnicianCommand): Promise<TechnicianDto>;
}
