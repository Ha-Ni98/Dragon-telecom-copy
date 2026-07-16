// EXTENSION POINT (realtime): one namespace per audience your app pushes to.
export const NS = {
  USERS: '/users',
  ADMIN: '/admin',
} as const;

// EXTENSION POINT (realtime): one room helper per subscription target.
export const rooms = {
  user: (userId: string) => `user:${userId}`,
} as const;
