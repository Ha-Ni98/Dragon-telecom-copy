import { DocType } from '@dragon-telecom/contract';

// One row per DocType — every prefix/nextSequence key SequenceService.nextNumber may read.
export const DEFAULT_INVOICING_PREFIXES: Record<DocType, string> = {
  [DocType.INVOICE]: 'FAC',
  [DocType.SALE]: 'SAL',
  [DocType.ORDER]: 'ORD',
  [DocType.REPAIR]: 'REP',
  [DocType.SUPPLIER_INVOICE]: 'SUP',
  [DocType.ADJUSTMENT]: 'ADJ',
  [DocType.POS_CLIENT]: 'POS',
  [DocType.CLIENT]: 'CLI',
};

export const DEFAULT_NEXT_SEQUENCES: Record<DocType, number> = Object.fromEntries(
  Object.values(DocType).map((docType) => [docType, 1]),
) as Record<DocType, number>;

// Shared by prisma/seed.ts (what actually gets persisted for a fresh DB) and
// platform.mapper.ts (the merge-over-defaults fallback when a Setting row is entirely
// missing) — see plan-platform.md §1.2. Keyed by the SettingsDto section name (Setting.key
// mirrors the DTO key).
export const DEFAULT_SETTINGS = {
  store: { name: 'Dragon Telecom' },
  invoicing: { prefixes: DEFAULT_INVOICING_PREFIXES, nextSequences: DEFAULT_NEXT_SEQUENCES },
  delivery: { defaultHome: 500, defaultOffice: 300 },
  storefront: { featuredProductIds: [] as string[] },
};
