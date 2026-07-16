import type { UserRole } from '@your-app/contract';
import { generateToken } from '../../src/common/utils/token.utils';

export const mintToken = (payload: { id: string; role: UserRole }): string =>
  generateToken(payload);
