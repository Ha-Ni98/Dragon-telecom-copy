import {
  UserResponseSchema,
  RoleResponseSchema,
  PageResponseSchema,
  TechnicianResponseSchema,
  UserType,
  PageScope,
  PageKey,
  type UserDto,
  type RoleDto,
  type PageDto,
  type TechnicianDto,
  type PaginatedResult,
} from "@dragon-telecom/contract";

export const mockRole: RoleDto = RoleResponseSchema.parse({
  id: "40000000-0000-4000-8000-000000000001",
  code: "pos-operator",
  name: "POS Operator",
  description: "Front-desk sales access",
  isEnabled: true,
  pageKeys: [PageKey.STAFF_POS, PageKey.STAFF_POS_CLIENTS],
});

export const mockRoles: RoleDto[] = [mockRole];

// STAFF — roles/effectivePages populated (the common case).
export const mockStaffUser: UserDto = UserResponseSchema.parse({
  id: "40000000-0000-4000-8000-000000000002",
  username: "sara.haddad",
  email: "sara.haddad@dragon-telecom.dz",
  type: UserType.STAFF,
  isEnabled: true,
  lastLoginAt: "2026-07-19T08:00:00.000Z",
  profile: { firstName: "Sara", lastName: "Haddad", phone: "0555000111", jobTitle: "POS Operator" },
  roles: [mockRole],
  effectivePages: [PageKey.STAFF_POS, PageKey.STAFF_POS_CLIENTS],
});

// ADMIN — roles[]/effectivePages[] empty (spec: admin bypasses the page-key matrix entirely,
// no admin(PAGE_KEY) gating pattern exists) — and email/lastLoginAt/profile optionals absent.
export const mockAdminUser: UserDto = UserResponseSchema.parse({
  id: "40000000-0000-4000-8000-000000000003",
  username: "admin",
  type: UserType.ADMIN,
  isEnabled: true,
  profile: { firstName: "Root", lastName: "Admin" },
  roles: [],
  effectivePages: [],
});

export const mockUsersPaginated: PaginatedResult<UserDto> = {
  items: [mockStaffUser, mockAdminUser],
  meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

// The seeded Page registry is STAFF-scope only (contract's own PageKey comment) — no
// ADMIN-scope pages exist in this backend's current seed data.
export const mockPage: PageDto = PageResponseSchema.parse({
  key: PageKey.STAFF_POS,
  label: "Point of Sale",
  group: "POS",
  scope: PageScope.STAFF,
});

export const mockPages: PageDto[] = [mockPage];

export const mockTechnician: TechnicianDto = TechnicianResponseSchema.parse({
  id: "40000000-0000-4000-8000-000000000004",
  name: "Karim Bensaid",
  phone: "0555000222",
  isEnabled: true,
});

export const mockTechnicians: TechnicianDto[] = [mockTechnician];
