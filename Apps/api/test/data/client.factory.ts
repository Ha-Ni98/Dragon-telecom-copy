import { faker } from '@faker-js/faker';
import { UserType } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import { hashPassword } from '../../src/common/utils/password.utils';

export type SeedClientUserOptions = {
  wilayaId: string;
  communeId: string;
  posClientId?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

// Minimal, self-contained CLIENT-type User + Client for this module's own integration tests
// (price resolution needs a real CLIENT viewer). The clients module (not yet built) will own
// the real registration/approval flow — this factory does not attempt to model it.
export const seedClientUser = async (options: SeedClientUserOptions) => {
  const passwordHash = await hashPassword('Password123!');

  const user = await prisma.user.create({
    data: {
      username: faker.internet.username(),
      email: faker.internet.email(),
      passwordHash,
      type: UserType.CLIENT,
      isEnabled: true,
    },
  });

  const client = await prisma.client.create({
    data: {
      userId: user.id,
      code: `CLI-${faker.string.alphanumeric(8).toUpperCase()}`,
      firstName: options.firstName ?? faker.person.firstName(),
      lastName: options.lastName ?? faker.person.lastName(),
      phone: options.phone ?? faker.string.numeric(10),
      wilayaId: options.wilayaId,
      communeId: options.communeId,
      status: 'APPROVED',
      ...(options.posClientId != null ? { posClientId: options.posClientId } : {}),
      isEnabled: true,
    },
  });

  return { user, client };
};
