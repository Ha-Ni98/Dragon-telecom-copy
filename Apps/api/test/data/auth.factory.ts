import { faker } from '@faker-js/faker';
import { UserRole } from '@your-app/contract';
import { hashPassword } from '@common/utils/password.utils';
import type { PrismaClient } from '@prisma/client';

export const SEED_PASSWORD = 'Password123!';

export interface SeededUser {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

// Persists a User with an argon2-hashed password for integration tests.
export const seedUser = async (
  prisma: PrismaClient,
  overrides: { role?: UserRole; username?: string; isEnabled?: boolean } = {},
): Promise<SeededUser> => {
  const username = overrides.username ?? faker.internet.username();
  const role = overrides.role ?? UserRole.ADMIN;
  const hashed = await hashPassword(SEED_PASSWORD);

  const user = await prisma.user.create({
    data: {
      username,
      fullName: faker.person.fullName(),
      password: hashed,
      role,
      isEnabled: overrides.isEnabled ?? true,
    },
  });

  return { id: user.id, username, password: SEED_PASSWORD, role };
};
