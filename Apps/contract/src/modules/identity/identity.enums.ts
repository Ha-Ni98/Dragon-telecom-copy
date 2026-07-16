export enum UserType {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CLIENT = 'CLIENT',
}

export enum PageScope {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

// Login-result discriminator — the spec gives these lowercase, distinct from
// JWTPayload.type (UserType, uppercase); kept as its own enum to preserve
// the literal values without a magic string.
export enum AuthType {
  CLIENT = 'client',
  STAFF = 'staff',
  ADMIN = 'admin',
}
