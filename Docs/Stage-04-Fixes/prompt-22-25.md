# PART 1 — BRIEF FOR THE PLANNING AGENT

You are planning work for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). Your job is **not to implement anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.

**You plan one set per session.** Take the set named in your prompt, read what it touches, plan it, stop.

**Two of these sets are audits and behave differently — read their instructions carefully.** An audit set produces a *findings report*, not a fix. It stops for the owner's decisions, and the fix plan is written afterwards.

## Codebase orientation
- Backend `Apps/api` — flow is `route → controller → service` and back.
- Frontend `Apps/web` — flow is `component → hook → service → backend` and back.
- Shared types and interfaces: `Apps/contract`.
- Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`; page specifications `Docs/Stage-00-Conception/pages/`.
- Implementation history and accepted decisions: `Docs/Stage-02-Backend/results/` and `Docs/Stage-04-Fixes/results/`. **The whole of the earlier fix programme (S1–S21) is complete and merged** — read those reports before assuming any behavior, because several semantics changed late.

## Semantics currently in force (do not plan against older behavior)
- Orders are **multi-line**; an order **consumes stock, issues its invoice and recognises revenue at `COMPLETED`**. Quantities stay reserved through every earlier state.
- Repairs **consume parts, issue an invoice (source `REPAIR`, no sale record) and recognise revenue at `PICKED_UP`**. Parts stay reserved until then.
- The **client-payment ledger is the source of truth for `totalPaid`**; refunds are negative-amount ledger rows.
- Costing is **FIFO**: every OUT consumes specific layers, and `costOfGoods` plus per-layer consumption rows are stored on the movement.
- **`avgStockPrice`** (quantity-weighted) drives margin displays, adjustment defaults and stock valuation. **`avgPrice`** (unweighted) is maintained **only from supplier invoices** and shown only in the supplier-invoice context.

## Hard rules
1. **No magic strings.** Shared front/back values live in the contract package; single-side types live in that side's `types` folder.
2. **All user-facing text through `t()`**, keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text and validation messages.
3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
4. **Read the comments** in the code you touch and update any your change makes stale.
5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write that bypasses the owning module's service or its injected port.
6. **Money and stock caches** — `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, `paidAmount`, `quantityOnHand`, `quantityReserved`, `avgStockPrice` — are written **inside the owning transaction with a row lock**, never from an un-awaited event listener.
7. **Do not write data backfills, repair scripts or one-off corrective migrations.** The data is disposable test data; corrected logic applies from the next movement onward.

## Method
1. **Read the code before planning.** Where an issue says "follow the pattern of X", read X first and describe that pattern concretely — the executor must not infer it.
2. Write **numbered, file-scoped actions**: exact path, what changes, resulting behavior, and the contract schema, hook, query key and translation keys involved.
3. Order actions by dependency inside the set; state at the top which sets must land first.
4. For contract or schema changes, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
5. End each plan with a **manual verification checklist** — the browser steps the owner will follow.

## Raise questions rather than guessing
Stop and ask when something would change the meaning of an existing money or stock figure, contradict a recorded decision, need a schema shape that isn't obvious, or read as under-specified. 
Stop if you found any conflict, assumptions or need more clarfication before proceed.

## Output
Feature sets: `Docs/Stage-04-Fixes/plans/plan-S<NN-<slug.md`.
Audit sets: `Docs/Stage-04-Fixes/results/findings-S<NN-<slug.md` (see each audit set for its required shape).

## Execution protocol (state this at the end of every plan)
Sets execute **one at a time**. After finishing a set the executing agent writes `Docs/Stage-04-Fixes/results/report-S<NN.md` describing what changed, ending with the **verification checklist**. The owner reviews and approves before the next set begins.

---
