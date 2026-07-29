# Sprint 6 — Repairs & Billing

**Status:** ✅ Complete

## What was created / changed

- **`Apps/contract/src/modules/repairs/`** — new module, 6 content files + barrel (plan H / spec `repairs.md`):
  - `repairs.enums.ts` — `RepairStatus`, `ReportedIssue` (9 lowercase values, including the hyphenated `water-damage`).
  - `repairs.routes.ts` — `REPAIR_ROUTES` (12 constants; every route split into `STAFF_*`/`ADMIN_*` pairs — the spec's `LIST`/`CREATE` rows carry the `(staff|admin)` prefix explicitly, and `UPDATE`/`PARTS`/`STATUS` continue it via `"..."` elision).
  - `repairs.command.ts` — `CreateRepairCommand`, `UpdateRepairCommand`, `AddRepairPartCommand`, `RepairStatusCommand`.
  - `repairs.query.ts` — `RepairListQuery`, `RepairIdParams`, `RepairPartParams`.
  - `repairs.dtos.ts` — `RepairDto` (device brand/model inlined as `{id;name}` refs; `totalCost`/`totalProfit`/part `costOfGoods`/`profit` mapping-gated `.optional()`).
  - `repairs.events.ts` — `RepairsEvents` map: `repair.pickedUp` (explicit payload), `repair.statusChanged`, `repair.cancelled` (both inferred).
  - `index.ts` barrel.
- **`Apps/contract/src/modules/billing/`** — new module, 6 content files + barrel (plan I / spec `billing.md`):
  - `billing.enums.ts` — `InvoiceStatus`, `InvoiceSource` (only `SALE`/`ORDER` — never `REPAIR`, per spec).
  - `billing.routes.ts` — `BILLING_ROUTES` (13 constants; each `(/:number)(/pdf)` row expanded into three literal paths, `CLIENT_PAYMENTS` split for its `(staff|admin)` dual mount).
  - `billing.command.ts` — `CancelInvoiceCommand`, `CreateClientPaymentCommand`.
  - `billing.query.ts` — `InvoiceListQuery` (spec's terse `client?` filter renamed `posClientId` to match the FK name used everywhere else in the contract), `ClientPaymentListQuery`, `InvoiceNumberParams`.
  - `billing.dtos.ts` — `InvoiceDto` (`totalCost`/`totalProfit`/line `costSnapshot`/`profit`/`currentAverageCost` mapping-gated `.optional()`), `ClientPaymentDto`.
  - `billing.events.ts` — `BillingEvents` map: `invoice.issued`, `invoice.cancelled` (both inferred), `payment.clientRecorded` (explicit).
  - `index.ts` barrel.
- **`Apps/contract/src/index.ts`** — added `export * from './modules/repairs'` and `export * from './modules/billing'`.

## Decisions on spec ambiguity (non-blocking — trivial per rules §0, not stopped-for)

1. **`REPAIR_ROUTES` route-splitting extends the pattern to elided prefixes.** Unlike Sprints 5–6's other dual-mount routes (which always spelled out `(staff|admin)` per row), `repairs.md`'s `UPDATE`/`PARTS`/`STATUS` rows write the path as `.../repairs/:id` — the leading `(staff|admin)` prefix is implied by continuity from the `LIST`/`CREATE` rows above them, not re-stated. Read as the same dual-mount pattern and split accordingly, consistent with every other route in this contract holding exactly one literal path per constant.
2. **`ReportedIssueOther` is not required-if-`other`-selected.** Business Logic #4 says `other` "unlocks free text," which is weaker than "requires" — no refine was added forcing `reportedIssueOther` when `ReportedIssue.OTHER` is present, since the spec doesn't state that constraint explicitly (only that the field becomes meaningful, not mandatory).
3. **`InvoiceListQuery`'s `client?` filter renamed to `posClientId`.** The spec's inline type block uses the bare shorthand `client?`; since every other query/DTO field in the contract that references a POS client uses the `posClientId` name (matching the schema's actual FK), the filter was named consistently rather than literally as `client`.
4. **Several event payloads inferred** (`repair.statusChanged`, `repair.cancelled`, `invoice.issued`, `invoice.cancelled`) — same pattern as every prior sprint; only `repair.pickedUp` and `payment.clientRecorded` have explicit payloads in their respective specs.
5. **`repairs.dtos.ts` device.brand/model inlined as `{id;name}`**, not imported from `catalog.BrandDto`/`DeviceModelDto` — the plan documents no `repairs → catalog` dependency edge, and a lightweight nested ref matches the pattern already used for `orders.dtos.ts`'s inlined wilaya/commune.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `madge --circular --extensions ts src` | ✅ no circular dependency (75 files processed) |
| `eslint src` | ✅ clean |
| `tsx --test` (conformance suite) | ✅ 4/4 passing (unchanged — no new tests added, out of scope) |
| Every type `z.infer`'d, no `any`, ISO dates | ✅ — `intakeAt`/`completedAt`/`pickedUpAt`/`changedAt`/`issuedAt`/`paidAt` all `z.iso.datetime()`; `InvoiceListQuery.from/to`/`dueDate` use `z.iso.date()` |
| No sensitive field in any DTO | ✅ — grep for `password`/`passwordHash`/`tokenHash` across both modules' DTOs returns no matches (neither module touches credentials) |
| No business logic / DB / Express imports | ✅ |
| 6-file-max per module | ✅ — both modules: 6 content files + `index.ts` |

## Commit

Committed on green as `contract: sprint 6 — repairs & billing`.
