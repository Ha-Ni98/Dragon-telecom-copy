# Sprint 4 Report — Repairs: Foundation (mapper, interface, factories)

**Set:** 07 (orders + repairs + statistics) · **Module:** repairs · **Layer:** foundation
**Status:** ✅ Done

---

## What was built

- **`src/modules/repairs/repairs.mapper.ts`** — `RepairsMapper` (static/pure):
  - `toRepairDto(repair: RepairRow, ctx: { includeMargins; now? })` — field-listed, `Decimal →
    number`, `Date → ISO`, Prisma `RepairStatus`/`ReportedIssue` cast to the contract enums.
    Margin-gated exactly like orders' `costOfGoods`/`profit`: `totalCost`/`totalProfit`
    (repair-level) and each part's `costOfGoods`/`profit` are omitted both when
    `includeMargins===false` (staff) **and** when the columns are still `null` (repair not yet
    COMPLETED) — both cases are `.optional()` on the DTO. `device` is assembled from
    independently-optional `brand`/`deviceModel`/`deviceLabel`/`deviceImei` refs (repairs has no
    catalog dependency in the plan — brand/model are inlined `{id;name}`, not imported types).
    `technician?` likewise. `reportedIssues` casts the raw `String[]` column to `ReportedIssue[]`.
    `parts[].serialNumbers` passes through as a **plain string** (unlike Order/SaleLine's
    comma-joined array — the contract's `RepairDto.parts[].serialNumbers` is `z.string()`, same
    precedent as purchasing's `SupplierInvoiceLine.serialNumbers`, so no conversion helper was
    needed here at all). `history[]` joins `staffName` from the row's own joined `Staff`;
    the intake marker row (`fromStatus===toStatus===INTAKE`, written at `createRepair` per
    §C-1) is **kept** in the surfaced history rather than filtered — decided it reads naturally
    as "ticket opened by X" in a timeline, per the plan's own suggested alternative. `ageHours`
    mirrors `InventoryMapper.ageHours`/`OrdersMapper.ageHours` exactly (public static, default
    `now` param).
  - `toPersistenceIntake(cmd, ctx: IntakeContext)` — `status: INTAKE`, every total at its
    schema default (0). **`ctx.customerName`/`customerPhone` are used in place of the
    command's own fields** — the service (Sprint 5) resolves these from the attached
    `PosClient` when `cmd.posClientId` is given (spec BL#1: "attaching a POS client prefills
    name/phone"), else passes the command's values through unchanged; the mapper never queries,
    matching the "supplied pre-resolved" precedent sales/purchasing established for their own
    draft contexts.
  - `toPartCreateInput(cmd, ctx)` — `lineTotal = unitPrice × quantity`; cost/profit stay
    unset until COMPLETED consumes the part via FIFO.
  - `ageHours(since, now?)` — public static helper, directly unit-tested.
- **`src/modules/repairs/repairs.interface.ts`** — `IRepairsService` with all six methods from
  plan §II.2. **Resolved the plan's `listRepairs` return-type hedge** (`PaginatedResult<RepairDto>
  | RepairDto[]`) concretely to plain `RepairDto[]`: `RepairListQuerySchema` carries only
  `status?`/`technicianId?` — no `page`/`limit` at all — matching the spec's own "board data"
  description (a bounded kanban view, not a paginated table). No listener-only method — repairs
  listens to nothing (contract confirmed).
- **Factories** (`test/data/`):
  - `repair.factory.ts` — `makeRepair(overrides)` (a plain `RepairRow` builder, reused by both
    this sprint's mapper spec and Sprint 5's service spec, same "one builder, both layers"
    precedent `order.factory.ts` established) and `seedRepair(options)` (real DB row for later
    integration; `Repair` has **no required FK relations at all**, so this needs no
    brand/technician/posClient setup unless a test wants one).
  - `create-repair.factory.ts` — `makeCreateRepairCommand(overrides)`.
  - `repair-part.factory.ts` — `makeRepairPart(overrides)` (an `AddRepairPartCommand` builder).
- **Test:** `test/unit/modules/repairs/repairs.mapper.spec.ts` (15 tests) — margin gating
  (staff omits, admin keeps, and admin also omits when the columns are still null
  pre-completion); device-ref assembly (brand/model/label/imei all independently optional,
  bare-repair case omits all four); technician surfaced only when linked; `reportedIssues`
  enum cast; `ageHours` derivation (24h fixture); history `staffName` join with the intake
  marker kept; `toPersistenceIntake`'s prefill-precedence (`ctx` wins over the command's own
  `customerName`/`customerPhone`) and optional-field inclusion; `toPartCreateInput`'s
  `lineTotal` computation and plain-string `serialNumbers` passthrough; a `.parse`
  never-throws guard.

## Deviations / clarifications (not blocking)

- **`listRepairs`'s return type** — settled `PaginatedResult<RepairDto> | RepairDto[]` down to
  `RepairDto[]` (see above) since the contract's own query schema has no pagination fields.
  Not a plan conflict — the plan explicitly hedged with "|" pending exactly this check.
- **History intake-marker kept, not filtered** — plan §D-1 offered both options ("filter... unless
  the team keeps it"); kept it, since dropping it would leave `PROCESSING→COMPLETED`+ as the
  *only* visible history for anyone browsing a repair's timeline, hiding who took the intake.

## Validation

- [x] `tsc --noEmit` clean.
- [x] `npm run test:unit` green — **554/554 tests, 38 files** (15 new repairs-mapper tests; no
  regressions elsewhere). `test:int` not run this sprint — no route wired yet (N/A per this
  sprint's own validation checklist).
- [x] `npm run lint` clean (`src test prisma`) — one `consistent-type-imports` finding
  (`ReportedIssue` imported as a value but only used as a type) caught and fixed before this
  report was written, not left for a later sprint.
- [x] Mapper pure/field-listing, excludes margins when gated, returns contract DTOs only; no
  route/DTO/enum re-declared (plan §0).
- [x] Committed on green.

## Next sprint

Sprint 5 — Repairs: Logic (service, **no listener** — repairs listens to nothing). `makeRepair`/
`makeCreateRepairCommand`/`makeRepairPart` are ready for its service spec.
