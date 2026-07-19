// Central query-key registry. Hooks read keys from here — never inline arrays — so a
// mutation's invalidation list and a query's own key can't silently drift. Every domain
// exposes `all()`, the bare `[domain]` prefix: TanStack Query matches keys by prefix, so
// `invalidateQueries({ queryKey: qk.someDomain.all() })` sweeps every `['some-domain', ...]`
// entry at once.
//
// EXTENSION POINT (modules): add one key family per domain as it's wired (Sub-02).
export const qk = {
  auth: {
    all: () => ["auth"] as const,
    // No server "who am I" endpoint — this key just caches the locally-derived Session
    // (see hooks/useSession.ts, types/session.ts) in TanStack Query so every consumer
    // reads the same value instead of re-decoding the JWT on every render.
    session: () => ["auth", "session"] as const,
  },
  catalog: {
    all: () => ["catalog"] as const,
    products: () => ["catalog", "products"] as const,
    featuredProducts: (limit: number) => ["catalog", "products", "featured", limit] as const,
    productByName: (name: string) => ["catalog", "products", "by-name", name] as const,
    productById: (id: number) => ["catalog", "products", "by-id", id] as const,
    relatedProducts: (id: number, limit: number) => ["catalog", "products", "related", id, limit] as const,
    productSearch: (query: string) => ["catalog", "products", "search", query] as const,
    brands: () => ["catalog", "brands"] as const,
    families: () => ["catalog", "families"] as const,
    models: () => ["catalog", "models"] as const,
    adminProducts: {
      all: () => ["catalog", "admin-products"] as const,
      list: (filters?: unknown) => ["catalog", "admin-products", "list", filters] as const,
      stats: () => ["catalog", "admin-products", "stats"] as const,
      detail: (id: number) => ["catalog", "admin-products", "detail", id] as const,
      byStatus: (status: string) => ["catalog", "admin-products", "by-status", status] as const,
      search: (query: string, filters?: unknown) =>
        ["catalog", "admin-products", "search", query, filters] as const,
    },
  },
  clients: {
    all: () => ["clients"] as const,
    myAccount: () => ["clients", "my-account"] as const,
  },
  orders: {
    all: () => ["orders"] as const,
    mine: () => ["orders", "mine"] as const,
    adminList: (query: unknown) => ["orders", "admin-list", query] as const,
    adminStats: () => ["orders", "admin-stats"] as const,
  },
} as const;
