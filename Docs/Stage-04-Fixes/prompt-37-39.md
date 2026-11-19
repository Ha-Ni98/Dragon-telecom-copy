# Dragon Telecom — Fix Programme: Sets S37–S39 (storefront UI overhaul)

Three sets, derived from a UI audit of the public storefront. **Part 1** is the brief for the planning agent; **Part 2** is the sets.

**Standing context:** the app and database are **not in production** — test data only. Schemas may change and migrations be created freely, but **no data backfill or repair script is wanted**; corrected logic applies going forward.

---

# PART 1 — BRIEF FOR THE PLANNING AGENT

> You are planning work for **Dragon Telecom**, a phone spare-parts store management app (catalog, POS, inventory with FIFO costing, suppliers, online orders, repairs, invoicing, statistics). It has a public storefront, a client account area, and admin and staff back-offices. Your job is **not to implement anything** — it is to read the codebase and produce an **instruction-based execution plan** precise enough that a less powerful agent can execute it without re-deriving intent.
>
> **You plan one set per session.** Take the set , read what it touches, plan it, stop.
>
> ## Codebase orientation
> - Backend `Apps/api` — `route → controller → service` and back.
> - Frontend `Apps/web` — `component → hook → service → backend` and back.
> - Shared types and interfaces: `Apps/contract`.
> - Schema `Apps/api/prisma/schema.prisma`; conceptual model `Docs/Stage-00-Conception/database-description.md`; page specifications `Docs/Stage-00-Conception/pages/`.
> - Implementation history and accepted decisions: `Docs/Stage-02-Backend/results/` and `Docs/Stage-04-Fixes/results/`. **The earlier programme (S1–S36) is complete and merged** — read the relevant reports before assuming any behavior.
>
> ## Relevant state
> - The frontend uses **shadcn tokens** and supports **light and dark** themes.
> - i18n runs through `t()` with keys in `Apps/web/src/config/translation.json`. **Only French and English exist. Arabic is explicitly out of scope — do not build RTL support, `dir` switching, or Arabic keys.**
> - Uploads go through a shared **image pipeline** (sharp → WebP → Cloudflare R2) built in S26. Reuse it; do not add a second upload path.
> - Settings are key–value rows with a **storefront** section already holding featured products and featured families.
> - **Categories are `Family` rows** in this app (battery, display, charging connector…). `Family` has `iconUrl`, `parentId`, `isFeatured`; `Brand` has `logoUrl`.
> - The API runs on one **1GB shared-CPU Fly machine** with an external database — keep aggregation in SQL and never load an unbounded result set into memory.
>
> ## Explicitly out of scope — do not build these
> - **Promotions, discounts, sale prices, "compare at" prices.** No such concept exists in the data model and none is being added. Any audit language about promo pricing, discount badges or a "Promotions" section is void.
> - **A "recently viewed" row.**
> - **Arabic and right-to-left layout.**
>
> ## Hard rules
> 1. **No magic strings.** Shared front/back values live in the contract package; single-side types live in that side's `types` folder.
> 2. **All user-facing text through `t()`**, keys added to `Apps/web/src/config/translation.json` — including toasts, dialogs, table headers, helper text, validation messages, alt text and anything printed.
> 3. **Do not modify any test file. Do not run any test suite.** Validation is limited to TypeScript compile (`tsc --noEmit`), lint, and correctness of imports and syntax. The owner verifies behavior manually in the browser.
> 4. **Read the comments** in the code you touch and update any your change makes stale.
> 5. Respect the layering: no component calling a service directly, no business logic in controllers, no cross-module Prisma write bypassing the owning module's service or its injected port.
> 6. **No data backfills or corrective migrations.**
>
> ## Method
> 1. **Read the code before planning.** Where a set says "follow the pattern of X", read X first and describe that pattern concretely.
> 2. Write **numbered, file-scoped actions**: exact path, what changes, resulting behavior, and the contract schema, hook, query key, token name and translation keys involved.
> 3. Order actions by dependency inside the set; state at the top which sets must land first.
> 4. For contract or schema changes, spell out the migration and the full ripple: prisma → contract → mapper → service → hook → component.
> 5. End each plan with a **manual verification checklist** — the browser steps the owner will follow. For UI work the checklist must cover **both themes and both breakpoints** (phone and desktop), not just the default view.
>
> ## Raise questions rather than guessing
> Stop and ask when something would contradict a recorded decision, need a schema shape that isn't obvious, or read as under-specified.
>
> ## Output
> plan file of the set: `Docs/Stage-04-Fixes/plans/plan-S<NN>-<slug>.md`.
>
> ## Execution protocol (state at the end of every plan)
> Start Set execute. After finishing a set the executing writes `Docs/Stage-04-Fixes/results/report-S<NN>.md` describing what changed, ending with the **verification checklist**. I will reviews and approves before the next set begins.

---

