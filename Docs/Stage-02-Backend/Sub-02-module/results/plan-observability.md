# Stage 02 · Sub-02 — Module Implementation Plan: `observability`

> **Scope of this document:** the plan only (no code). It maps the `observability` module's
> contract + Prisma schema onto the strict file architecture, defines every method, the narration
> engine, the test strategy, and the wiring. Output per the user's constraint:
> `plan-observability.md` (planned in the same **set** as `platform` — see `plan-platform.md`).

`observability` merges **audit (narrated trail) + activity (client browsing + staff search logs)** —
both **append-only sinks** (spec `Docs/Stage-00-Conception/Module-Contracts/observability.md`). Its
heart is the **listener**: it subscribes to ~30 domain events across every mutating module and renders
**one narrated audit row per event**. It **emits nothing**. It also exposes a **read service** consumed
by the `clients` module (Browsing tab) and `statistics`.

---

## 0. Pre-flight verification (standing rule: confirm nothing must be newly declared)

I read the real contract package `@dragon-telecom/contract` (`Apps/contract/src/modules/observability/…`),
the migrated `schema.prisma`, and — critically — **every module's `*.events.ts`** plus the typed bus
(`Apps/api/src/common/events/event-bus.ts`). Confirmed present:

| Kind | Already in `@dragon-telecom/contract` |
|---|---|
| Routes | `OBS_ROUTES.{CLIENT_BEACON, STAFF_SEARCH_BEACON, CLIENT_ACTIVITY, STAFF_SEARCHES, LOGS, LOG_STATS}` |
| Enums | `ClientActivityType` (`SEARCH`\|`PRODUCT_VIEW`\|`CATALOG_SESSION`) |
| Commands | `ClientActivitySchema/Command` (with `.refine()`: `durationSeconds` invalid for `SEARCH`), `StaffSearchSchema/Command` |
| Queries / params | `ClientActivityQuerySchema/Query` (`type?/from?/to?`), `StaffSearchesQuerySchema/Query` (`userId?/from?/to?/q?`), `LogsQuerySchema/Query` (adds `page`/`limit` default 20/max 100), `ClientActivityIdParamsSchema/Params` (`{ id }`) |
| DTOs + response schemas | `ClientActivityResponseSchema/Dto`, `StaffSearchResponseSchema/Dto`, `AuditLogResponseSchema/Dto` (`actionType` open string), `LogStatsResponseSchema/Dto` |
| Events (out) | **none** — observability is a sink; correctly absent from the bus's `AppEvents` map |
| Events (in) | **all present** — every event the spec's listen-list names exists in the typed bus (§0.1) |
| Common | `paginated()`/`PaginationMeta` (for `LOGS`), `ApiResponse<T>`, `ErrorCode`, `JWTPayload` |

Prisma models reused verbatim: `AuditLog` (`userId?`, `actionType` open string, `entityType`,
`entityId`, `description`, `ipAddress?`, `createdAt`; `@@index([actionType, createdAt])`,
`@@index([userId])`), `ClientActivityLog` (`clientId`, `type`, `query?`, `productId?`,
`durationSeconds?`, `createdAt`; `@@index([clientId, createdAt])`), `StaffSearchLog` (`userId`, `query`,
`matchedProductId?`, `createdAt`; `@@index([userId, createdAt])`). Foundations reused: `prisma`,
`sendSuccess`, `eventBus`, `requireAuth`, `validateRequest`, error classes, `paginated`.

### 0.1 Listen-list ⇄ typed-bus verification (the make-or-break check for a listener module)

Every event the spec's audit/activity listen-lists name is a key in `AppEvents` (bus is
`IdentityEvents & CatalogEvents & ClientsEvents & InventoryEvents & PlatformEvents & PurchasingEvents &
SalesEvents & OrdersEvents & RepairsEvents & BillingEvents`), so `eventBus.on(<key>, …)` type-checks
for all of them **today**:

| Spec listen token | Resolves to (module · event key) |
|---|---|
| `auth.loggedIn`, `user.*` | identity · `auth.loggedIn`, `user.created`, `user.updated`, `user.roleChanged` |
| `client.registered\|approved\|rejected\|passwordReset`, `posClient.creditChanged` | clients · same 5 keys |
| `clientCategory.changed`, `taxonomy.changed`, `product.created\|repriced` | **catalog** (note: `clientCategory.changed` lives in catalog, not clients) |
| `inventory.adjusted` | inventory (only this one — **not** `stockChanged`/`lowStock`) |
| `supplier.creditChanged`, `supplierInvoice.confirmed\|cancelled`, `payment.supplierRecorded` | purchasing |
| `sale.confirmed`, `return.created` | sales |
| `order.*` | orders · `order.confirmed\|placed\|statusChanged\|cancelled\|returned` |
| `repair.statusChanged\|pickedUp\|cancelled` | repairs |
| `invoice.issued\|cancelled`, `payment.clientRecorded` | billing (spec's `payment.*` = billing's client + purchasing's supplier payment) |
| `settings.changed`, `deliveryFees.changed` | platform |
| `product.searched` (**activity**, not audit) | catalog → one `StaffSearchLog` row |

**Forward-compatibility note:** only `identity` (and, in this set, `platform`) actually **emit** yet.
The listener wires handlers for all keys now; handlers for not-yet-shipped emitters lie **dormant**
(the `on` registration is inert until something emits) — no error, no schema change when those modules
land. This module is legitimately built **ahead of** most of its emitters.

**One genuine open decision** — the append-only `AuditLog` has no idempotency column, yet the shared
convention demands "**listener idempotent by source-document id**" and the test wants "replayed event
no-op." Resolved with a recommendation in §8.1 (add a `AuditLog.eventKey String? @unique`, one
migration) — not a blocker either way.

---

## 1. Step 1 — Contract & Schema analysis

### 1.1 Prisma model ⇄ contract DTO mapping (the mapper's job — pure/static, never spreads the entity)

| Prisma source | → contract DTO | Include (returned) | Exclude / transform |
|---|---|---|---|
| `ClientActivityLog` (+ `product: {id,name}`) | `ClientActivityDto` | `type, query?, product?{id,name}, durationSeconds?, createdAt` | `createdAt: Date → ISO`. `productId → product{…}` via join (omit if null). Exclude `id, clientId`. `type` Prisma → contract `ClientActivityType`. |
| `StaffSearchLog` (+ `user:{username}`, `matchedProduct:{id,name}`) | `StaffSearchDto` | `userId, userName, query, matchedProduct?{id,name}, createdAt` | `createdAt → ISO`. `userName` from joined `User.username`. Omit `matchedProduct` if null. |
| `AuditLog` (+ `user?:{id,username}`) | `AuditLogDto` | `id, user?{id,username}, actionType, entityType, entityId, description, ipAddress?, createdAt` | `createdAt → ISO`. `user` omitted when `userId` null. `actionType` stays an **open string**. |
| aggregate counts | `LogStatsDto` | `total, today, week, month` | Assembled in the service from 4 `count()` queries (not a row map). |

### 1.2 Enum conversions

- `ClientActivityType` (Prisma) ⇄ `ClientActivityType` (contract) — identical strings, nominal cast
  (as identity's mapper does for `UserType`).
- No other enums; `actionType` is deliberately **not** an enum (spec: "adding an actionType = adding a
  listener; zero schema change").

---

## 2. Step 2 — Component definition

### 2.1 Interface `IObservabilityService` (methods derived from routes + the injected read surface)

| Method | Serves | Signature (design, not code) |
|---|---|---|
| `recordClientActivity` | POST `CLIENT_BEACON` | `recordClientActivity(clientId: string, cmd: ClientActivityCommand): Promise<void>` |
| `recordStaffSearch` | POST `STAFF_SEARCH_BEACON` | `recordStaffSearch(userId: string, cmd: StaffSearchCommand): Promise<void>` |
| `getClientActivity` | GET `CLIENT_ACTIVITY` (+ injected: clients Browsing tab) | `getClientActivity(clientId: string, q: ClientActivityQuery): Promise<ClientActivityDto[]>` |
| `listStaffSearches` | GET `STAFF_SEARCHES` | `listStaffSearches(q: StaffSearchesQuery): Promise<StaffSearchDto[]>` |
| `listLogs` | GET `LOGS` | `listLogs(q: LogsQuery): Promise<PaginatedResult<AuditLogDto>>` |
| `getLogStats` | GET `LOG_STATS` | `getLogStats(): Promise<LogStatsDto>` |
| `recordAuditEvent` | *(internal — the listener)* | `recordAuditEvent(entry: AuditEntry): Promise<void>` — idempotent (§8.1) |
| `recordProductSearched` | *(internal — the listener)* | `recordProductSearched(p: CatalogEvents['product.searched']): Promise<void>` → one `StaffSearchLog` |

`AuditEntry` = an internal input type `{ actionType; entityType; entityId; description; userId?;
ipAddress?; eventKey? }` (module-local, not a contract DTO — the audit row's persistence shape).

**Injected read surface (deferred shape, like identity §8.9).** The spec: *"Exposes a read service to
the clients module (Browsing tab) and to statistics (top searches; most-viewed never-purchased)."*
`getClientActivity` already serves the Browsing tab. The statistics reads
(`topSearches`, `mostViewedNeverPurchased`) are **consumed by the statistics module's** own endpoints,
not observability's routes; their exact signatures are finalized with the statistics plan (the
"never-purchased" half needs a join against sales/orders that statistics composes). Flagged §8.6.

### 2.2 Events

- **Emits (out): none** — sink only. No `observability.events.ts` (correctly absent).
- **Events (in): all of §0.1** → **`observability.listener.ts` is required** (the full 6 files). This is
  the module's core, not an optional extra.

---

## 3. Business logic (the HOW) — spec §Business Logic

### 3.1 The audit listener — one narrated row per event (spec BL 1)

`observability.listener.ts` injects `IObservabilityService` and, in `setup()`, registers a handler per
event key from §0.1. Each handler:
1. Builds an `AuditEntry`: `actionType` = the **event name** (open string), `entityType`/`entityId` =
   the source document, `description` = **one narrated string containing before/after values**,
   `userId?`/`ipAddress?` where the payload carries them, and a deterministic `eventKey` for idempotency
   (§8.1).
2. Calls `service.recordAuditEvent(entry)` — **idempotent** (no-op on replay).
3. Is wrapped in `try/catch` that **logs and swallows** — audit must **never** throw back into the
   emitter (events fire post-commit; a failed sink write must not break the business flow it observes).

**Narration is built purely from the event payload** (no cross-table reads → decoupled, replay-stable,
no N+1). Two payload shapes:

- **Payload already carries a `description`** → use it verbatim: `settings.changed`,
  `deliveryFees.changed`, `inventory.adjusted`, `taxonomy.changed`, `clientCategory.changed`.
- **Payload carries structured before/after** → render `"<Entity> <id>: <field> <before> → <after>"`:
  `order.statusChanged` ("Order <orderId>: status confirmed → packaged"), `repair.statusChanged`,
  `posClient.creditChanged` ("POS client <id>: credit 1 500 → 3 200 (<cause>)"), `supplier.creditChanged`,
  `supplierInvoice.confirmed`, `sale.confirmed`/`payment.*` (credit prev → new when present).

Narration map (grouped by emitter):

| Event(s) | actionType | entityType · entityId | description source |
|---|---|---|---|
| `auth.loggedIn` | `auth.loggedIn` | `User` · `userId` | "logged in (<authType>)"; sets `userId`, `ipAddress` |
| `user.created\|updated` | same | `User` · `user.id` | "User <username> created/updated (<type>)" |
| `user.roleChanged` | `user.roleChanged` | `User` · `userId` | "roles changed → [<roleIds>]" |
| `client.registered\|approved\|rejected\|passwordReset` | same | `Client` · `clientId` | past-tense + `reason?` |
| `posClient.creditChanged` | same | `PosClient` · `posClientId` | "credit <prev> → <new> (<cause>)" |
| `clientCategory.changed`, `taxonomy.changed` | same | payload's entity | **payload `description`** verbatim |
| `product.created\|repriced` | same | `Product` · `productId` | "Product <name> created/repriced" |
| `inventory.adjusted` | `inventory.adjusted` | `StockAdjustment` · `reference` | **payload `description`** |
| `supplierInvoice.confirmed\|cancelled` | same | `SupplierInvoice` · `invoiceId` | confirmed → "credit <prev> → <new>"; cancelled → `reason?` |
| `payment.supplierRecorded` | same | `SupplierPayment` · `paymentId` | "amount <n>: credit <prev> → <new>" |
| `supplier.creditChanged` | same | `Supplier` · `supplierId` | "credit <prev> → <new> (<cause>)" |
| `sale.confirmed` | `sale.confirmed` | `Sale` · `saleId` | "total <n>" (+ credit prev→new if present) |
| `return.created` | `return.created` | `Return` · `returnId` | "refund <n> for sale <saleId>" |
| `order.confirmed\|placed\|cancelled\|returned` | same | `Order` · `orderId` | past-tense + `reason?`/`refundAmount` |
| `order.statusChanged` | `order.statusChanged` | `Order` · `orderId` | "status <from> → <to>" |
| `repair.pickedUp\|cancelled` | same | `Repair` · `repairId` | "picked up: total <n>" / `reason?` |
| `repair.statusChanged` | `repair.statusChanged` | `Repair` · `repairId` | "status <from> → <to>" |
| `invoice.issued\|cancelled` | same | `Invoice` · `invoiceNumber` | "issued from <sourceType> <ref>" / `reason?` |
| `payment.clientRecorded` | same | `ClientPayment` · `paymentId` | "amount <n>: credit <prev> → <new>" |
| `settings.changed`, `deliveryFees.changed` | same | `Settings`/`DeliveryFee` | **payload `description`** (old → new) |

### 3.2 The activity listener — `product.searched` (spec: "one `StaffSearchLog` row")

Handler for `product.searched { userId, query, matchedProductId? }` → one `StaffSearchLog` row
(`recordProductSearched`). "Exactly one row" (Test Scenarios) ⇒ idempotent by the same mechanism as
audit (§8.1) if `product.searched` ever carries/derives a key; the in-process bus does not replay at
runtime. **Relationship to `STAFF_SEARCH_BEACON`:** both can write a `StaffSearchLog` — see §8.2
(recommendation: beacon = frontend-reported staff searches; `product.searched` = server-side search
flow; document which is authoritative to avoid double counting).

### 3.3 Beacons (spec BL 2) — fast 202, never block, per-subject rate-limit

- **`CLIENT_BEACON`** (`client`): `clientId` from `req.user.clientId`; validate `ClientActivityCommand`
  (the contract `.refine()` already enforces **`durationSeconds` on `SEARCH` → 400** — no service logic
  needed); respond **`202`** immediately, then perform the insert **without blocking the response**
  (fire-and-forget; failures logged, not surfaced). `type`/`query`/`productId`/`durationSeconds` map
  straight to `ClientActivityLog`.
- **`STAFF_SEARCH_BEACON`** (`staff`\|`admin`): `userId` from `req.user.sub`; validate
  `StaffSearchCommand`; `202`; fire-and-forget `StaffSearchLog` insert.
- **Rate-limit per subject** (per `clientId` / per `userId`): no limiter infra exists in the foundation
  — **deferred**, consistent with identity's login rate-limit decision (a correct limiter needs a shared
  store; an in-process one breaks under multi-instance). Flagged §7.1 / §8.5.

### 3.4 Read endpoints (spec BL 3 — no update/delete path anywhere in this module)

- **`CLIENT_ACTIVITY`** GET `/admin/clients/:id/activity?type=&from=&to=` (admin): `ClientActivityLog`
  for `:id`, filtered by `type?` and `createdAt` between `from?`/`to?`, newest first, joined to
  `product`. Returns `ClientActivityDto[]` (**array**, not paginated — the query has no `page/limit`;
  §8.3). Also the injected Browsing-tab read for the clients module.
- **`STAFF_SEARCHES`** GET `/admin/activity/staff-searches?userId=&from=&to=&q=` (admin): `StaffSearchLog`
  filtered by `userId?`, date range, and `q?` (`query contains`, insensitive), joined to `user` +
  `matchedProduct`. Returns `StaffSearchDto[]` (array; §8.3).
- **`LOGS`** GET `/admin/logs?search=&userId=&actionType=&from=&to=` (admin, **20/page**): `AuditLog`
  filtered by `actionType?`, `userId?`, date range, and `search?` (`description contains`, insensitive),
  joined to `user`, newest first. **Paginated** via `paginated(AuditLogResponseSchema)` (`page`/`limit`
  from the query, default 20/max 100) — mirrors identity's `listUsers`.
- **`LOG_STATS`** GET `/admin/logs/stats` (admin): four `AuditLog.count()` — `total`, `today`, `week`,
  `month` (`createdAt ≥` start-of-day / -7d / -30d, computed in the service) → `LogStatsDto`.

---

## 4. Step 3 — Test strategy (`test-rules.md`)

### 4.1 Factories (`test/data/`, contract-shaped)

- `client-activity.factory.ts` — `clientActivityPayload(overrides): ClientActivityCommand` (valid +
  the `SEARCH`+`durationSeconds` invalid case); `seedClientActivity(clientId, overrides)`.
- `staff-search.factory.ts` — `staffSearchPayload(): StaffSearchCommand`; `seedStaffSearch(userId,…)`.
- `audit-log.factory.ts` — `seedAuditLog(overrides)` and one **sample payload per event key** (drawn
  from the contract event types) to drive the listener/narration specs.

### 4.2 Unit (`test/unit/modules/observability/`, mock Prisma + a real/​spied `eventBus`)

- `observability.mapper.spec.ts`: `createdAt → ISO`; `product`/`matchedProduct`/`user` omitted when the
  FK is null; `userName` from the join; each DTO parses its `*ResponseSchema`; `actionType` passes
  through as an arbitrary string.
- `observability.listener.spec.ts` (the core): for representative events assert the **narration
  contains both before/after values** (status `confirmed → packaged`; credit `1 500 → 3 200`); payloads
  with a `description` are used **verbatim**; **replayed event → no-op** (one row — §8.1); a throwing
  `recordAuditEvent` is **swallowed** (emitter never sees it); `product.searched` ⇒ **exactly one**
  `StaffSearchLog`.
- `observability.service.spec.ts`: beacon writes; `getLogStats` window math; `listLogs` pagination
  meta; filter builders (`actionType`/`userId`/date/`search contains`).

### 4.3 Integration (`test/integration/observability.integration.spec.ts`, real test DB, envelope asserted)

Emit each event on the real bus → **exactly one** `AuditLog` row with correct
`actionType/entityType/entityId/description`; **re-emit → still one row** (idempotent). Beacon: junk
body → **400 without a write**; `SEARCH` + `durationSeconds` → **400**; valid → **202** + one row.
`product.searched` ⇒ exactly one `StaffSearchLog`. All four read endpoints: **filters + pagination**
(`LOGS` 20/page), date ranges, `q`/`search`; `LOG_STATS` counts. Guard checks (client beacon rejects
staff token and vice-versa per the route's access; admin reads → 403 for non-admin; missing token →
401). `NODE_ENV=test` DB.

### 4.4 Contract conformance (`test/contract/routes.conformance.spec.ts`)

Extend with an `observability route resolution` block (the spec already imports `OBS_ROUTES`) asserting
every path resolves on `app` (has `success`, not a bare 404). Response-shape: parse representative
`res.body.data` through `ClientActivityResponseSchema`, `StaffSearchResponseSchema`,
`AuditLogResponseSchema`, `LogStatsResponseSchema`, and `paginated(AuditLogResponseSchema)`.

---

## 5. Step 4 — File checklist (create only what the module needs — all 6)

Inside `Apps/api/src/modules/observability/`, in order:

1. **`observability.mapper.ts`** — pure/static: `toClientActivityDto`, `toStaffSearchDto`,
   `toAuditLogDto`, `toLogStatsDto`. `Date → ISO`; omit nested objects when the FK is null; each ends
   `XxxResponseSchema.parse(dto)`.
2. **`observability.interface.ts`** — `IObservabilityService` (§2.1) + the module-local `AuditEntry`.
3. **`observability.service.ts`** — `class ObservabilityService implements IObservabilityService`;
   injects `PrismaClient`; append-only writes; `recordAuditEvent` idempotent (§8.1); read/filter/paginate
   logic; `getLogStats` windows. **Emits nothing.**
4. **`observability.listener.ts`** — injects `IObservabilityService`; `setup()` registers one handler
   per §0.1 event key; builds `AuditEntry` + narration (§3.1); handles `product.searched` (§3.2); every
   handler `try/catch`-logs (never throws into the emitter). **This is the module's core.**
5. **`observability.controller.ts`** — thin; `try/catch → next(error)`; beacons read `req.user`
   (`clientId`/`sub`) + `req.validated.body`, respond **`202`** then fire-and-forget; reads use
   `req.validated.{params,query}` + `sendSuccess` (`200`).
6. **`observability.routes.ts`** — composition root: `new ObservabilityService(prisma)` →
   `new ObservabilityController(service)` **and** `new ObservabilityListener(service); listener.setup()`
   (wire the listener once at startup); one registration per `OBS_ROUTES` constant + guards +
   `validateRequest`. `export { router }`.

### 5.1 Route registration map (guards + validation)

| Route const | Method | Guard | `validateRequest` |
|---|---|---|---|
| `CLIENT_BEACON` | POST | `requireAuth({ types:[CLIENT] })` | `{ body: ClientActivitySchema }` |
| `STAFF_SEARCH_BEACON` | POST | `requireAuth({ types:[STAFF, ADMIN] })` | `{ body: StaffSearchSchema }` |
| `CLIENT_ACTIVITY` | GET | `requireAuth({ types:[ADMIN], checkDB:true })` | `{ params: ClientActivityIdParamsSchema, query: ClientActivityQuerySchema }` |
| `STAFF_SEARCHES` | GET | admin | `{ query: StaffSearchesQuerySchema }` |
| `LOGS` | GET | admin | `{ query: LogsQuerySchema }` |
| `LOG_STATS` | GET | admin | — |

`requireAuth` covers type-level access; no `staff(PAGE_KEY)`-gated routes here.

---

## 6. Wiring (the real extension point)

Add the router to `Apps/api/src/modules/index.ts` (`apiRouter.use(observabilityRouter)`), mounted under
`env.API_PREFIX`. Paths compose to `/api/activity/client`, `/api/admin/logs`, … per spec.

**The listener must be wired at startup**, once, on the shared `prisma`. Registering it inside
`observability.routes.ts` (which `registerModules` imports at boot) guarantees `setup()` runs when the
app builds — so audit handlers are live before any request. (No ordering dependency on other modules:
handlers for not-yet-emitting modules are inert until those modules emit.)

**Injected read surface.** `getClientActivity` (and the deferred statistics reads, §8.6) are exposed for
the clients/statistics composition roots; the export path is coordinated with those plans (mirrors
identity §8.9 / platform §6).

---

## 7. Prerequisites / dependencies outside the 6 files (flagged)

1. **Per-subject beacon rate-limiting — deferred (consistent with identity).** Spec BL 2 wants beacons
   "rate-limited per subject"; no limiter middleware/store exists in the foundation. **Decision: defer**
   — a correct limiter needs a shared store (Redis); an in-process `Map` limiter silently breaks under
   multi-instance deploys. Tracked as the same cross-cutting infra follow-up as identity's login
   rate-limit; **not** blocking this module's definition of done. A minimal in-process token bucket is
   available if the owner wants basic abuse protection now (flagged §8.5).
2. **Audit idempotency mechanism** (§8.1) — the one decision that may touch the schema (a nullable
   `AuditLog.eventKey @unique`, one migration) **or** stay zero-schema (existence-check). Recommendation
   in §8.1.
3. **Conformance test extension** (§4.4) — already flagged in-file as Sub-02 work in
   `routes.conformance.spec.ts`.

*(No new dependencies, no seed — observability writes only its own append-only tables and reads events
already on the bus.)*

---

## 8. Deviations & open decisions (resolved toward the rules; noted per standing rules)

| # | Item | Resolution |
|---|---|---|
| 1 | **Idempotency: "listener idempotent by source-document id" + "replayed event no-op", but `AuditLog` has no dedup column.** | **Recommend** adding `AuditLog.eventKey String? @unique` (one migration) — the listener computes a deterministic key (`<eventName>:<entityId>[:<discriminator>]`, e.g. `order.statusChanged:<orderId>:PACKAGED`) and **upserts** by it (robust under any future at-least-once/persistent bus). Inherently-repeatable events (`auth.loggedIn`) get `eventKey = null` and always append (two logins = two rows, correct). This preserves "adding an actionType = zero schema change" (the key column is added **once**, not per-actionType). **Zero-schema fallback:** a pre-insert existence-check on the same composite (racy under concurrency, but the current in-process bus is single-threaded per event). **Flagged for owner.** |
| 2 | **`STAFF_SEARCH_BEACON` and `product.searched` both write `StaffSearchLog`.** | Both paths retained: **beacon** = frontend-reported staff searches (fast 202); **`product.searched`** = server-side search flow. **Recommend** the owner confirm which is authoritative (or key the event write so a beacon-then-event pair de-dupes) to avoid double counting. Flagged. |
| 3 | **Rules say "always paginate lists"; only `LOGS` has a `page/limit` query.** | Paginate `LOGS` (`paginated(AuditLogResponseSchema)`); `CLIENT_ACTIVITY`/`STAFF_SEARCHES` return arrays (their contract queries define no `page/limit`). Same deviation shape as identity §8.3. |
| 4 | **Audit `userId`/`ipAddress` are sparsely populated.** | Most event payloads **don't carry the actor** — only `auth.loggedIn`, `user.*`, `product.searched` carry a userId; only `auth.loggedIn` carries `ipAddress`. So `AuditLog.userId`/`ipAddress` are set **only** where the payload provides them, else null (both are optional in schema + DTO). Full actor attribution would require emitting modules to add `actorUserId` to their payloads — a cross-module change **out of observability's scope**. Flagged. |
| 5 | **Beacon rate-limit deferred** (§7.1). | Deferred to shared-store infra; minimal in-process limiter available on request. |
| 6 | **Injected read surface for statistics is underspecified.** | `getClientActivity` serves the Browsing tab now; `topSearches` / `mostViewedNeverPurchased` (the latter joins purchase data) are **defined with the statistics plan** — observability exposes the activity-side reads, statistics composes. Flagged (mirrors identity §8.9). |
| 7 | **Narration uses human references the payload may lack** (BL 1 shows `ORD-2026-0113`, but `order.statusChanged` carries a UUID). | Narrate **from the payload only** (id + structured before/after; verbatim `description` where present) — no cross-table reads, keeping the listener decoupled and replay-stable. Enriching events with human references is an **emitter-side** follow-up, not something audit fabricates. Flagged. |

No item rises to a genuine authority-vs-authority conflict, so per the standing rules I did not stop to
ask — each is resolved toward the rules/contract and flagged for the owner's review.

---

## 9. Definition of done

- `Apps/api/src/modules/observability/` has all **6 files** (mapper, interface, service, **listener**,
  controller, routes); the module **emits nothing**.
- Router mounted via `registerModules`; the **listener is wired at startup** and subscribes to every
  §0.1 event key; every route uses an `OBS_ROUTES` constant and validates each segment.
- Every service method returns a DTO that parses against its `*ResponseSchema` (mapper-enforced);
  nested `user`/`product` omitted when null; `Date → ISO` everywhere.
- **One audit row per event**, narration **contains both before/after values** for status/credit
  changes, `description`-bearing events used verbatim; **replayed event = no-op** (§8.1); a failing sink
  write never throws into the emitter.
- Beacons: junk → **400 no write**; `SEARCH` + `durationSeconds` → **400**; valid → **202**;
  `product.searched` ⇒ **exactly one** `StaffSearchLog`.
- Read endpoints: filters + date ranges on all; `LOGS` paginated 20/page; `LOG_STATS` total/today/week/
  month; `getClientActivity` exposed as the clients Browsing-tab read.
- Unit (incl. the listener/narration spec) + integration + conformance suites (§4) pass.
- Open decisions resolved or explicitly deferred: §8.1 (idempotency mechanism), §8.2 (beacon vs
  `product.searched`), §7.1 (rate-limit deferred), §8.6 (statistics read surface).
