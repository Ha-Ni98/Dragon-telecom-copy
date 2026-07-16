import type { GetDeliveryCompaniesQuery } from "@your-app/contract";

// Central query-key registry. Hooks read keys from here — never inline arrays — so a
// mutation's invalidation list and a query's own key can't silently drift. Every domain
// exposes `all()`, the bare `[domain]` prefix: TanStack Query matches keys by prefix, so
// `invalidateQueries({ queryKey: qk.deliveryCompanies.all() })` sweeps every
// `['delivery-companies', ...]` entry at once.
//
// EXTENSION POINT (modules): add one key family per domain, mirroring `deliveryCompanies`.
export const qk = {
  auth: {
    all: () => ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },
  deliveryCompanies: {
    all: () => ["delivery-companies"] as const,
    list: (query: GetDeliveryCompaniesQuery) => ["delivery-companies", "list", query] as const,
  },
} as const;
