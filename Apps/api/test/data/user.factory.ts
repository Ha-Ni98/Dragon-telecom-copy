import { faker } from '@faker-js/faker';
import { UserType } from '@dragon-telecom/contract';

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
