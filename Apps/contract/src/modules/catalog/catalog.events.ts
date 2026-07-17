// Only product.searched's payload is spelled out in the spec. The other three are named
// without a field list; modelled as minimal narration-friendly payloads (audit only ever
// renders a narrated string from them — see observability module conventions).
export type CatalogEvents = {
  'product.created': { productId: string; name: string };
  'product.repriced': { productId: string; name: string };
  'taxonomy.changed': { entityType: string; entityId: string; description: string };
  'clientCategory.changed': { categoryId: string; description: string };
  'product.searched': { userId: string; query: string; matchedProductId?: string };
};
