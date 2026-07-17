import type { Client, PrismaClient, Staff } from '@prisma/client';
import { Prisma, UserType as PrismaUserType, PageScope as PrismaPageScope } from '@prisma/client';
import {
  ErrorCode,
  LoginResultResponseSchema,
  RefreshResultResponseSchema,
  UserResponseSchema,
  paginated,
  type CreateRoleCommand,
  type CreateTechnicianCommand,
  type CreateUserCommand,
  type JWTPayload,
  type LoginCommand,
  type LoginResultDto,
  type PageDto,
  type PagesQuery,
  type PaginatedResult,
  type RefreshCommand,
  type RefreshResultDto,
  type RoleDto,
  type SetRolePagesCommand,
  type TechnicianDto,
  type UpdateRoleCommand,
  type UpdateTechnicianCommand,
  type UpdateUserCommand,
  type UserDto,
  type UserListQuery,
  type UserType as ContractUserType,
} from '@dragon-telecom/contract';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { comparePassword, hashPassword } from '@common/utils/password.utils';
import { generateToken } from '@common/utils/token.utils';
import { generateRefreshToken, hashRefreshToken } from '@common/utils/refresh-token.utils';
import { env } from '../../env';
import type { IIdentityService, RequestContext } from './identity.interface';
import { IdentityMapper } from './identity.mapper';

// The full relation shape IdentityMapper.toUserDto needs. `staff` is nullable at the Prisma
// level (User.staff is an optional relation) even though ADMIN/STAFF rows always have one in
// practice — see assertStaffLoaded().
const USER_INCLUDE = {
  staff: true,
  userRoles: { include: { role: { include: { rolePages: { include: { page: true } } } } } },
} satisfies Prisma.UserInclude;

const ROLE_INCLUDE = { rolePages: { include: { page: true } } } satisfies Prisma.RoleInclude;

const isKnownRequestError = (err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const DAY_MS = 24 * 60 * 60 * 1000;

// A real Argon2id hash of an arbitrary value — compared against on the "user not found" path
// so login takes the same time either way (no username-enumeration timing oracle). It will
// never match a real cmd.password.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$1AIiuCAamwZGb+oHS48Syw$N+CG6j1I2yhRQQRWPhvX5bUBfYcACNip2r6rQXyOE7g';

type LoginUser = {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  type: PrismaUserType;
  isEnabled: boolean;
  staff: Staff | null;
  client: Client | null;
};

export class IdentityService implements IIdentityService {
  constructor(private prisma: PrismaClient) {}

  async login(cmd: LoginCommand, ctx: RequestContext): Promise<LoginResultDto> {
    const user = await this.resolveLoginUser(cmd.username);

    if (!user || !user.isEnabled) {
      await comparePassword(cmd.password, DUMMY_PASSWORD_HASH);
      throw this.invalidCredentialsError();
    }

    const passwordValid = await comparePassword(cmd.password, user.passwordHash);
    if (!passwordValid) {
      throw this.invalidCredentialsError();
    }

    const { token: refreshToken, tokenHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION * DAY_MS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ...(ctx.userAgent != null ? { userAgent: ctx.userAgent } : {}),
          ...(ctx.ipAddress != null ? { ipAddress: ctx.ipAddress } : {}),
        },
      }),
    ]);

    const authType = IdentityMapper.toAuthType(user.type);
    const accessToken = generateToken(this.buildJwtPayload(user));
    const profile = this.buildLoginProfile(user);

    eventBus.emit('auth.loggedIn', {
      userId: user.id,
      authType,
      ...(ctx.ipAddress != null ? { ipAddress: ctx.ipAddress } : {}),
    });

    return LoginResultResponseSchema.parse({ authType, accessToken, refreshToken, profile });
  }

  async refresh(cmd: RefreshCommand, ctx: RequestContext): Promise<RefreshResultDto> {
    const tokenHash = hashRefreshToken(cmd.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) throw this.invalidCredentialsError();

    if (existing.revokedAt) {
      // Reuse of an already-revoked token: kill the whole chain for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw this.invalidCredentialsError();
    }

    if (existing.expiresAt < new Date()) {
      throw this.invalidCredentialsError();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
      include: { staff: true, client: true },
    });
    if (!user || !user.isEnabled) {
      throw this.invalidCredentialsError();
    }

    const { token: newToken, tokenHash: newTokenHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRATION * DAY_MS);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt,
          ...(ctx.userAgent != null ? { userAgent: ctx.userAgent } : {}),
          ...(ctx.ipAddress != null ? { ipAddress: ctx.ipAddress } : {}),
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: created.id },
      });
    });

    const accessToken = generateToken(this.buildJwtPayload(user));

    return RefreshResultResponseSchema.parse({ accessToken, refreshToken: newToken });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getEffectivePages(user: JWTPayload): Promise<string[]> {
    const type = user.type as PrismaUserType;

    if (type === PrismaUserType.ADMIN) {
      const allPageKeys = await this.getAllPageKeys();
      return IdentityMapper.effectivePages([], allPageKeys, type);
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: { role: { include: { rolePages: { include: { page: true } } } } },
    });
    return IdentityMapper.effectivePages(userRoles, [], type);
  }

  // --- Users ---
  async listUsers(query: UserListQuery): Promise<PaginatedResult<UserDto>> {
    // Identity's /admin/users only manages ADMIN/STAFF (CreateUserCommand can't express
    // CLIENT); an explicit `type: CLIENT` filter is out of this endpoint's domain -> empty.
    const typeFilter =
      query.type != null
        ? ([PrismaUserType.ADMIN, PrismaUserType.STAFF] as PrismaUserType[]).includes(query.type as PrismaUserType)
          ? [query.type as PrismaUserType]
          : []
        : [PrismaUserType.ADMIN, PrismaUserType.STAFF];

    const where: Prisma.UserWhereInput = {
      type: { in: typeFilter },
      ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { staff: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { staff: { lastName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: USER_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const allPageKeys = await this.getAllPageKeys();
    const items = users.map((user) => IdentityMapper.toUserDto(this.assertStaffLoaded(user), allPageKeys));

    return paginated(UserResponseSchema).parse({
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  }

  async getUser(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!user || user.type === PrismaUserType.CLIENT) throw new NotFoundError('User');

    const allPageKeys = await this.getAllPageKeys();
    return IdentityMapper.toUserDto(this.assertStaffLoaded(user), allPageKeys);
  }

  async createUser(cmd: CreateUserCommand, tx?: Prisma.TransactionClient): Promise<UserDto> {
    const client = tx ?? this.prisma;
    const passwordHash = await hashPassword(cmd.password);

    let created;
    try {
      created = await client.user.create({
        data: {
          username: cmd.username,
          ...(cmd.email != null ? { email: cmd.email } : {}),
          passwordHash,
          type: cmd.type as PrismaUserType,
          staff: {
            create: {
              firstName: cmd.profile.firstName,
              lastName: cmd.profile.lastName,
              ...(cmd.profile.phone != null ? { phone: cmd.profile.phone } : {}),
              ...(cmd.profile.jobTitle != null ? { jobTitle: cmd.profile.jobTitle } : {}),
            },
          },
          ...(cmd.roleIds?.length ? { userRoles: { create: cmd.roleIds.map((roleId) => ({ roleId })) } } : {}),
        },
        include: USER_INCLUDE,
      });
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Username or email already in use');
      throw err;
    }

    const allPageKeys = await this.getAllPageKeys();
    const dto = IdentityMapper.toUserDto(this.assertStaffLoaded(created), allPageKeys);

    // When `tx` is provided we're running inside another module's transaction (the injected-
    // service connection rule) — that caller owns commit timing and must emit `user.created`
    // itself once ITS transaction actually commits. We only emit when we own the write.
    if (!tx) {
      eventBus.emit('user.created', { user: dto });
    }

    return dto;
  }

  async updateUser(id: string, cmd: UpdateUserCommand): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!existing || existing.type === PrismaUserType.CLIENT) throw new NotFoundError('User');

    if (cmd.isEnabled === false && existing.isEnabled && existing.type === PrismaUserType.ADMIN) {
      const enabledAdminCount = await this.prisma.user.count({
        where: { type: PrismaUserType.ADMIN, isEnabled: true },
      });
      if (enabledAdminCount <= 1) throw new ConflictError('Cannot disable the last enabled admin');
    }

    const passwordHash = cmd.password !== undefined ? await hashPassword(cmd.password) : undefined;
    const rolesChanged = cmd.roleIds !== undefined;
    const shouldRevokeTokens = cmd.isEnabled === false || cmd.password !== undefined;

    const updateArgs = {
      where: { id },
      data: {
        ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(cmd.profile
          ? {
              staff: {
                update: {
                  ...(cmd.profile.firstName !== undefined ? { firstName: cmd.profile.firstName } : {}),
                  ...(cmd.profile.lastName !== undefined ? { lastName: cmd.profile.lastName } : {}),
                  ...(cmd.profile.phone !== undefined ? { phone: cmd.profile.phone } : {}),
                  ...(cmd.profile.jobTitle !== undefined ? { jobTitle: cmd.profile.jobTitle } : {}),
                },
              },
            }
          : {}),
        ...(rolesChanged
          ? { userRoles: { deleteMany: {}, create: (cmd.roleIds ?? []).map((roleId) => ({ roleId })) } }
          : {}),
      },
      include: USER_INCLUDE,
    };

    const updated = shouldRevokeTokens
      ? (
          await this.prisma.$transaction([
            this.prisma.user.update(updateArgs),
            this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
          ])
        )[0]
      : await this.prisma.user.update(updateArgs);

    const allPageKeys = await this.getAllPageKeys();
    const dto = IdentityMapper.toUserDto(this.assertStaffLoaded(updated), allPageKeys);

    eventBus.emit('user.updated', { user: dto });
    if (rolesChanged) {
      eventBus.emit('user.roleChanged', { userId: id, roleIds: cmd.roleIds ?? [] });
    }

    return dto;
  }

  async resetPassword(userId: string, newPassword: string, tx?: Prisma.TransactionClient): Promise<void> {
    const passwordHash = await hashPassword(newPassword);

    if (tx) {
      // Already inside the caller's transaction — no separate $transaction is possible (or
      // needed): both writes below already participate in the outer atomic unit.
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  // --- Roles & pages ---
  async listRoles(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({ include: ROLE_INCLUDE, orderBy: { name: 'asc' } });
    return roles.map((role) => IdentityMapper.toRoleDto(role));
  }

  async createRole(cmd: CreateRoleCommand): Promise<RoleDto> {
    try {
      const role = await this.prisma.role.create({
        data: { code: cmd.code, name: cmd.name, ...(cmd.description != null ? { description: cmd.description } : {}) },
        include: ROLE_INCLUDE,
      });
      return IdentityMapper.toRoleDto(role);
    } catch (err) {
      if (isKnownRequestError(err, 'P2002')) throw new ConflictError('Role code already in use');
      throw err;
    }
  }

  async updateRole(id: string, cmd: UpdateRoleCommand): Promise<RoleDto> {
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data: {
          ...(cmd.name !== undefined ? { name: cmd.name } : {}),
          ...(cmd.description !== undefined ? { description: cmd.description } : {}),
          ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        },
        include: ROLE_INCLUDE,
      });
      return IdentityMapper.toRoleDto(role);
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Role');
      throw err;
    }
  }

  async setRolePages(id: string, cmd: SetRolePagesCommand): Promise<RoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Role');

    const pages = await this.prisma.page.findMany({ where: { key: { in: cmd.pageKeys } } });
    const foundKeys = new Set(pages.map((page) => page.key));
    const unknownKeys = cmd.pageKeys.filter((key) => !foundKeys.has(key));
    const adminScopeKeys = pages.filter((page) => page.scope === PrismaPageScope.ADMIN).map((page) => page.key);

    if (unknownKeys.length > 0 || adminScopeKeys.length > 0) {
      throw new BadRequestError('role_pages accepts STAFF-scope pages only', { unknownKeys, adminScopeKeys });
    }

    await this.prisma.$transaction([
      this.prisma.rolePage.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePage.createMany({ data: pages.map((page) => ({ roleId: id, pageId: page.id })) }),
    ]);

    const updated = await this.prisma.role.findUniqueOrThrow({ where: { id }, include: ROLE_INCLUDE });
    return IdentityMapper.toRoleDto(updated);
  }

  async listPages(query: PagesQuery): Promise<PageDto[]> {
    const pages = await this.prisma.page.findMany({
      ...(query.scope !== undefined ? { where: { scope: query.scope as PrismaPageScope } } : {}),
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });
    return pages.map((page) => IdentityMapper.toPageDto(page));
  }

  // --- Technicians ---
  async listTechnicians(): Promise<TechnicianDto[]> {
    const technicians = await this.prisma.technician.findMany({ orderBy: { name: 'asc' } });
    return technicians.map((technician) => IdentityMapper.toTechnicianDto(technician));
  }

  async createTechnician(cmd: CreateTechnicianCommand): Promise<TechnicianDto> {
    const technician = await this.prisma.technician.create({
      data: { name: cmd.name, ...(cmd.phone != null ? { phone: cmd.phone } : {}) },
    });
    return IdentityMapper.toTechnicianDto(technician);
  }

  async updateTechnician(id: string, cmd: UpdateTechnicianCommand): Promise<TechnicianDto> {
    try {
      const technician = await this.prisma.technician.update({
        where: { id },
        data: {
          ...(cmd.name !== undefined ? { name: cmd.name } : {}),
          ...(cmd.phone !== undefined ? { phone: cmd.phone } : {}),
          ...(cmd.isEnabled !== undefined ? { isEnabled: cmd.isEnabled } : {}),
        },
      });
      return IdentityMapper.toTechnicianDto(technician);
    } catch (err) {
      if (isKnownRequestError(err, 'P2025')) throw new NotFoundError('Technician');
      throw err;
    }
  }

  private async getAllPageKeys(): Promise<string[]> {
    const pages = await this.prisma.page.findMany({ select: { key: true } });
    return pages.map((page) => page.key);
  }

  // ADMIN/STAFF rows always have a Staff profile (invariant enforced by createUser); narrows
  // Prisma's structurally-nullable `staff: Staff | null` for the mapper, which requires it
  // non-null. Throws loudly instead of silently mapping a broken row — this is a data-
  // integrity bug, not a normal runtime case.
  private assertStaffLoaded<T extends { id: string; type: PrismaUserType; staff: Staff | null }>(
    user: T,
  ): T & { staff: Staff } {
    if (!user.staff) throw new Error(`User ${user.id} (${user.type}) is missing its Staff profile`);
    return user as T & { staff: Staff };
  }

  private async resolveLoginUser(identifier: string): Promise<LoginUser | null> {
    const direct = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: { staff: true, client: true },
    });
    if (direct) return direct;

    const client = await this.prisma.client.findUnique({
      where: { phone: identifier },
      select: { userId: true },
    });
    if (!client?.userId) return null;

    return this.prisma.user.findUnique({
      where: { id: client.userId },
      include: { staff: true, client: true },
    });
  }

  private buildJwtPayload(user: LoginUser): JWTPayload {
    return {
      sub: user.id,
      type: user.type as ContractUserType,
      ...(user.client ? { clientId: user.client.id } : {}),
      ...(user.staff ? { staffId: user.staff.id } : {}),
    };
  }

  // Staff/admin always have a Staff row (invariant enforced by createUser — plan §3.6);
  // client accounts don't, and their profile shape belongs to the clients module, not identity.
  private buildLoginProfile(user: LoginUser): unknown {
    if (user.client) return undefined;
    if (user.staff) return IdentityMapper.toStaffProfileDto(user.staff);
    throw new Error(`User ${user.id} (${user.type}) has neither a staff nor a client profile`);
  }

  private invalidCredentialsError(): AppError {
    return new AppError(401, ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
  }

  private notImplemented(method: string): never {
    throw new Error(`IdentityService.${method}() is not implemented yet (see Sprint 4)`);
  }
}
