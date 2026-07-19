import { describe, it, expect } from 'vitest';
import { UserType as PrismaUserType, PageScope as PrismaPageScope } from '@prisma/client';
import type { Page, Role, RolePage, Staff, Technician, User, UserRole } from '@prisma/client';
import { AuthType, PageScope as ContractPageScope, UserType as ContractUserType } from '@dragon-telecom/contract';
import { IdentityMapper } from '../../../../src/modules/identity/identity.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_A_ID = '44444444-4444-4444-8444-444444444444';
const ROLE_B_ID = '55555555-5555-4555-8555-555555555555';
const TECH_ID = '66666666-6666-4666-8666-666666666666';

const buildPage = (overrides: Partial<Page> = {}): Page => ({
  id: 'page-1',
  key: 'STAFF_POS',
  label: 'POS',
  group: 'POS',
  scope: PrismaPageScope.STAFF,
  ...overrides,
});

const buildRole = (
  overrides: Partial<Role> & { rolePages?: (RolePage & { page: Page })[] } = {},
): Role & { rolePages: (RolePage & { page: Page })[] } => ({
  id: ROLE_ID,
  code: 'ROLE_1',
  name: 'Role One',
  description: null,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  rolePages: [],
  ...overrides,
});

const buildUserRole = (
  roleOverrides: Partial<Role> & { rolePages?: (RolePage & { page: Page })[] } = {},
): UserRole & { role: Role & { rolePages: (RolePage & { page: Page })[] } } => {
  const role = buildRole(roleOverrides);
  return { userId: USER_ID, roleId: role.id, assignedAt: now, role };
};

const buildStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: STAFF_ID,
  userId: USER_ID,
  firstName: 'John',
  lastName: 'Doe',
  phone: null,
  jobTitle: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildUser = (
  overrides: Partial<User> & {
    staff?: Staff;
    userRoles?: (UserRole & { role: Role & { rolePages: (RolePage & { page: Page })[] } })[];
  } = {},
): User & {
  staff: Staff;
  userRoles: (UserRole & { role: Role & { rolePages: (RolePage & { page: Page })[] } })[];
} => ({
  id: USER_ID,
  username: 'johndoe',
  email: 'john@example.com',
  passwordHash: 'super-secret-hash',
  type: PrismaUserType.STAFF,
  isEnabled: true,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
  staff: buildStaff(),
  userRoles: [],
  ...overrides,
});

const buildTechnician = (overrides: Partial<Technician> = {}): Technician => ({
  id: TECH_ID,
  name: 'Repair Tech',
  phone: null,
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('IdentityMapper', () => {
  describe('toUserDto', () => {
    it('excludes passwordHash and internal timestamps', () => {
      const dto = IdentityMapper.toUserDto(buildUser(), []);
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
    });

    it('converts a set lastLoginAt from Date to an ISO string', () => {
      const loginDate = new Date('2026-02-15T08:30:00.000Z');
      const dto = IdentityMapper.toUserDto(buildUser({ lastLoginAt: loginDate }), []);
      expect(dto.lastLoginAt).toBe(loginDate.toISOString());
    });

    it('omits lastLoginAt entirely when null', () => {
      const dto = IdentityMapper.toUserDto(buildUser({ lastLoginAt: null }), []);
      expect(dto.lastLoginAt).toBeUndefined();
      expect('lastLoginAt' in dto).toBe(false);
    });

    it('maps the Prisma UserType onto the contract UserType', () => {
      const dto = IdentityMapper.toUserDto(buildUser({ type: PrismaUserType.ADMIN }), []);
      expect(dto.type).toBe(ContractUserType.ADMIN);
    });

    it('effectivePages: STAFF unions pages from enabled roles only', () => {
      const enabledRole = buildUserRole({
        id: ROLE_A_ID,
        rolePages: [{ roleId: 'role-a', pageId: 'p1', page: buildPage({ key: 'STAFF_POS' }) }],
      });
      const disabledRole = buildUserRole({
        id: ROLE_B_ID,
        isEnabled: false,
        rolePages: [{ roleId: 'role-b', pageId: 'p2', page: buildPage({ key: 'STAFF_SALES' }) }],
      });
      const dto = IdentityMapper.toUserDto(
        buildUser({ type: PrismaUserType.STAFF, userRoles: [enabledRole, disabledRole] }),
        [],
      );
      expect(dto.effectivePages).toEqual(['STAFF_POS']);
    });

    it('effectivePages: de-duplicates pages shared by multiple enabled roles', () => {
      const roleA = buildUserRole({
        id: ROLE_A_ID,
        rolePages: [{ roleId: 'role-a', pageId: 'p1', page: buildPage({ key: 'STAFF_POS' }) }],
      });
      const roleB = buildUserRole({
        id: ROLE_B_ID,
        rolePages: [{ roleId: 'role-b', pageId: 'p1', page: buildPage({ key: 'STAFF_POS' }) }],
      });
      const dto = IdentityMapper.toUserDto(buildUser({ userRoles: [roleA, roleB] }), []);
      expect(dto.effectivePages).toEqual(['STAFF_POS']);
    });

    it('effectivePages: ADMIN ignores the role matrix and gets every page key', () => {
      const allPageKeys = ['STAFF_POS', 'STAFF_SALES', 'STAFF_PRODUCTS'];
      const dto = IdentityMapper.toUserDto(buildUser({ type: PrismaUserType.ADMIN, userRoles: [] }), allPageKeys);
      expect(dto.effectivePages).toEqual(allPageKeys);
    });

    it('roles carries every assigned role regardless of isEnabled, each with its own pageKeys', () => {
      const enabledRole = buildUserRole({
        id: ROLE_A_ID,
        rolePages: [{ roleId: 'role-a', pageId: 'p1', page: buildPage({ key: 'STAFF_POS' }) }],
      });
      const disabledRole = buildUserRole({
        id: ROLE_B_ID,
        isEnabled: false,
        rolePages: [{ roleId: 'role-b', pageId: 'p2', page: buildPage({ key: 'STAFF_SALES' }) }],
      });
      const dto = IdentityMapper.toUserDto(buildUser({ userRoles: [enabledRole, disabledRole] }), []);
      expect(dto.roles).toHaveLength(2);
      expect(dto.roles.find((r) => r.id === ROLE_A_ID)?.pageKeys).toEqual(['STAFF_POS']);
      expect(dto.roles.find((r) => r.id === ROLE_B_ID)?.pageKeys).toEqual(['STAFF_SALES']);
      expect(dto.roles.find((r) => r.id === ROLE_B_ID)?.isEnabled).toBe(false);
    });

    it('maps the staff profile into the required profile field', () => {
      const dto = IdentityMapper.toUserDto(buildUser({ staff: buildStaff({ jobTitle: 'Cashier' }) }), []);
      expect(dto.profile).toEqual({ firstName: 'John', lastName: 'Doe', jobTitle: 'Cashier' });
    });
  });

  describe('toStaffProfileDto', () => {
    it('excludes id/userId/timestamps', () => {
      const dto = IdentityMapper.toStaffProfileDto(buildStaff());
      expect(dto).not.toHaveProperty('id');
      expect(dto).not.toHaveProperty('userId');
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
    });

    it('omits phone/jobTitle when null', () => {
      const dto = IdentityMapper.toStaffProfileDto(buildStaff({ phone: null, jobTitle: null }));
      expect('phone' in dto).toBe(false);
      expect('jobTitle' in dto).toBe(false);
    });

    it('includes phone/jobTitle when set', () => {
      const dto = IdentityMapper.toStaffProfileDto(buildStaff({ phone: '0555000000', jobTitle: 'Manager' }));
      expect(dto.phone).toBe('0555000000');
      expect(dto.jobTitle).toBe('Manager');
    });
  });

  describe('toRoleDto', () => {
    it('maps pageKeys from rolePages', () => {
      const role = buildRole({
        rolePages: [
          { roleId: 'role-1', pageId: 'p1', page: buildPage({ key: 'STAFF_POS' }) },
          { roleId: 'role-1', pageId: 'p2', page: buildPage({ key: 'STAFF_SALES' }) },
        ],
      });
      const dto = IdentityMapper.toRoleDto(role);
      expect(dto.pageKeys).toEqual(['STAFF_POS', 'STAFF_SALES']);
    });

    it('excludes timestamps and omits description when null', () => {
      const dto = IdentityMapper.toRoleDto(buildRole({ description: null }));
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
      expect('description' in dto).toBe(false);
    });
  });

  describe('toPageDto', () => {
    it('maps the Prisma PageScope onto the contract PageScope and excludes id', () => {
      const dto = IdentityMapper.toPageDto(buildPage({ scope: PrismaPageScope.STAFF }));
      expect(dto.scope).toBe(ContractPageScope.STAFF);
      expect(dto).not.toHaveProperty('id');
    });
  });

  describe('toTechnicianDto', () => {
    it('excludes timestamps and omits phone when null', () => {
      const dto = IdentityMapper.toTechnicianDto(buildTechnician({ phone: null }));
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
      expect('phone' in dto).toBe(false);
    });

    it('includes phone when set', () => {
      const dto = IdentityMapper.toTechnicianDto(buildTechnician({ phone: '0555111111' }));
      expect(dto.phone).toBe('0555111111');
    });
  });

  describe('toAuthType', () => {
    it('maps every UserType to its AuthType', () => {
      expect(IdentityMapper.toAuthType(PrismaUserType.ADMIN)).toBe(AuthType.ADMIN);
      expect(IdentityMapper.toAuthType(PrismaUserType.STAFF)).toBe(AuthType.STAFF);
      expect(IdentityMapper.toAuthType(PrismaUserType.CLIENT)).toBe(AuthType.CLIENT);
    });
  });
});
