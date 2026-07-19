# Observability — Sprint O2 Report: Logic A (the sink service)

**Status:** ✅ Done — [`sprints-obser-plat-02.md`](../sprints-obser-plat-02.md) Sprint O2 marked ✅.

---

## What was built

`src/modules/observability/observability.service.ts` — `class ObservabilityService implements
IObservabilityService`, `constructor(prisma)`:

- **Beacons (append-only):** `recordClientActivity`, `recordStaffSearch`, `recordProductSearched`
  — each a single `create()`, optional fields spread in only when present.
- **`recordAuditEvent`** — idempotent per the Sprint O1 decision (existence check on
  `actionType`/`entityType`/`entityId`/`description`), with the `alwaysAppend` refinement (see
  below).
- **Reads:** `getClientActivity` (filters `type`/date range, joins `product`, newest first),
  `listStaffSearches` (filters `userId`/date range/`q` as `description`-style `contains` on
  `query`, joins `user`+`matchedProduct`), `listLogs` (filters `actionType`/`userId`/`search`
  as `contains` on `description`/date range, **paginated** via `paginated(AuditLogResponseSchema)`,
  20/page), `getLogStats` (four `count()` windows: total/today/week/month).
- A shared private `dateRangeFilter(from?, to?)` helper, since the same `{gte,lte}` construction
  was needed in three read methods.

`test/unit/modules/observability/observability.service.spec.ts` — 12 tests, written before the
implementation.

**Emits nothing** — confirmed by the interface having no dependency on `eventBus` at all in this
file (only Sprint O3's listener will import it).

---

## A refinement discovered while implementing `recordAuditEvent` — `alwaysAppend`

Sprint O1's zero-schema idempotency decision (existence check on `(actionType, entityType,
entityId, description)`) has a real gap for **inherently-repeatable** events: `auth.loggedIn`'s
narration is something like `"logged in (staff)"` — a user logging in **twice** produces the
**same** four-tuple both times, so the existence check would incorrectly treat the second, entirely
legitimate login as a "replay" and silently drop it. The plan's original `eventKey`-based design
(§8.1) handled this by setting `eventKey = null` for such events (bypassing the unique-key upsert
entirely, always appending); the zero-schema equivalent needed the same escape hatch.

**Fix:** added `alwaysAppend?: boolean` to `AuditEntry` (in `observability.interface.ts`, which
Sprint O1 wrote). When set, `recordAuditEvent` skips the existence check unconditionally and always
inserts. Sprint O3's listener will set this for `auth.loggedIn` and any other event whose narration
has no natural before/after state to vary between genuinely distinct occurrences. Documented inline
in the interface (updated in this sprint, not a new file) and covered by a dedicated test
(`'always appends ... when alwaysAppend is set, even if a matching row exists'`).

---

## Validation

- `npx tsc --noEmit` — clean.
- `npm run lint` — one real finding fixed: `ClientActivityType as PrismaClientActivityType` was
  imported as a value but only ever used in `as` type-assertion position → `import type`.
- `npm run test:unit` — green, **156/156** tests, 17 files (144 prior + 12 new).
- Append-only: no `update`/`delete` call appears anywhere in this file. `select`/`include` scoped
  to exactly what `ObservabilityMapper` needs (`product`, `user`+`matchedProduct`, `user`). `listLogs`
  returns via `paginated(AuditLogResponseSchema).parse(...)`; every other read maps through
  `ObservabilityMapper`, never returning a raw Prisma entity.

## Committed on green

`api: observability sprint 2 — sink service`.
