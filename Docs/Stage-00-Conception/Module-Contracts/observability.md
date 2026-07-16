# Module: observability
Merges: audit (narrated trail) + activity (client browsing + staff search logs). Both append-only sinks.

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `OBS_ROUTES.CLIENT_BEACON` | POST `/api/activity/client` | client | fire-and-forget (202) |
| `OBS_ROUTES.STAFF_SEARCH_BEACON` | POST `/api/activity/staff-search` | staff\|admin | beacon |
| `OBS_ROUTES.CLIENT_ACTIVITY` | GET `/api/admin/clients/:id/activity?type=&from=&to=` | admin | the Browsing tab |
| `OBS_ROUTES.STAFF_SEARCHES` | GET `/api/admin/activity/staff-searches?userId=&from=&to=&q=` | admin | inventory audit |
| `OBS_ROUTES.LOGS` | GET `/api/admin/logs?search=&userId=&actionType=&from=&to=` | admin | 20/page |
| `OBS_ROUTES.LOG_STATS` | GET `/api/admin/logs/stats` | admin | total/today/week/month |

```
ClientActivityCommand { type: 'SEARCH'|'PRODUCT_VIEW'|'CATALOG_SESSION';
                        query?; productId?; durationSeconds?: int.min(0) }
ClientActivityDto { type; query?; product? { id; name }; durationSeconds?; createdAt }
StaffSearchCommand { query; matchedProductId? }
StaffSearchDto { userId; userName; query; matchedProduct? { id; name }; createdAt }
AuditLogDto { id; user? { id; username }; actionType: string;    // open string, never an enum
              entityType; entityId; description; ipAddress?; createdAt }
```

## Events [CONTRACT]
- **Audit listens to everything that mutates:** `auth.loggedIn`, `user.*`, `client.registered|approved|rejected|passwordReset`, `posClient.creditChanged`, `clientCategory.changed`, `taxonomy.changed`, `product.created|repriced`, `inventory.adjusted`, `supplier.creditChanged`, `supplierInvoice.confirmed|cancelled`, `payment.*`, `sale.confirmed`, `return.created`, `order.*`, `repair.statusChanged|pickedUp|cancelled`, `invoice.issued|cancelled`, `settings.changed`, `deliveryFees.changed`.
- **Activity listens** `product.searched` → one StaffSearchLog row.
- Emits: none — sinks only.

## Business Logic [BACKEND]
1. Each audit listener renders **one narrated string containing the before/after values** — "Order ORD-2026-0113: status confirmed → packaged", "POS client POS-0042: credit 1 500 → 3 200 (sale SAL-2026-0088)". No structured diff columns. Replay-safe (keyed by event id). Adding an actionType = adding a listener; zero schema change.
2. Beacons: light validation, 202 fast path, never block the caller, rate-limited per subject. `durationSeconds` valid only for PRODUCT_VIEW / CATALOG_SESSION (400 on SEARCH).
3. Exposes a read service to the clients module (Browsing tab) and to statistics (top searches; most-viewed never-purchased). No update/delete path exists anywhere in this module.

## Test Scenarios [BACKEND]
One audit row per event, replayed event no-op. Narration contains both values for status/credit changes. Beacon junk → 400 without write; SEARCH + duration → 400. product.searched ⇒ exactly one row. Filters + pagination on both query endpoints.
