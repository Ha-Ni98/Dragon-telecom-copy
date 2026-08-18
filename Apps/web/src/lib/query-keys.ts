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
      // S18 — `list(admin)` added (mirrors qk.catalog.brands' own all()/list(admin) split) now
      // that a staff route exists alongside the admin one (D-3). `all()` stays the bare prefix
      // so a create/update mutation (admin-only, D-3) invalidates both variants in one call.
      all: () => ["identity", "technicians"] as const,
      list: (admin = true) => ["identity", "technicians", admin] as const,
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
    // S22 — the supplier-invoice label dialog asks which of an invoice's products have a printable
    // barcode. Keyed on the id list so reopening the same invoice's dialog is served from cache;
    // barcodes change only through a product edit, which already invalidates
    // qk.catalog.adminProducts.all(), so no bespoke invalidation is added here.
    barcodeLookup: (productIds: string[]) => ["catalog", "barcode-lookup", productIds] as const,
    // `.all()` on each of these three exists so a create/update mutation can invalidate every
    // variant (public + admin) in one call — the two really are separate cache entries, because
    // `admin` is part of every `list(...)` key. S21 added it to `families` and `models`, which had
    // been omitting it: the storefront's enabled-only list and Settings' includes-disabled list
    // were colliding on one key, so whichever mounted first decided what the other saw.
    brands: {
      all: () => ["catalog", "brands"] as const,
      list: (admin = false) => ["catalog", "brands", admin] as const,
    },
    families: {
      all: () => ["catalog", "families"] as const,
      list: (query?: unknown, admin = false) => ["catalog", "families", query, admin] as const,
    },
    models: {
      all: () => ["catalog", "models"] as const,
      list: (query?: unknown, admin = false) => ["catalog", "models", query, admin] as const,
    },
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
      overview: (id: string) => ["clients", "admin", "overview", id] as const,
    },
  },
  posClients: {
    all: () => ["pos-clients"] as const,
    // S18 — `scope` added (staff/admin cache-collision fix, same as orders/sales/billing above)
    // now that the staff POS-clients page shares this list with admin (D-5).
    list: (scope: string, query?: unknown) => ["pos-clients", "list", scope, query] as const,
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
    // `scope` embedded (set-03 Sprint 6 fix) — the bare `admin`-labelled shape below collided
    // staff/admin caches under one key once useOrdersList(scope, query) was actually called from
    // both scopes of the same StaffOrders/AdminOrders twin tree with equivalent filter objects;
    // same bug class as the qk.orders.mine()/qk.purchasing.payments.list() fixes noted elsewhere.
    list: (scope: string, query?: unknown) => ["orders", "list", scope, query] as const,
    detail: (scope: string, id: string) => ["orders", "detail", scope, id] as const,
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
    // S12 — nested under `sales` so useCreateReturn's existing qk.sales.all() invalidation
    // reaches it for free; no change to that mutation's fan-out. S18 added `scope` (same
    // staff/admin cache-collision fix as `list`/`detail` above — returns now has a staff route
    // too, D-2).
    returns: (scope: string, query?: unknown) => ["sales", "returns", scope, query] as const,
  },
  repairs: {
    all: () => ["repairs"] as const,
    list: (scope: string, query?: unknown) => ["repairs", "list", scope, query] as const,
    detail: (scope: string, id: string) => ["repairs", "detail", scope, id] as const,
    // S13/R1 — technician stats. S18 added `scope` (staff route now exists too, D-3).
    technicianStats: (scope: string) => ["repairs", "technician-stats", scope] as const,
  },
  billing: {
    all: () => ["billing"] as const,
    // Embeds `query` (integration Sprint 9 fix) — `getMyInvoices` genuinely accepts an
    // `InvoiceListQuery` filter (status/source/from/to/page/limit), so a keyless `mine()` would
    // collide every filter variant onto one cache entry (the same class of gap Sprint 5 found
    // for `orders.mine`, caught here at registry-design time instead of via a failing test).
    mine: (query?: unknown) => ["billing", "mine", query] as const,
    // Distinct from `detail(scope, number)` below — the client-scoped GET has no `scope` (no
    // client member on BillingScope), so it needs its own key shape rather than a fake scope.
    mineDetail: (number: string) => ["billing", "mine-detail", number] as const,
    list: (scope: string, query?: unknown) => ["billing", "list", scope, query] as const,
    detail: (scope: string, number: string) => ["billing", "detail", scope, number] as const,
    payments: {
      // S18 — `scope` added (staff/admin cache-collision fix, same as `list`/`detail` above);
      // the staff POS-clients drawer's Payments tab now reads through this too (D-5).
      list: (scope: string, query?: unknown) =>
        ["billing", "payments", "list", scope, query] as const,
    },
  },
  stats: {
    all: () => ["stats"] as const,
    adminDashboard: () => ["stats", "admin-dashboard"] as const,
    staffDashboard: () => ["stats", "staff-dashboard"] as const,
    overview: () => ["stats", "overview"] as const,
    filtered: (query?: unknown) => ["stats", "filtered", query] as const,
    chart: (chart: string, query?: unknown) => ["stats", "chart", chart, query] as const,
    topProducts: (query?: unknown) => ["stats", "top-products", query] as const,
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
// retype removed. CORRECTION (Sprint 3): these entries are NOT retired sprint-by-sprint —
// every Sub-02 sprint is barred from touching `/src/pages`/`/src/components`, and the pages
// consuming these exact stub hooks (Products.tsx, ProductDetails.tsx, AdminProducts.tsx, …)
// are what actually pins the old numeric-id shapes in place. Real retirement happens in
// Sub-03, when those pages are rewired onto the new real hooks (`useCatalogProducts.ts`,
// `useCatalogTaxonomy.ts`, etc.) and their old counterparts can finally be deleted. Do not
// add new entries here for any NEW (Sub-02) hook — extend the real `qk` registry above
// instead; this list only grows when retyping the real registry incidentally breaks an
// old stub hook's key shape (as `brands`/`families`/`models` did in Sprint 3).
export const qkLegacy = {
  catalogBrandsList: () => ["catalog", "brands", false] as const,
  catalogFamiliesList: () => ["catalog", "families", undefined] as const,
  catalogModelsList: () => ["catalog", "models", undefined] as const,
  catalogAdminProductsStats: () => ["catalog", "admin-products", "stats"] as const,
  catalogAdminProductDetail: (id: number) => ["catalog", "admin-products", "detail", id] as const,
  catalogAdminProductsByStatus: (status: string) =>
    ["catalog", "admin-products", "by-status", status] as const,
  catalogAdminProductsSearch: (query: string, filters?: unknown) =>
    ["catalog", "admin-products", "search", query, filters] as const,
} as const;
