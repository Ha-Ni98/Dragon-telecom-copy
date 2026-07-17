import { faker } from '@faker-js/faker';
import { CreateUserSchema, UserType, type CreateUserCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import { hashPassword } from '../../src/common/utils/password.utils';

// No single contract type fits an "insertable" internal user: UserDto strips
// credentials by design, and CreateUserCommand is admin-only (ADMIN/STAFF, with
// profile/roleIds). This is a self-contained shape for Sub-01 infra tests
// (auth.fixture, auth.middleware) — modules add their own factories in Sub-02.
export type UserFactoryInput = {
  id: string;
  username: string;
  email?: string;
  password: string;
  type: UserType;
  isEnabled: boolean;
};

export const createUser = (overrides: Partial<UserFactoryInput> = {}): UserFactoryInput => ({
  id: faker.string.uuid(),
  username: faker.internet.username(),
  email: faker.internet.email(),
  password: 'Password123!',
  type: UserType.STAFF,
  isEnabled: true,
  ...overrides,
});

// CreateUserSchema.refine() enforces roleIds required-non-empty iff STAFF, forbidden iff
// ADMIN — resolve `type` first so the default roleIds matches whichever type wins.
export const createUserPayload = (overrides: Partial<CreateUserCommand> = {}): CreateUserCommand => {
  const type = overrides.type ?? UserType.STAFF;
  return CreateUserSchema.parse({
    username: faker.internet.username(),
    email: faker.internet.email(),
    password: 'Password123!',
    type,
    profile: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
    roleIds: type === UserType.STAFF ? [faker.string.uuid()] : undefined,
    ...overrides,
  });
};

export type SeedUserOptions = {
  username?: string;
  email?: string;
  password?: string;
  type?: typeof UserType.ADMIN | typeof UserType.STAFF;
  isEnabled?: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  roleIds?: string[];
};

// Persists a real User + Staff row (ADMIN/STAFF only — every such user gets a Staff
// profile per plan-identity.md §3.6) with a real Argon2id hash, for login/integration tests.
export const seedUser = async (options: SeedUserOptions = {}) => {
  const plainPassword = options.password ?? 'Password123!';
  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.user.create({
    data: {
      username: options.username ?? faker.internet.username(),
      email: options.email ?? faker.internet.email(),
      passwordHash,
      type: options.type ?? UserType.STAFF,
      isEnabled: options.isEnabled ?? true,
      staff: {
        create: {
          firstName: options.firstName ?? faker.person.firstName(),
          lastName: options.lastName ?? faker.person.lastName(),
          ...(options.phone != null ? { phone: options.phone } : {}),
          ...(options.jobTitle != null ? { jobTitle: options.jobTitle } : {}),
        },
      },
      ...(options.roleIds?.length
        ? { userRoles: { create: options.roleIds.map((roleId) => ({ roleId })) } }
        : {}),
    },
    include: { staff: true },
  });

  return { user, plainPassword };
};
