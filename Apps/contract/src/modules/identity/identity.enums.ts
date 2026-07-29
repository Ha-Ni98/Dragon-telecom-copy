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

// Seeded `Page` registry (STAFF-scope only — every key here is quoted verbatim as a
// `staff(KEY)` access annotation in a module contract). No `admin(PAGE_KEY)` gating
// pattern exists anywhere in Stage-00 (admin bypasses the page-key matrix entirely),
// so ADMIN-scope keys are intentionally not enumerated here; `Page.scope` in Prisma
// still supports ADMIN if a real requirement introduces one later.
export enum PageKey {
  STAFF_POS = 'STAFF_POS',
  STAFF_POS_CLIENTS = 'STAFF_POS_CLIENTS',
  STAFF_PRODUCTS = 'STAFF_PRODUCTS',
  STAFF_ORDERS = 'STAFF_ORDERS',
  STAFF_SALES = 'STAFF_SALES',
  STAFF_INVOICES = 'STAFF_INVOICES',
  STAFF_REPAIRS = 'STAFF_REPAIRS',
}

// Sidebar-section groupings for the PageKey members above — a display concern only,
// not read by any authorization rule.
export enum PageGroup {
  POS = 'POS',
  CATALOG = 'CATALOG',
  ORDERS = 'ORDERS',
  SALES = 'SALES',
  BILLING = 'BILLING',
  REPAIRS = 'REPAIRS',
}
