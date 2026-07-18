import type { Page, Role, RolePage, Staff, Technician, User, UserRole } from '@prisma/client';
import { UserType as PrismaUserType } from '@prisma/client';
import {
  AuthType,
  PageResponseSchema,
  RoleResponseSchema,
  StaffProfileResponseSchema,
  TechnicianResponseSchema,
  UserResponseSchema,
  type PageDto,
  type PageScope as ContractPageScope,
  type RoleDto,
  type StaffProfileDto,
  type TechnicianDto,
  type UserDto,
  type UserType as ContractUserType,
} from '@dragon-telecom/contract';

type RoleWithPages = Role & { rolePages: (RolePage & { page: Page })[] };
type UserRoleWithRole = UserRole & { role: RoleWithPages };
// `staff` is required here, not `Staff | null` as Prisma's schema allows: both ADMIN and
// STAFF users always get a Staff row (see plan-identity.md §3.6); the service is responsible
// for only ever handing this mapper a user that satisfies that invariant.
type UserWithRelations = User & { staff: Staff; userRoles: UserRoleWithRole[] };

export class IdentityMapper {
  static toUserDto(user: UserWithRelations, allPageKeys: string[]): UserDto {
    const dto: UserDto = {
      id: user.id,
      username: user.username,
      ...(user.email != null ? { email: user.email } : {}),
      type: user.type as ContractUserType,
      isEnabled: user.isEnabled,
      ...(user.lastLoginAt != null ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
      profile: IdentityMapper.toStaffProfileDto(user.staff),
      roles: user.userRoles.map((userRole) => IdentityMapper.toRoleDto(userRole.role)),
      effectivePages: IdentityMapper.effectivePages(user.userRoles, allPageKeys, user.type),
    };
    return UserResponseSchema.parse(dto);
  }

  static toStaffProfileDto(staff: Staff): StaffProfileDto {
    const dto: StaffProfileDto = {
      firstName: staff.firstName,
      lastName: staff.lastName,
      ...(staff.phone != null ? { phone: staff.phone } : {}),
      ...(staff.jobTitle != null ? { jobTitle: staff.jobTitle } : {}),
    };
    return StaffProfileResponseSchema.parse(dto);
  }

  static toRoleDto(role: RoleWithPages): RoleDto {
    const dto: RoleDto = {
      id: role.id,
      code: role.code,
      name: role.name,
      ...(role.description != null ? { description: role.description } : {}),
      isEnabled: role.isEnabled,
      pageKeys: role.rolePages.map((rolePage) => rolePage.page.key),
    };
    return RoleResponseSchema.parse(dto);
  }

  static toPageDto(page: Page): PageDto {
    const dto: PageDto = {
      key: page.key,
      label: page.label,
      group: page.group,
      scope: page.scope as ContractPageScope,
    };
    return PageResponseSchema.parse(dto);
  }

  static toTechnicianDto(technician: Technician): TechnicianDto {
    const dto: TechnicianDto = {
      id: technician.id,
      name: technician.name,
      ...(technician.phone != null ? { phone: technician.phone } : {}),
      isEnabled: technician.isEnabled,
    };
    return TechnicianResponseSchema.parse(dto);
  }

  static toAuthType(type: PrismaUserType): AuthType {
    switch (type) {
      case PrismaUserType.ADMIN:
        return AuthType.ADMIN;
      case PrismaUserType.STAFF:
        return AuthType.STAFF;
      case PrismaUserType.CLIENT:
        return AuthType.CLIENT;
    }
  }

  // Public: the service's getEffectivePages (GET /me/permissions) calls this directly without
  // building a full UserDto. ADMIN ignores the role matrix entirely (the caller supplies every
  // known page key); STAFF/CLIENT get the union of their *enabled* roles' pages, deduplicated.
  static effectivePages(userRoles: UserRoleWithRole[], allPageKeys: string[], type: PrismaUserType): string[] {
    if (type === PrismaUserType.ADMIN) return allPageKeys;

    const keys = new Set<string>();
    for (const userRole of userRoles) {
      if (!userRole.role.isEnabled) continue;
      for (const rolePage of userRole.role.rolePages) {
        keys.add(rolePage.page.key);
      }
    }
    return [...keys];
  }
}
