# PART 1 — BRIEF FOR THE PLANNING AGENT

You are planning fixes for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). Your job is **not to fix anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.

**You plan one set per session.** Take the set `xx` in @sets-19-21 , read what it touches, plan it, stop. Quality degrades as context fills, and these plans must name exact files, schemas, hooks, query keys and translation keys.

## Codebase orientation
- Don't read everything, if you want an information check this folders and read what necessary.
- Backend `Apps/api` — flow is `route → controller → service` and back.
- Frontend `Apps/web` — flow is `component → hook → service → backend` and back.
- Shared types and interfaces: `Apps/contract`.
- Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`; page specifications `Docs/Stage-00-Conception/pages/`.
- Implementation history and accepted decisions: `Docs/Stage-02-Backend/results/`.
- Plans already written for other sets: `Docs/Stage-04-Fixes/plans/`. Read any your set depends on.

## Hard rules
1. **No magic strings.** A value shared between front and back belongs in the contract package; a single-side type belongs in that side's `types` folder.
2. **All user-facing text goes through `t()`**, with keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text and validation messages.
3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
4. **Read the comments** in the code you touch and update any your change makes stale or wrong.
5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write that bypasses the owning module's service or its injected port.
6. **Money and stock caches** — `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, `paidAmount`, `quantityOnHand`, `quantityReserved` — are written **inside the owning transaction with a row lock**, never from an un-awaited event listener.
7. The database is **not in production**: prefer a correct schema plus a fresh migration over a compatible workaround.

## Method
1. **Read the code before planning.** Where an issue says "follow the pattern of X", read X first and describe the pattern concretely in your plan — the executor must not have to infer it.
2. Write **numbered, file-scoped actions**: exact file path, what changes, resulting behavior, and the contract schema, hook, query key and translation keys involved.
3. Order the actions by dependency inside the set, and state at the top which other sets must land first.
4. For any contract or schema change, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
5. End each plan with a **manual verification checklist** — the browser steps the owner will follow, since no automated test will run.

## Raise questions rather than guessing
Stop and ask the owner when an issue would change the meaning of an existing money or stock figure, contradict a recorded decision, require a schema shape that isn't obvious, or read as under-specified. **Part 2 ends with open decisions that must be resolved with the owner before the affected set is planned.**

## Output
One file per set: `Docs/Stage-04-Fixes/plans/plan-S<NN-<slug.md`.

## Execution protocol (state this at the end of every plan)
all your decision are confirmed, now start Set execute. After finishing a set the executing agent writes `Docs/Stage-04-Fixes/results/report-S<NN.md` describing what changed, ending with the **verification checklist**. I reviews and approves before the next set begins.

---
