import type { LoginCommand } from '@dragon-telecom/contract';

export const createLoginPayload = (overrides: Partial<LoginCommand> = {}): LoginCommand => ({
  username: 'johndoe',
  password: 'Password123!',
  ...overrides,
});
