import { faker } from '@faker-js/faker';
import { prisma } from '../../src/common/db/prisma';
import { generateRefreshToken } from '../../src/common/utils/refresh-token.utils';

export type SeedRefreshTokenOptions = {
  userId: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
  replacedByTokenId?: string;
  userAgent?: string;
  ipAddress?: string;
};

// Persists a real RefreshToken row and returns the matching raw token alongside it, so
// integration tests can exercise rotation/reuse/chain-kill against the actual hash lookup.
export const seedRefreshToken = async (options: SeedRefreshTokenOptions) => {
  const { token, tokenHash } = generateRefreshToken();
  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId: options.userId,
      tokenHash,
      expiresAt: options.expiresAt ?? faker.date.future(),
      revokedAt: options.revokedAt ?? null,
      ...(options.replacedByTokenId != null ? { replacedByTokenId: options.replacedByTokenId } : {}),
      ...(options.userAgent != null ? { userAgent: options.userAgent } : {}),
      ...(options.ipAddress != null ? { ipAddress: options.ipAddress } : {}),
    },
  });
  return { token, refreshToken };
};
