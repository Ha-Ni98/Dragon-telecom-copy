// Central query-key registry. Hooks read keys from here — never inline arrays — so a
// mutation's invalidation list and a query's own key can't silently drift. Every domain
// exposes `all()`, the bare `[domain]` prefix: TanStack Query matches keys by prefix, so
// `invalidateQueries({ queryKey: qk.someDomain.all() })` sweeps every `['some-domain', ...]`
// entry at once.
//
// All ids are UUID `string` (contract-native) — Sub-01's numeric-id stub shapes are retyped
// domain-by-domain as each service/hook pair is rewired (integration plan.md §0.1 C6).
// List keys embed the filter/query object so distinct filters cache independently; `scope`
// params (present on several STAFF_*/ADMIN_* dual-mounted route pairs) are threaded the same
// way. See plan.md §3 for the full registry design and the cross-domain invalidation matrix
// mutation hooks must honor (e.g. an order confirm sweeps inventory + billing + client credit,
// not just its own `orders.*` keys).
export const qk = {
  auth: {
    all: () => ["auth"] as const,
    // No server "who am I" endpoint — this key just caches the locally-derived Session
    // (see hooks/useSession.ts, types/session.ts) in TanStack Query so every consumer
    // reads the same value instead of re-decoding the JWT on every render.
    session: () => ["auth", "session"] as const,
    permissions: () => ["auth", "permissions"] as const,
  },
  identity: {
    all: () => ["identity"] as const,
    users: {
      all: () => ["identity", "users"] as const,
      list: (query?: unknown) => ["identity", "users", "list", query] as const,
      detail: (id: string) => ["identity", "users", "detail", id] as const,
    },
    roles: {
      all: () => ["identity", "roles"] as const,
    },
    pages: (query?: unknown) => ["identity", "pages", query] as const,
    technicians: {
      all: () => ["identity", "technicians"] as const,
    },
  },
  catalog: {
    all: () => ["catalog"] as const,
    products: {
      all: () => ["catalog", "products"] as const,
      list: (query?: unknown) => ["catalog", "products", "list", query] as const,
      detail: (id: string) => ["catalog", "products", "detail", id] as const,
    },
    staffProducts: {
      list: (query?: unknown) => ["catalog", "staff-products", "list", query] as const,
    },
    adminProducts: {
      all: () => ["catalog", "admin-products"] as const,
      list: (query?: unknown) => ["catalog", "admin-products", "list", query] as const,
      detail: (id: string) => ["catalog", "admin-products", "detail", id] as const,
    },
    productStats: () => ["catalog", "product-stats"] as const,
    brands: (admin?: boolean) => ["catalog", "brands", admin ?? false] as const,
    families: (query?: unknown) => ["catalog", "families", query] as const,
    models: (query?: unknown) => ["catalog", "models", query] as const,
    categories: () => ["catalog", "categories"] as const,
  },
  clients: {
    all: () => ["clients"] as const,
    me: () => ["clients", "me"] as const,
    cart: () => ["clients", "cart"] as const,
    admin: {
      all: () => ["clients", "admin"] as const,
      list: (query?: unknown) => ["clients", "admin", "list", query] as const,
      stats: () => ["clients", "admin", "stats"] as const,
      detail: (id: string) => ["clients", "admin", "detail", id] as const,
    },
  },
  posClients: {
    all: () => ["pos-clients"] as const,
    list: (query?: unknown) => ["pos-clients", "list", query] as const,
    search: (query: string) => ["pos-clients", "search", query] as const,
    detail: (id: string) => ["pos-clients", "detail", id] as const,
  },
  inventory: {
    all: () => ["inventory"] as const,
    stock: (query?: unknown) => ["inventory", "stock", query] as const,
    movements: {
      list: (query?: unknown) => ["inventory", "movements", "list", query] as const,
    },
    reservations: {
      list: (query?: unknown) => ["inventory", "reservations", "list", query] as const,
    },
  },
  platform: {
    all: () => ["platform"] as const,
    wilayas: () => ["platform", "wilayas"] as const,
    fee: (query?: unknown) => ["platform", "fee", query] as const,
    adminFees: () => ["platform", "admin-fees"] as const,
    settings: () => ["platform", "settings"] as const,
    publicSettings: () => ["platform", "public-settings"] as const,
  },
  orders: {
    all: () => ["orders"] as const,
    mine: (query?: unknown) => ["orders", "mine", query] as const,
    admin: {
      list: (query?: unknown) => ["orders", "admin", "list", query] as const,
      detail: (id: string) => ["orders", "admin", "detail", id] as const,
    },
    stats: (scope: string) => ["orders", "stats", scope] as const,
  },
  purchasing: {
    all: () => ["purchasing"] as const,
    suppliers: {
      all: () => ["purchasing", "suppliers"] as const,
      list: (query?: unknown) => ["purchasing", "suppliers", "list", query] as const,
      detail: (id: string) => ["purchasing", "suppliers", "detail", id] as const,
      stats: () => ["purchasing", "suppliers", "stats"] as const,
    },
    invoices: {
      all: () => ["purchasing", "invoices"] as const,
      list: (query?: unknown) => ["purchasing", "invoices", "list", query] as const,
      detail: (id: string) => ["purchasing", "invoices", "detail", id] as const,
    },
    payments: {
      list: (query?: unknown) => ["purchasing", "payments", "list", query] as const,
    },
  },
  sales: {
    all: () => ["sales"] as const,
    list: (scope: string, query?: unknown) => ["sales", "list", scope, query] as const,
    detail: (scope: string, reference: string) => ["sales", "detail", scope, reference] as const,
  },
  repairs: {
    all: () => ["repairs"] as const,
    list: (scope: string, query?: unknown) => ["repairs", "list", scope, query] as const,
    detail: (scope: string, id: string) => ["repairs", "detail", scope, id] as const,
  },
  billing: {
    all: () => ["billing"] as const,
    mine: () => ["billing", "mine"] as const,
    list: (scope: string, query?: unknown) => ["billing", "list", scope, query] as const,
    detail: (scope: string, number: string) => ["billing", "detail", scope, number] as const,
    payments: {
      list: (query?: unknown) => ["billing", "payments", "list", query] as const,
    },
  },
  stats: {
    all: () => ["stats"] as const,
    adminDashboard: () => ["stats", "admin-dashboard"] as const,
    staffDashboard: () => ["stats", "staff-dashboard"] as const,
    overview: () => ["stats", "overview"] as const,
    filtered: (query?: unknown) => ["stats", "filtered", query] as const,
    chart: (chart: string, query?: unknown) => ["stats", "chart", chart, query] as const,
    report: (type: string, query?: unknown) => ["stats", "report", type, query] as const,
  },
  observability: {
    all: () => ["observability"] as const,
    logs: {
      list: (query?: unknown) => ["observability", "logs", "list", query] as const,
    },
    logStats: () => ["observability", "log-stats"] as const,
    clientActivity: (id: string, query?: unknown) =>
      ["observability", "client-activity", id, query] as const,
    staffSearches: (query?: unknown) => ["observability", "staff-searches", query] as const,
  },
} as const;

// TEMPORARY — Sub-01 stub-hook compatibility shim, not part of the real registry above.
// A handful of pre-existing `src/hooks/use-*.ts` stub hooks (numeric ids, MVP-only key
// shapes with no contract equivalent — e.g. lookup-by-name, `byStatus`, ad hoc `search`)
// still reference the old flat `qk.catalog.*`/`qk.orders.*`/`qk.clients.*` shapes this
// retype removed. Each is retired by the domain sprint that rewires its consuming hook
// against a real service + contract DTO (integration sprints.md): catalog ones by Sprint 3,
// orders ones by Sprint 5, `clientsMyAccount` by Sprint 4. Do not add new entries here or
// consume this from any new (Sub-02) hook — extend the real `qk` registry above instead.
export const qkLegacy = {
  catalogProductsList: () => ["catalog", "products"] as const,
  catalogFeaturedProducts: (limit: number) => ["catalog", "products", "featured", limit] as const,
  catalogProductByName: (name: string) => ["catalog", "products", "by-name", name] as const,
  catalogAdminProductsStats: () => ["catalog", "admin-products", "stats"] as const,
  catalogAdminProductDetail: (id: number) => ["catalog", "admin-products", "detail", id] as const,
  catalogAdminProductsByStatus: (status: string) =>
    ["catalog", "admin-products", "by-status", status] as const,
  catalogAdminProductsSearch: (query: string, filters?: unknown) =>
    ["catalog", "admin-products", "search", query, filters] as const,
  ordersAdminList: (query?: unknown) => ["orders", "admin-list", query] as const,
  ordersAdminStats: () => ["orders", "admin-stats"] as const,
  clientsMyAccount: () => ["clients", "my-account"] as const,
} as const;
