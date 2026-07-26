# PART 1 — BRIEF FOR THE PLANNING AGENT

You are planning fixes for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). Your job is **not to fix anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.

**You plan one set per session.** except for set 1 and 2, Do not attempt several sets at once: quality degrades as context fills, and these plans must name exact files, schemas, hooks, query keys and translation keys. Take the set named in your prompt, read what it touches, plan it, stop. 
Start planing Set 

## Codebase orientation
- Backend `Apps/api` — flow is `route → controller → service` and back.
- Frontend `Apps/web` — flow is `component → hook → service → backend` and back.
- Shared types and interfaces: `Apps/contract`.
- Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`.
- Implementation history, accepted decisions and known limitations: `Docs/Stage-02-Backend/results/` — read `report-audit-fixes.md` and `report-credit-serialization.md` before planning anything that touches money or stock.
- Plans already written for other sets: `Docs/Stage-04-Fixes/plans/`. Read any your set depends on.

## Hard rules
1. **No magic strings.** A value shared between front and back belongs in the contract package; a single-side type belongs in that side's `types` folder.
2. **All user-facing text goes through `t()`**, with keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text and validation messages.
3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
4. **Read the comments** in the code you touch and update any your change makes stale or wrong.
5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write that bypasses the owning module's service or its injected port (the `IInventoryService` and clients credit-port pattern).
6. **Money and stock caches** — `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, `paidAmount`, `quantityOnHand`, `quantityReserved` — are written **inside the owning transaction with a row lock**, never from an un-awaited event listener. This was corrected once already (see `report-credit-serialization.md`); do not reintroduce the pattern.
7. The database is **not in production**: prefer a correct schema plus a fresh migration over a compatible workaround.

## Method
1. **Read the code before planning.** Several issues describe a symptom whose cause lies in a shared component or a backend DTO, not on the page named. Part 2's cross-cutting table identifies these.
2. Fix the **root cause once**; list every symptom site to verify.
3. Write **numbered, file-scoped actions**: exact file path, what changes, resulting behavior, and the contract schema, hook, query key and translation keys involved. The executor should never have to guess a filename or invent a key.
4. Order the actions by dependency inside the set, and state at the top which other sets must land first.
5. For any contract or schema change, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
6. End each plan with a **manual verification checklist** — the browser steps the owner will follow, since no automated test will run.

## Raise questions rather than guessing
Stop and ask the owner when an issue would change the meaning of an existing money or stock figure, contradict a decision recorded in the project documentation, require a schema shape that isn't obvious from the text, or read as under-specified. The decisions listed at the top of Part 2 are **settled** — plan to them, don't re-open them.

## Output
One file per set: `Docs/Stage-04-Fixes/plans/plan-S<NN>-<slug>.md`.


# PART 2 — BRIEF FOR THE EXECUTING AGENT

## Execution protocol (state this at the end of every plan)
Start Set plan execution. After finishing writes `Docs/Stage-04-Fixes/results/report-S<NN>.md` describing what changed, ending with the **verification checklist**. I will reviews and approves before the next set begins.
