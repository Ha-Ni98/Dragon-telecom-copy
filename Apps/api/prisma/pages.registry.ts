import { PageGroup, PageKey, PageScope } from '@dragon-telecom/contract';

export type PageSeed = { key: PageKey; label: string; group: PageGroup; scope: PageScope };

// The canonical `Page` registry — STAFF-scope only (see plan-identity.md §7.1). Every
// key/group comes from the contract's PageKey/PageGroup enums, never a literal string.
// Shared by prisma/seed.ts and test/data/page.factory.ts so both stay in sync.
export const PAGES_REGISTRY: PageSeed[] = [
  { key: PageKey.STAFF_POS, label: 'POS', group: PageGroup.POS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_POS_CLIENTS, label: 'POS Clients', group: PageGroup.POS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_PRODUCTS, label: 'Products', group: PageGroup.CATALOG, scope: PageScope.STAFF },
  { key: PageKey.STAFF_ORDERS, label: 'Orders', group: PageGroup.ORDERS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_SALES, label: 'Sales', group: PageGroup.SALES, scope: PageScope.STAFF },
  { key: PageKey.STAFF_INVOICES, label: 'Invoices', group: PageGroup.BILLING, scope: PageScope.STAFF },
  { key: PageKey.STAFF_REPAIRS, label: 'Repairs', group: PageGroup.REPAIRS, scope: PageScope.STAFF },
];
