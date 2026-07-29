import { generateToken } from '../../src/common/utils/token.utils';
import { createUser, type UserFactoryInput } from '../data/user.factory';

export const mintAuthToken = (
  overrides: Partial<UserFactoryInput> = {},
): { token: string; user: UserFactoryInput } => {
  const user = createUser(overrides);
  const token = generateToken({ sub: user.id, type: user.type });
  return { token, user };
};
