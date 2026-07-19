# Clients+Purchasing — Sprint 1 Report: Shared prerequisites & contract

**Status:** ✅ Done — [`sprints-client-purs-05.md`](../sprints-client-purs-05.md) Sprint 1 marked ✅.

---

## What was implemented

### Contract (`Apps/contract/src`)
- `modules/platform/platform.enums.ts` — added `DocType.SUPPLIER` and `DocType.SUPPLIER_PAYMENT`
  (existing `SUPPLIER_INVOICE`/`CLIENT`/`POS_CLIENT` untouched).
- `modules/clients/clients.dtos.ts` — added `ClientStatsResponseSchema`/`ClientStatsDto`
  (`{ totalClients; pending; approved; rejected }`) for `ADMIN_STATS`, which had no field list in
  the spec beyond the route note.
- `modules/clients/clients.command.ts` — added `ValidatePhoneSchema`/`ValidatePhoneCommand`
  (`{ phone }`) for `VALIDATE_PHONE`'s request body, likewise unnamed in the spec.
- Both barrels already re-export their module (`export *`), so no barrel edits were needed.

### Seed defaults (`Apps/api/prisma/settings-defaults.ts`)
- `DEFAULT_INVOICING_PREFIXES` extended: `SUPPLIER → 'FRN'`, `SUPPLIER_PAYMENT → 'PAY'` (`'SUP'` was
  already taken by `SUPPLIER_INVOICE`). `DEFAULT_NEXT_SEQUENCES` picked both up automatically
  (`Object.values(DocType)`), and `prisma/seed.ts` derives `Setting` rows from `DEFAULT_SETTINGS`
  generically — no seed-script edit required.

### Identity (`Apps/api/src/modules/identity`)
- `identity.interface.ts` — added `provisionClientUser(input: { username; password }, tx): Promise<{ userId: string }>`
  to `IIdentityService`. **Deviation from the sprint doc:** dropped the `clientId` field from
  `input`. Identity has no use for it — `Client.userId` is the FK (set by the *clients* module
  after this call returns), and `User` carries no `clientId` column; a Prisma `Client` back-relation
  is populated automatically once `Client.userId` is set elsewhere. Keeping an unused parameter
  would either sit dead in the method body or need an eslint `_`-prefix escape hatch for no
  behavioural gain, so it was omitted. `{ username, password }` fully captures what
  `ApproveClientCommand` supplies.
- `identity.service.ts` — implemented `provisionClientUser`: hashes via the existing
  `hashPassword` (Argon2id), creates a bare `type: CLIENT` `User` row (no `Staff` create block),
  maps `P2002` → `ConflictError`, emits nothing (mirrors `createUser`'s tx-aware emit-only-when-
  owning-the-write rule — the caller emits post-commit).
- `identity.routes.ts` — exported the composition-root singleton: `export const identityService = service;`,
  so `modules/index.ts` can inject the same instance into clients' `routes.ts` rather than
  constructing a second `IdentityService`.

### Catalog (`Apps/api/src/modules/catalog/catalog.service.ts`)
Added three read methods to `CatalogProductService`, all reusing existing private helpers
(`resolveViewerContext`/`loadPriceMap`/`loadCartSet`/`resolvePricing`) rather than duplicating
pricing logic:
- `getCartProducts(productIds, viewer): Promise<ProductWithPricingDto[]>` — an id-set counterpart
  to `listProducts`, same per-viewer price resolution, no `isEnabled`/`isPublished` filter (a
  favorited product staying visible in the cart even once disabled/unpublished is the safer
  default — silently dropping it would look like data loss to the client).
- `getRepriceCandidates(tx, productIds)` — runs through the **caller's tx** (purchasing's confirm
  transaction) so it observes each line's post-`addLayer` `averageCost` before that transaction
  commits, matching the spec's reprice-prompt requirement. Returns the exact inline shape
  `ConfirmResultDto.repriceCandidates` needs.
- `getCostBasis(productIds)` — plain read (no tx) for purchasing's DRAFT-read
  `projectedNewAverageCost` projection: `{ productId; name; averageCost; quantityOnHand }[]`.

**Deviation from the sprint doc's literal wording** ("Expose via named port interfaces
`ICatalogCartPort` / `ICatalogRepricePort` on the catalog side"): the port *interfaces* were **not**
declared in `catalog.interface.ts` this sprint. Followed the codebase's existing precedent instead
— `ICatalogPricingPort` (the structurally-identical case: inventory's adjustment flow needs
`applyPricing` from catalog) is declared in **`inventory.interface.ts`** (the consumer), not
`catalog.interface.ts` (the provider); catalog satisfies it structurally without an `implements`
clause. `ICatalogCartPort`/`ICatalogRepricePort` will be declared the same way, in
`clients.interface.ts` (Sprint 2) and `purchasing.interface.ts` (Sprint 5) respectively — which is
also what those two sprints' own task lines already call "consumer-side typing." Sprint 1 therefore
ships only the concrete methods; the interfaces land with their consumers.

### Tests
- `test/unit/modules/identity/identity.service.spec.ts` — new `describe('provisionClientUser')`:
  creates a CLIENT user with no `staff` key in the write, hashes the password, honours the passed
  `tx`, emits nothing, maps `P2002` → `ConflictError` (409).
- `test/unit/modules/catalog/catalog.service.spec.ts` — new `describe` blocks for all three
  methods: empty-input short-circuit (no Prisma call), per-viewer pricing match for
  `getCartProducts`, full shape assertion (guestPrice/defaultSalePrice/categoryPrices) for
  `getRepriceCandidates`, and the plain projection for `getCostBasis`.
- `test/unit/modules/platform/platform.service.spec.ts` — new `SequenceService` test allocating
  `DocType.SUPPLIER`/`DocType.SUPPLIER_PAYMENT` against the real `DEFAULT_SETTINGS` prefixes,
  confirming `FRN-YYYY-0001`/`PAY-YYYY-0001`.
- `platform.mapper.spec.ts` and the existing seeded-settings tests needed **no changes** — they
  already derive expectations from `DEFAULT_SETTINGS` dynamically rather than hardcoding the
  `DocType` key list, so the two new keys flow through for free.

---

## Validation

| Check | Result |
|---|---|
| `Apps/contract`: `npm run check` (`tsc --noEmit`) | ✅ clean |
| `Apps/contract`: `npm run test` (conformance) | ✅ 4/4 |
| `Apps/contract`: `npm run lint` | ✅ clean |
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 300/300 (22 files) |
| `Apps/api`: `npm run lint` | ✅ clean |
| No route/DTO/enum re-declared that already existed — only the 2 `DocType` values +
  `ClientStatsDto` + `ValidatePhoneSchema` are new (plan §0/§D-1) | ✅ |
| `npm run test:int` | not run — no `clients`/`purchasing` route exists yet; first applicable once a route is wired (Sprint 4/7), per the phase file's "once wired" gate |

---

## Notes for later sprints

- **Sprint 2** (clients foundation): declare `ICatalogCartPort` in `clients.interface.ts` (typed
  against `getCartProducts`'s real signature above), plus the identity port typing
  (`provisionClientUser`/`resetPassword`) and an observability activity-read port.
- **Sprint 5** (purchasing foundation): declare `ICatalogRepricePort` in `purchasing.interface.ts`
  (typed against `getRepriceCandidates`/`getCostBasis` above).
- **Sprint 4/7 wiring**: inject `identityService` (from `identity.routes.ts`) and
  `catalogProductService` (already exported from `catalog.routes.ts`, unchanged this sprint) into
  the respective composition roots at the `modules/index.ts` extension point.
- No `schema.prisma` changes this sprint (as the sprint doc anticipated) — every touched model
  already existed.

---

## Commit

`git add .` then `git commit -m "identity/catalog/contract: sprint 1 — clients+purchasing prerequisites"`.
