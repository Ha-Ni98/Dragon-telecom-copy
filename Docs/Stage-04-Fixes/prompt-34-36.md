# Dragon Telecom — Fix Programme: Sets S34–S36

You are planning work for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). Your job is **not to implement anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.

**You plan one set per session.** read the sets-34-36 file and take the set named in your prompt, read what it touches, plan it, stop.

## Codebase orientation
- Backend `Apps/api` — `route → controller → service` and back.
- Frontend `Apps/web` — `component → hook → service → backend` and back.
- Shared types and interfaces: `Apps/contract`.
- Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`; page specifications `Docs/Stage-00-Conception/pages/`.
- Implementation history and accepted decisions: `Docs/Stage-02-Backend/results/` and `Docs/Stage-04-Fixes/results/`. **The earlier programme (S1–S33) is complete and merged** — read the relevant reports before assuming any behavior.

## Semantics currently in force (do not plan against older behavior)
- **Sales** are confirmed from a DRAFT; a confirmed sale consumes stock (FIFO), issues an invoice and stores `totalCost`/`totalProfit`.
- **Orders are multi-line** and consume stock, issue their invoice and recognise revenue at `COMPLETED`.
- **Repairs** consume parts, issue an invoice (source `REPAIR`, no sale record) and recognise revenue at `PICKED_UP`. A repair cancelled before pickup consumed nothing.
- **The client-payment ledger is the source of truth for `totalPaid`**; refunds and reversals are **negative-amount ledger rows**. Rows are never deleted. A payment may be linked to an invoice or stand alone (`invoiceId` null, "on account"); the same is true of supplier payments.
- **Two client identities:** `Client` is the web identity (registration, orders, browsing); `PosClient` is the commercial identity (category, credit, sales, payments). Every approved web client has exactly one linked POS client; walk-in POS clients have no web account.
- **Margins are admin-only.** Cost and profit are stripped **in the mapper**, not hidden in the component.
- Costing is **FIFO**; `costOfGoods` and per-layer consumption rows are stored on every OUT movement.
- The API runs on one **1GB shared-CPU Fly machine** with an external database — keep aggregation in SQL and never load an unbounded result set into memory.

## Hard rules
1. **No magic strings.** Shared front/back values live in the contract package; single-side types live in that side's `types` folder.
2. **All user-facing text through `t()`**, keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text and validation messages.
3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
4. **Read the comments** in the code you touch and update any your change makes stale.
5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write bypassing the owning module's service or its injected port.
6. **Money and stock caches** — `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, `paidAmount`, `quantityOnHand`, `quantityReserved`, `avgStockPrice` — are written **inside the owning transaction with a row lock**, never from an un-awaited event listener.
7. **No data backfills or corrective migrations.**

## Method
1. **Read the code before planning.** Two of these sets begin with a diagnosis: do not plan a fix until you have found the actual cause in the code.
2. Write **numbered, file-scoped actions**: exact path, what changes, resulting behavior, and the contract schema, hook, query key and translation keys involved.
3. Order actions by dependency inside the set; state at the top which sets must land first.
4. For contract or schema changes, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
5. End each plan with a **manual verification checklist** — the browser steps the owner will follow. For anything reporting money, the checklist must include cross-checking a figure against the underlying documents, not just confirming that a number renders.

## Raise questions rather than guessing
Stop and ask when something would change the meaning of an existing money or stock figure, contradict a recorded decision, need a schema shape that isn't obvious, or read as under-specified.

## Output
One file per set: `Docs/Stage-04-Fixes/plans/plan-S<NN>-<slug>.md`.

## Execution protocol (state at the end of every plan)
Sets execute **one at a time**. After finishing a set write writes `Docs/Stage-04-Fixes/results/report-S<NN>.md` describing what changed, ending with the **verification checklist**. I will reviews and approves before the next set begins.

---

