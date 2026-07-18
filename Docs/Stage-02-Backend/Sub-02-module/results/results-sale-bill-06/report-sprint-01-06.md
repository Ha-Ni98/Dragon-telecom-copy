# Sales+Billing — Sprint 1 Report: Shared prerequisites & contract

**Status:** ✅ Done — [`sprints-sale-bill-06.md`](../sprints-sale-bill-06.md) Sprint 1 marked ✅.

---

## What was implemented

### Contract (`Apps/contract/src`)
- `modules/platform/platform.enums.ts` — added `DocType.RETURN` and `DocType.CLIENT_PAYMENT`
  (existing 10 members untouched). Plan §C-1.

### Seed defaults (`Apps/api/prisma/settings-defaults.ts`)
- `DEFAULT_INVOICING_PREFIXES` extended: `RETURN → 'RET'`, `CLIENT_PAYMENT → 'REG'` — checked
  against every existing prefix (`FAC`/`SAL`/`ORD`/`REP`/`SUP`/`ADJ`/`POS`/`CLI`/`FRN`/`PAY`), no
  collision. `DEFAULT_NEXT_SEQUENCES` picked both up automatically (`Object.values(DocType)`), and
  `prisma/seed.ts` derives `Setting` rows from `DEFAULT_SETTINGS` generically — no seed-script edit
  required (same as set 05's `SUPPLIER`/`SUPPLIER_PAYMENT` addition).

### Catalog (`Apps/api/src/modules/catalog/catalog.service.ts`)
Added one read method to `CatalogProductService`, reusing the existing field set (no new private
helper needed — this is a different resolution rule from `loadPriceMap`, not a reuse of it):
- `resolvePosPrices(productIds, categoryId): Promise<{ productId; productName; resolvedPrice? }[]>`
  — POS-tier `ProductPrice` row (attached POS client's category) else `Product.defaultSalePrice`,
  **never `guestPrice`** (that's the storefront-only fallback `resolvePricing` uses). Plain read,
  no `tx` — mirrors `getCostBasis`'s shape (plan §C-2).

**Two deliberate deviations from the sprint doc's literal wording, both noted so Sprint 2 lands
without a mismatch:**
1. **Method name:** the sprint 1 task line says `getPosPrices`; implemented as `resolvePosPrices`
   instead, to match the *plan's* own §C-2 name for `ICatalogPosPricingPort.resolvePosPrices`
   (the plan is the higher-authority document — the sprint line was a paraphrase). Structural
   typing needs the method **name** to match exactly, not just the shape, so Sprint 2's
   `ICatalogPosPricingPort` interface must declare `resolvePosPrices(...)` to be satisfied by this
   method with no adapter.
2. **`resolvedPrice` is optional (`resolvedPrice?: number`), not the plan's literal
   `resolvedPrice: number`.** `Product.defaultSalePrice` is genuinely nullable in the schema (a
   product can carry stock with no default price ever set — `catalog.createProduct`'s own
   conditional write confirms this), so a POS price can legitimately fail to resolve. Followed the
   established non-throwing precedent (`getRepriceCandidates`/`getCostBasis`, both plan-§C-3-era
   read ports that never throw and instead omit unresolved optional fields) rather than
   having catalog enforce a sales-only business rule. **Sales' Sprint 3 service must treat a
   missing `resolvedPrice` as its own domain error** (a POS line for an unpriced product), not
   assume the port always returns a number.

### Tests
- `test/unit/modules/catalog/catalog.service.spec.ts` — new `describe('resolvePosPrices')`
  (5 tests): empty-input short-circuit (no Prisma call); category `ProductPrice` row wins over
  `defaultSalePrice` when both exist; falls back to `defaultSalePrice` when no tier row exists;
  never queries `ProductPrice` when `categoryId` is `null` (goes straight to `defaultSalePrice`);
  omits `resolvedPrice` entirely when neither exists.
- `test/unit/modules/platform/platform.service.spec.ts` — new `SequenceService` test allocating
  `DocType.RETURN`/`DocType.CLIENT_PAYMENT` against the real `DEFAULT_SETTINGS` prefixes,
  confirming `RET-YYYY-0001`/`REG-YYYY-0001`. Written and run **before** the enum/seed edit (via
  vitest) to confirm it failed first (`TypeError: resolvePosPrices is not a function` /
  `'undefined-YYYY-0001'`), then made green by the implementation.
- `platform.mapper.spec.ts` and the contract conformance test needed **no changes** — same as set
  05, they derive expectations from `DEFAULT_SETTINGS`/`Object.values(DocType)` dynamically rather
  than hardcoding the key list.

---

## Validation

| Check | Result |
|---|---|
| `Apps/contract`: `npm run check` (`tsc --noEmit`) | ✅ clean |
| `Apps/contract`: `npm run test` (conformance) | ✅ 4/4 |
| `Apps/contract`: `npm run lint` | ✅ clean |
| `Apps/api`: `npx tsc --noEmit` | ✅ clean |
| `Apps/api`: `npm run test:unit` (`test/unit` + `test/contract`) | ✅ 405/405 (28 files) |
| `Apps/api`: `npm run lint` | ✅ clean |
| No route/DTO/enum re-declared that already existed — only the 2 `DocType` values are new (plan §C-1); `CREDIT_REQUIRES_CLIENT` adds no `ErrorCode` (plan §C-5, not touched this sprint — it's a Sprint 3 service concern) | ✅ |
| `npm run test:int` | not run — no `sales`/`billing` route exists yet; first applicable once a route is wired (Sprint 4/7), per the phase file's "once wired" gate |

---

## Notes for later sprints

- **Sprint 2** (sales foundation): declare `ICatalogPosPricingPort` in `sales.interface.ts` with a
  method literally named `resolvePosPrices(productIds: string[], categoryId: string | null)` typed
  against the real signature above (return type includes the optional `resolvedPrice?`).
- **Sprint 3** (sales logic): `confirm` must handle a line whose `resolvedPrice` came back
  `undefined` from the port — this is a legitimate state (unpriced product), not a bug; raise the
  appropriate 400 rather than assuming the port throws.
- **Sprint 4/7 wiring**: `catalogProductService` (already exported from `catalog.routes.ts`,
  unchanged this sprint) structurally satisfies `ICatalogPosPricingPort` — inject directly, no
  adapter, same as set 05's `getCartProducts`/`getRepriceCandidates` precedent.
- No `schema.prisma` changes this sprint (as the sprint doc anticipated) — every touched model
  already existed.

---

## Commit

`git add .` then `git commit -m "catalog/contract: sprint 1 — sales+billing prerequisites"`.
