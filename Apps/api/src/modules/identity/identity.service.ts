import type { Client, PrismaClient, Staff } from '@prisma/client';
import { UserType as PrismaUserType } from '@prisma/client';
import {
  ErrorCode,
  LoginResultResponseSchema,
  RefreshResultResponseSchema,
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
import { AppError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { comparePassword } from '@common/utils/password.utils';
import { generateToken } from '@common/utils/token.utils';
import { generateRefreshToken, hashRefreshToken } from '@common/utils/refresh-token.utils';
import { env } from '../../env';
import type { IIdentityService, RequestContext } from './identity.interface';
import { IdentityMapper } from './identity.mapper';

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
      const pages = await this.prisma.page.findMany({ select: { key: true } });
      return IdentityMapper.effectivePages([], pages.map((page) => page.key), type);
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: { role: { include: { rolePages: { include: { page: true } } } } },
    });
    return IdentityMapper.effectivePages(userRoles, [], type);
  }

  // --- Users (Sprint 4) ---
  async listUsers(_query: UserListQuery): Promise<PaginatedResult<UserDto>> {
    return this.notImplemented('listUsers');
  }
  async getUser(_id: string): Promise<UserDto> {
    return this.notImplemented('getUser');
  }
  async createUser(_cmd: CreateUserCommand): Promise<UserDto> {
    return this.notImplemented('createUser');
  }
  async updateUser(_id: string, _cmd: UpdateUserCommand): Promise<UserDto> {
    return this.notImplemented('updateUser');
  }
  async resetPassword(_userId: string, _newPassword: string): Promise<void> {
    return this.notImplemented('resetPassword');
  }

  // --- Roles & pages (Sprint 4) ---
  async listRoles(): Promise<RoleDto[]> {
    return this.notImplemented('listRoles');
  }
  async createRole(_cmd: CreateRoleCommand): Promise<RoleDto> {
    return this.notImplemented('createRole');
  }
  async updateRole(_id: string, _cmd: UpdateRoleCommand): Promise<RoleDto> {
    return this.notImplemented('updateRole');
  }
  async setRolePages(_id: string, _cmd: SetRolePagesCommand): Promise<RoleDto> {
    return this.notImplemented('setRolePages');
  }
  async listPages(_query: PagesQuery): Promise<PageDto[]> {
    return this.notImplemented('listPages');
  }

  // --- Technicians (Sprint 4) ---
  async listTechnicians(): Promise<TechnicianDto[]> {
    return this.notImplemented('listTechnicians');
  }
  async createTechnician(_cmd: CreateTechnicianCommand): Promise<TechnicianDto> {
    return this.notImplemented('createTechnician');
  }
  async updateTechnician(_id: string, _cmd: UpdateTechnicianCommand): Promise<TechnicianDto> {
    return this.notImplemented('updateTechnician');
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
