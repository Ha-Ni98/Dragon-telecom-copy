# Observability — Sprint O1 Report: Foundation (idempotency decision, mapper, interface, factories)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint O1 marked ✅.

---

## Owner decisions taken (asked before implementing)

1. **Audit idempotency mechanism: zero-schema, not a migration.** Plan §8.1 offered a
   recommended `AuditLog.eventKey String? @unique` migration vs. a schema-free pre-insert
   existence check. **Decision: zero-schema.** No `eventKey` column; `recordAuditEvent` (Sprint
   O2) will check for an existing row matching the same `(actionType, entityType, entityId,
   description)` before inserting. `description` already encodes the specific before/after values
   for structured events, so it doubles as the discriminator that distinguishes "the same
   transition replayed" (skip) from "a genuinely different transition on the same entity"
   (record both) — e.g. `order.statusChanged` CONFIRMED→PACKAGED and a later PACKAGED→COMPLETED
   produce different `description`s and both get recorded; the exact same event re-emitted
   produces the same `description` and gets skipped. Racy under real concurrency, accepted per
   the plan's own framing (the in-process `EventEmitter` bus is synchronous per event; there is no
   actual at-least-once redelivery mechanism today). `AuditEntry` (in `observability.interface.ts`)
   has **no** `eventKey` field as a result.
2. **`STAFF_SEARCH_BEACON` vs. `product.searched`: keep both, flag for reconciliation.** Both
   write paths are implemented as designed (they serve different call sites — a frontend-reported
   beacon vs. a server-side search flow). Documented as a **known double-counting risk** once
   catalog actually emits `product.searched` (it doesn't yet — only identity and platform emit
   today), to be resolved when the catalog module is built. Not blocking this sprint.

Both are recorded in `plan-observability.md` §7.1/§8.1 and §8.2 with the reasoning above; this
report is the executed resolution.

---

## What was built

1. **`src/modules/observability/observability.interface.ts`** — `IObservabilityService` (6
   route-serving methods + 2 internal-only methods called solely by the listener), the module-local
   `AuditEntry` type (no `eventKey` — see decision 1), and `ProductSearchedPayload` (mirrors
   `catalog.events.ts`'s `product.searched` shape locally, matching how `AuditEntry` is
   self-contained rather than importing `CatalogEvents` directly).
2. **`src/modules/observability/observability.mapper.ts`** — pure/static `ObservabilityMapper`:
   `toClientActivityDto`, `toStaffSearchDto`, `toAuditLogDto`, `toLogStatsDto`. `Date → ISO`
   throughout; nested `product`/`matchedProduct`/`user` omitted (not `null`-valued) when the FK is
   absent; `userName` taken from the joined `User.username`; `actionType` stays an open string
   (spec: "adding an actionType = adding a listener, zero schema change" — never cast to an enum).
3. **Factories:** `test/data/client-activity.factory.ts` (`clientActivityPayload`,
   `invalidSearchWithDurationPayload` for the "SEARCH + duration → 400" case, `seedClientActivity`),
   `staff-search.factory.ts` (`staffSearchPayload`, `seedStaffSearch`), `audit-log.factory.ts`
   (`seedAuditLog` + `SAMPLE_EVENTS`).
4. **`test/unit/modules/observability/observability.mapper.spec.ts`** — 7 tests.

---

## Scoped-down deviation: `SAMPLE_EVENTS` covers 6 representative events, not all ~30

The plan's Sprint O1 task literally says "one sample payload per event key ... drawn from the
contract event types." Building ~30 payloads now — several of which (`user.created`, `user.updated`)
require a full, valid nested DTO (`UserDto` with `profile`/`roles`/`effectivePages`) — would be
speculative work done before Sprint O3's listener spec exists to actually consume it, with real
risk of drifting from whatever that spec ends up needing.

**Built instead:** 6 payloads spanning every narration *pattern* the listener will implement
(plan §3.1) — `settings.changed`/`deliveryFees.changed` (verbatim `description`), `order.statusChanged`
(structured status transition), `posClient.creditChanged` (structured credit transition),
`auth.loggedIn` (plain actor-bearing event), and `product.searched` (the activity-side handler,
distinct from the audit listener). Each is `satisfies`-checked against its real contract event
type (`IdentityEvents`, `PlatformEvents`, `OrdersEvents`, `ClientsEvents`, `CatalogEvents`) so it
can't silently drift from what `observability.listener.ts` will actually receive in Sprint O3.
Expanding `SAMPLE_EVENTS` with more entries as O3 needs them is a small, low-risk addition at that
point — building the full set now was not.

---

## Validation

- `npx tsc --noEmit` — clean (the `satisfies` checks against `IdentityEvents`/`PlatformEvents`/
  `OrdersEvents`/`ClientsEvents`/`CatalogEvents` all passed, confirming `SAMPLE_EVENTS` matches the
  real contract event shapes).
- `npm run lint` — clean.
- `npm run test:unit` — green, **144/144** tests, 16 files (137 prior + 7 new mapper tests).
- Mapper omits null nested objects (verified for both `ClientActivityLog.product` and
  `StaffSearchLog.matchedProduct` and `AuditLog.user`), converts `Date → ISO`, and every DTO
  parses its `*ResponseSchema`; the interface returns DTOs only (or `void` for the
  write/beacon/internal methods, which have no DTO to return).
- No migration needed (zero-schema idempotency decision); `prisma migrate status` unaffected.

## Committed on green

`api: observability sprint 1 — foundation`.
