# Clients+Purchasing — Sprint 2 Report: Clients — Foundation (mapper, interface, factories)

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 2 marked ✅.

---

## What was implemented

### Contract (`Apps/contract/src/modules/clients/clients.query.ts`)
- Added `PosClientListQuerySchema`/`PosClientListQuery` (`{ search?; isEnabled?; page; limit }`,
  mirroring `AdminClientListQuerySchema`'s shape). **Discovered gap**, same category as Sprint 1's
  `ClientStatsDto`/`ValidatePhoneSchema`: `POS_CLIENT_ROUTES.ADMIN`'s GET (list) has no query
  schema anywhere in the spec — plan §I.2 even left `listPosClients(query)` untyped as a visible
  placeholder. Confirmed absent (`select:PosClient` grep) before adding, per the standing
  "confirm it doesn't already exist" rule.

### `Apps/api/src/modules/clients/clients.mapper.ts`
Six static methods, each field-listing (never spreads) and ending in a `…ResponseSchema.parse(dto)`
conformance guard:
- `toValidatePhoneDto(isValid, status)` — pure assemble+parse. The phone-shape/registration
  *lookup* that produces these two values is business logic deferred to the service (Sprint 3);
  the mapper only shapes the already-computed result (rules §3: mappers are pure, no logic).
- `toClientMeDto(client: ClientMeRow)` — **no `category`, no raw `status`** (spec); money
  (`credit`/`totalPaid`/`totalSold`) proxied from the linked `PosClient`, defaulting to `0` when
  none is linked yet (still `PENDING`). `Decimal→number`, `Date→ISO`.
- `toAdminClientDto(client: AdminClientRow, rollups: AdminClientRollups)` — `fullName` composed
  from `firstName`+`lastName`; `wilayaFr`/`communeFr` from the `Wilaya`/`Commune` relations'
  `frName` column; `categoryName` from `posClient.category.name`; raw `ClientStatus` passthrough
  (admin view, unlike `ClientMeDto`); `totalOrders`/`totalSpent`/`lastOrderDate` passed in by the
  caller as `rollups` — Order/Sale aren't Prisma relations this mapper can include (those modules
  don't exist yet, plan §I.3 #7), so the aggregate query is the service's job, not the mapper's.
- `toPosClientDto(posClient: PosClientRow)` — `Decimal→number`; `categoryName` from the category
  relation; `linkedClientId` from the `linkedClient` back-relation.
- `toCartItemDto(cartItem, product: ProductWithPricingDto)` — assembles `{ productId, addedAt(ISO),
  product }`; `product` is supplied pre-resolved (catalog's `getCartProducts` read port, Sprint 1)
  and never rebuilt here.
- `toClientStatsDto(counts)` — straight assemble+parse for the four counters.

Row types (`ClientMeRow`, `AdminClientRow`, `PosClientRow`) are exported alongside the mapper so
Sprint 3's Prisma queries know exactly which `include`/`select` shape to produce.

### `Apps/api/src/modules/clients/clients.interface.ts`
- `IClientsService` — every method from plan §I.2, typed against real contract DTOs/Commands
  (including `ClientStatsDto`/`PosClientListQuery` added above). Two adjustments discovered while
  writing it against the actual Prisma schema:
  - **`rejectClient(id, cmd)` — no `staffId` parameter.** `Client` has `rejectionReason` but no
    `rejectedByStaffId` column (unlike `approveClient`'s `approvedByStaffId`), so there is nowhere
    to persist it. Dropped rather than accepting a parameter the service could never use.
  - **No activity-read port at all** (a plan §I.5 simplification). Re-checked the observability
    contract: `OBSERVABILITY_ROUTES.CLIENT_ACTIVITY = '/admin/clients/:id/activity'` **already
    exists as its own fully-specified, already-implemented route** (own DTO/query/params,
    `observability.routes.ts` already mounts it — observability module is DONE per memory). The
    plan's "`ADMIN_DETAIL` + `/activity` (observability read)" was read too literally as a
    clients-owned sub-resource; it is not — the frontend calls observability's route directly,
    clients needs nothing extra for it. Simpler than planned, not a deviation from the rules.
- `ICatalogCartPort { getCartProducts(productIds, viewer) }` — consumer-side port (Sprint 1's
  `CatalogProductService.getCartProducts` satisfies it structurally), mirroring the existing
  `ICatalogPricingPort`-in-`inventory.interface.ts` precedent.
- `IIdentityProvisioningPort { provisionClientUser(input, tx); resetPassword(userId, newPassword, tx?) }`
  — narrowed to the two methods `approveClient`/`resetClientPassword` actually need, not
  identity's whole 13-method surface. **Clarified (not a new identity change):**
  `changeMyPassword`'s "verify currentPassword" step does **not** go through this port at all — it
  will read the linked `User.passwordHash` directly via the shared `prisma` singleton (the same
  cross-module-read precedent identity's own `resolveLoginUser` already uses for `Client` rows)
  and compare it with the shared `@common/utils/password.utils` (genuinely common infra, not an
  identity-owned internal — identity itself imports it the same way). Only the state-changing
  write (new hash + refresh-token revocation) goes through `resetPassword`. This avoids adding a
  speculative `verifyPassword` method to `IIdentityService` for a single narrow caller.

### Factories (`Apps/api/test/data/client-cart.factory.ts`)
- `seedClientCartItem(clientId, productId, options?)` — persistence-only (no `CreateXxxCommand`
  counterpart exists: `AddCartItemCommand` only carries `productId`, `clientId` comes from the
  authenticated viewer, not the body — same shape-mismatch precedent as
  `stock-movement.factory.ts`). `client.factory.ts`, `pos-client.factory.ts`,
  `client-category.factory.ts`, `client-activity.factory.ts`, `wilaya.factory.ts`,
  `product.factory.ts`, `product-price.factory.ts` all reused as-is — no changes needed.

### Tests (`Apps/api/test/unit/modules/clients/clients.mapper.spec.ts`)
18 tests, written before the mapper implementation (test-first): `toValidatePhoneDto`'s three
statuses; `toClientMeDto`'s field-exclusion (`status`/`category` absent), `Decimal→number`,
`0`-default with no linked `PosClient`, `Date→ISO`, optional-field omit/include; `toAdminClientDto`'s
`fullName` composition, `wilayaFr`/`communeFr`, raw-status passthrough, optional-field
include/omit, roll-up passthrough; `toPosClientDto`'s `Decimal→number` (incl. a negative credit)
and optional-field include/omit; `toCartItemDto`'s exact assembly; `toClientStatsDto`'s
passthrough.

---

## Validation

| Check | Result |
|---|---|
| `Apps/contract`: `npm run validate` (check + cycles + lint + test) | ✅ clean / no cycles / 4/4 |
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 318/318 (23 files, 18 new) |
| `Apps/api`: `npm run lint` | ✅ clean (one `consistent-type-imports` finding on the mapper's `@prisma/client` import, fixed by merging into a single `import type`) |
| Mapper excludes sensitive fields (lists returned fields, no spread); returns contract DTOs only | ✅ |
| No route/DTO/enum re-declared that already existed; the one addition (`PosClientListQuerySchema`) is a genuine, confirmed-absent gap | ✅ |

`npm run test:int` not run — no route is wired yet (first applicable in Sprint 4, per the phase
file's "once wired" gate). No service logic in this sprint — `clients.service.ts` does not exist
yet.

---

## Notes for later sprints

- **Sprint 3** (`ClientsService`) owns: the phone-shape/registration-status computation feeding
  `toValidatePhoneDto`; the Order/Sale roll-up aggregate query feeding `toAdminClientDto`'s
  `rollups` param (both tables have no rows yet — future modules — so this reads `0`/`undefined`
  safely today); the `changeMyPassword` direct-`User.passwordHash`-read + shared-util-compare
  flow described above; and the `Prisma` query `include`/`select` shapes matching `ClientMeRow`/
  `AdminClientRow`/`PosClientRow` exactly.
- **Sprint 4** (wiring) injects the real `ICatalogCartPort` adapter (`catalogProductService.getCartProducts`)
  and `IIdentityProvisioningPort` adapter (the `identityService` singleton, which already
  satisfies this port's two methods structurally — no adapter shim needed, unlike inventory's
  positional-args `inventoryPortAdapter`) at the `modules/index.ts` extension point.
- No `IClientActivityPort` will be built — `ADMIN_DETAIL`'s "+ `/activity`" is served entirely by
  observability's own already-mounted route.

---

## Commit

`git add .` then `git commit -m "clients: sprint 2 — foundation (mapper, interface, factories)"`.
