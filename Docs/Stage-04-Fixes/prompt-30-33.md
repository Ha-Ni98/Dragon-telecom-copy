# Dragon Telecom — Fix Programme: Sets S30–S33

# BRIEF FOR THE PLANNING AGENT

You are planning work for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). Your job is **not to implement anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.

**Standing context:** the app and database are **not in production** — test data only. Schemas may change and migrations be created freely, but **no data backfill or repair script is wanted**; corrected logic applies going forward.

**You plan one set per session.** Take the set named in your prompt, read what it touches, plan it, stop.

## Codebase orientation
- Backend `Apps/api` — `route → controller → service` and back.
- Frontend `Apps/web` — `component → hook → service → backend` and back.
- Shared types and interfaces: `Apps/contract`.
- Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`; page specifications `Docs/Stage-00-Conception/pages/`.
- Implementation history and accepted decisions: `Docs/Stage-02-Backend/results/` and `Docs/Stage-04-Fixes/results/`. **The earlier programme (S1–S29) is complete and merged** — read the relevant reports before assuming any behavior.

## Semantics currently in force (do not plan against older behavior)
- **Repairs consume parts, issue an invoice (source `REPAIR`, no sale record) and recognise revenue at `PICKED_UP`.** Parts are only **reserved** from the moment they are added until then. A repair cancelled before pickup has consumed nothing.
- **Orders are multi-line** and consume stock, issue their invoice and recognise revenue at `COMPLETED`.
- **The client-payment ledger is the source of truth for `totalPaid`**; refunds are **negative-amount ledger rows**. Rows are never deleted.
- Costing is **FIFO**; `costOfGoods` and per-layer consumption rows are stored on every OUT movement. Restocked returns re-enter at the **consumed** cost.
- **`avgStockPrice`** (quantity-weighted) drives margins, adjustment defaults and stock valuation. **`avgPrice`** (unweighted) is maintained only from supplier invoices.
- Uploads go to **Cloudflare R2** through the shared image pipeline. The API runs on one **1GB shared-CPU Fly machine** with an external database and an ephemeral filesystem — avoid headless-browser stacks and never load an unbounded result set into memory.

## Hard rules
1. **No magic strings.** Shared front/back values live in the contract package; single-side types live in that side's `types` folder.
2. **All user-facing text through `t()`**, keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text, validation messages and anything printed.
3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
4. **Read the comments** in the code you touch and update any your change makes stale.
5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write bypassing the owning module's service or its injected port.
6. **Money and stock caches** — `credit`, `totalPaid`, `totalSold`, `totalInvoiced`, `paidAmount`, `quantityOnHand`, `quantityReserved`, `avgStockPrice` — are written **inside the owning transaction with a row lock**, never from an un-awaited event listener.
7. **No data backfills or corrective migrations.**

## Method
1. **Read the code before planning.** Where a set says "follow the pattern of X", read X first and describe that pattern concretely.
2. Write **numbered, file-scoped actions**: exact path, what changes, resulting behavior, and the contract schema, hook, query key and translation keys involved.
3. Order actions by dependency inside the set; state at the top which sets must land first.
4. For contract or schema changes, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
5. End each plan with a **manual verification checklist** — the browser steps the owner will follow. For anything touching stock or money, the checklist must include reading the movement ledger and the payments ledger afterwards to confirm the rows are what the plan intended.

## Raise questions rather than guessing
Stop and ask when something would change the meaning of an existing money or stock figure, contradict a recorded decision, need a schema shape that isn't obvious, or read as under-specified.

## Output
One file per set: `Docs/Stage-04-Fixes/plans/plan-S<NN>-<slug>.md`.

## Execution protocol (state at the end of every plan)
Sets execute **one at a time**. After finishing a set the executing agent writes `Docs/Stage-04-Fixes/results/report-S<NN>.md` describing what changed, ending with the **verification checklist**. The owner reviews and approves before the next set begins.

---

