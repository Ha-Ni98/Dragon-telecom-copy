# Workflow Overview

A contract-first, spec-driven pipeline for building a full-stack TypeScript app with an AI agent as the executor. Work flows in one direction — **Stage 0 (you) → Stage 1 Contract → Stage 2 Backend → Stage 3 Frontend** — and everything downstream is bound to a single shared contract.

This file is the entry point. Read it first; it states the conventions that hold everywhere so the per-stage files don't have to repeat them.

---

## 1. The Big Picture

```text
Stage 0  CONCEPTION (human)      → schema, module specs, page requirements
   │
Stage 1  CONTRACT  (agent)       → Apps/contract   (@app-template/contract)
   │                                the single source of truth
   ├──────────────┐
Stage 2 BACKEND    Stage 3 FRONTEND  (both consume the contract)
 Apps/api          Apps/web
```

The contract is the hub. The backend implements it; the frontend calls it; both import types and routes from `@app-template/contract` and never redefine them.

### Repository layout

```text
<repo>/
├── Apps/
│   ├── contract/                 # Stage 1 output — @app-template/contract
│   ├── api/                      # Stage 2 — backend (has prisma/, src/, test/)
│   └── web/                      # Stage 3 — frontend (FE rule paths are relative to here: src/, tests/)
└── Docs/
    ├── Stage-00-Conception/
    │   ├── Module-Contracts/     # Stage 0 — one full-lifecycle spec per module (shared input)
    │   └── Pages-Requirements/   # Stage 0 — one requirement file per page
    ├── Stage-01-Contract/        # rules + phase files + prompts (+ results/ when you run it)
    ├── Stage-02-Backend/
    │   ├── Sub-01-init/
    │   └── Sub-02-module/
    └── Stage-03-Frontend/
        ├── Sub-01-Refactor/
        ├── Sub-02-Integration/
        └── Sub-03-pages/
```

Per-run outputs (`plan.md`, `sprints.md`, per-sprint reports) live in a `results/` folder under each stage/substage. The template ships with those folders removed — they are yours to generate.

### Starting from the template

This repo **is** the template, so most of the pipeline is already built. Pre-built:

- **Contract:** the package scaffold + `common/` (envelope, error codes, JWT payload) + the `user`, `auth`, and `delivery-company` modules (`delivery-company` is the reference module — mirror it).
- **Backend:** the full Sub-01 skeleton (env, logger, Prisma singleton, `sendSuccess`, typed event bus, `requireAuth`, error handler, test + conformance harness) + the `auth` and `delivery-company` modules + **opt-in realtime**.
- **Frontend:** the shell + layouts + shared UI + i18n, the whole integration engine (axios, api-path, query client, `qk` factory, auth service/hooks, MSW harness) + the auth flow + `admin/delivery-companies` as a wired example page.

So the revised path for a **new app** is:

- **Stage 0** — model the domain, author module specs + page specs, and **extend** the template's `schema.prisma` (don't recreate it).
- **Stage 1** — **add** your modules to the existing contract.
- **Stage 2** — Sub-01 is done (verify only); run **Sub-02 per new module**.
- **Stage 3** — Sub-01 is skippable (no MVP to refactor); **Sub-02 becomes per-domain extension**; run **Sub-03 per new page**.

See §8b for the two cross-cutting switches the template ships with: **optional realtime** and **swappable auth**.

---

## 2. Global Conventions (the laws — true in every stage)

1. **The contract is absolute.** `@app-template/contract` owns every route constant, DTO, Command, Query, enum, error code, and event type. If it isn't in the contract, it doesn't exist; a missing type is a Stage 1 gap to fix upstream, never a local patch.
2. **One response envelope.** Every API response is `ApiResponse<T>` — a discriminated union: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`. The backend wraps via `sendSuccess`; the frontend unwraps to the inner `data`.
3. **One Zod major.** The whole monorepo uses **Zod 4**. A version split breaks shared schemas and `zodResolver`.
4. **Dates cross the wire as ISO strings** (`z.iso.datetime()`). Conversion to/from `Date` is a backend/frontend mapping concern, never the contract's.
5. **Types derive from schemas** (`z.infer`) — never declare a type and a schema separately.
6. **No magic strings / no `any`.** Routes and fixed values come from contract constants and enums; use `unknown` and narrow.
7. **Docs tree:** `Docs/Stage-NN-.../...`. Plans, sprints, and per-sprint reports live there, not in code.
8. **Conformance is tested, not assumed.** Mock fixtures and outgoing responses are parsed through the contract's Zod schemas so drift fails loudly instead of reaching production.
9. **Naming vocabulary is fixed.** Inputs are *Commands* (writes) and *Queries* (reads); outputs are *DTOs*; route constants are `[MODULE]_ROUTES` with UPPERCASE keys.

---

## 3. The Repeating Rhythm (every stage works this way)

Each stage/substage runs three phases, gated by you:

- **Phase 01 — Plan:** the agent audits inputs and writes `plan.md`. No code.
- **Phase 02 — Sprints:** it decomposes the plan into dependency-ordered sprints in `sprints.md`. No code.
- **Phase 03 — Execute:** it runs the loop below, one sprint at a time.

**Execution loop:** select first sprint not ✅ → implement (+ tests) → validate (`tsc`, tests, lint, conformance) → **commit on green** → report to `results/` → mark ✅ → **pause and wait for `next`**.

**Context protocol:** run **one sprint per fresh session**, loading only that sprint's relevant files (rules + plan + sprints + the contract/spec for the current module/domain). State lives on disk, so a fresh agent always resumes cleanly.

**Precedence / conflict policy:** rules files govern **HOW**; phase files govern **WHAT/WHEN**; the contract and module specs govern **WHICH**; the prompt is the trigger. Resolve HOW conflicts toward the rules and note them; **stop and ask** only on a genuine WHICH conflict (e.g. a spec asks for a forbidden field).

---

## 4. Stage 0 — Conception (you do this by hand)

This is the only stage with no agent. It produces the artifacts every later stage reads. Do it carefully — the agent stages are only as good as these inputs.

### 0.1 Model the domain
Decide the app's modules (e.g. `Auth`, `User`, `Product`, `Order`) and how they relate, including which modules emit or listen to events.

### 0.2 Extend the database schema
Extend `Apps/api/prisma/schema.prisma` — the source of truth for persisted data. The template's baseline is `User` (with `fullName`), `RefreshToken`, `DeliveryCompany`, and the placeholder `UserRole` enum. Add your models, relations, and enums (keep enum values identical to what the contract will declare, since both reference them). Don't recreate the baseline.

### 0.3 Author one module spec per module → `Docs/Stage-00-Conception/Module-Contracts/[module].md`
Use a **full-lifecycle** template (one spec serves contract, backend, and frontend). **Tag each section by consumer** so each stage reads only its part:
- `## API Interface [CONTRACT]` — routes, access control, input validation, input/output DTOs.
- `## Events [CONTRACT]` — emits / listens, payload DTOs.
- `## Business Logic [BACKEND]` — service steps (hashing, DB calls, transactions).
- `## Data Mapping [BACKEND]` — mapper rules (exclude sensitive fields, Date → ISO).
- `## Technical Constraints [BACKEND]` — e.g. "hash with Argon2".
- `## Test Scenarios [BACKEND]` — status codes, edge cases.

Stage 1 reads only the `[CONTRACT]` sections; Stage 2 reads the `[BACKEND]` ones. Tagging is what keeps backend logic from leaking into the contract. Start from `Module-Contracts/_TEMPLATE-module-contract.md`; `delivery-company.md` is a worked example.

### 0.4 Author one requirement file per page → `Docs/Stage-00-Conception/Pages-Requirements/[page].md`
Describe each page's UI, interactions, forms, data dependencies, and which layout it uses (Admin = desktop-first, Public = mobile-first). Stage 3 Sub-03 consumes one of these per page. Start from `Pages-Requirements/_TEMPLATE-page-requirement.md`.

### 0.5 Clone the template (the stack is already locked)
Copy the template and run the rename step (see `README.md` quickstart): rename the `@app-template` scope, replace the `App Template` brand strings, and choose the WS on/off and auth-roles switches. The monorepo (`Apps/contract`, `Apps/api`, `Apps/web`) and its versions — critically **Zod 4** across all three — are already scaffolded and pinned. Do not re-pin.

**Stage 0 outputs:** an extended `schema.prisma`, `Module-Contracts/*.md` (tagged), `Pages-Requirements/*.md`, and a renamed clone of the template.

---

## 5. Stage 1 — Contract (`@app-template/contract`)

**Goal:** a pure TypeScript + Zod package of types, schemas, route constants, error codes, and event types — zero business logic.

> **Pre-built by the template:** `common/` + the `user`, `auth`, and `delivery-company` modules. Sprints begin at your *new* modules.

- **Rules:** `contract-rules.md`
- **Prompts:** `stage-01-prompts.md`
- **Phases:** `stage-01-phase-01-plan.md` → `stage-01-phase-02-sprints.md` → `stage-01-phase-03-execute.md`
- **Reads:** `Module-Contracts/*.md` (`[CONTRACT]` sections), `schema.prisma`
- **Outputs:** `Apps/contract/` and `Docs/Stage-01-Contract/results/`

---

## 6. Stage 2 — Backend (`Apps/api`)

Two substages.

### Sub-01 — Initialize the project (**pre-executed by the template — verify, don't re-run**)
The framework skeleton: env validation, Pino logging, the `prisma` singleton, the `ApiResponse` helper, a typed event bus, one `requireAuth` guard, the error handler, the test harness, and opt-in realtime. The template ships this complete — run this substage only to verify (`tsc`, unit suite) or to extend it.
- **Rules:** `back-end-rules.md`, `test-rules.md`, `env-template.md`, `realtime-rules.md`
- **Prompts:** `stage-02-sub-01-prompts.md`
- **Phases:** `stage-02-sub-01-phase-01-plan.md` → `-02-sprints.md` → `-03-execute.md`
- **Outputs:** `Apps/api/` skeleton, `Docs/Stage-02-Backend/Sub-01-init/results/`

### Sub-02 — Implement a module (repeat per module)
The 6-file architecture (mapper, interface, service, optional listener, controller, routes) with manual DI; `routes.ts` is the composition root. `auth` and `delivery-company` are pre-built; new modules mount into `Apps/api/src/modules/index.ts` at the marked `EXTENSION POINT (modules)`.
- **Rules:** `module-implementation-rules.md`
- **Prompts:** `stage-02-sub-02-prompts.md`
- **Phases:** `stage-02-sub-02-phase-01-plan.md` → `-02-sprints.md` → `-03-execute.md`
- **Reads:** `Module-Contracts/[module].md` (`[BACKEND]` sections), the contract
- **Outputs:** `Apps/api/src/modules/[module]/`, `Docs/Stage-02-Backend/Sub-02-module/results/`

---

## 7. Stage 3 — Frontend (`Apps/web`)

Three substages. Rules shared across all: `front-end-rules.md`, `front-end-best-practices.md`, `front-end-test-rules.md`.

### Sub-01 — Refactor (**skip on greenfield-from-template**)
Only relevant if you imported an AI-generated MVP into `Apps/web`. Starting fresh from the template, there is nothing to refactor — the shell, engine, and auth flow are already aligned to the rules.
- **Prompts:** `stage-03-sub-01-prompts.md` · **Phases:** `stage-03-sub-01-phase-0{1,2,3}-*.md` · **Docs:** `Docs/Stage-03-Frontend/Sub-01-Refactor/results/`

### Sub-02 — Integration Engine (**engine pre-built; becomes per-domain extension**)
The Axios singleton, the route builder, the Query Client, the `qk` factory, the auth service/hooks, and the MSW harness already exist. Each run now adds one Service + TanStack Query Hook + MSW handler set per new domain, patterned on `delivery-companies`.
- **Prompts:** `stage-03-sub-02-prompts.md` · **Phases:** `stage-03-sub-02-phase-0{1,2,3}-*.md` · **Docs:** `Docs/Stage-03-Frontend/Sub-02-Integration/results/`

### Sub-03 — Page Assembly (repeat per page)
Wire one page's UI to the real hooks with granular `isLoading`/`isError` states, RHF + Zod forms, i18n via `useTranslation`, and `vi.mock()`-based unit tests. Reference implementation: `Apps/web/src/pages/admin/delivery-companies/`.
- **Prompts:** `stage-03-sub-03-prompts.md` · **Phases:** `stage-03-sub-03-phase-0{1,2,3}-*.md`
- **Reads:** `Pages-Requirements/[page].md` · **Docs:** `Docs/Stage-03-Frontend/Sub-03-pages/results/[page]/`

---

## 7b. Optional realtime & swappable auth (template switches)

**Realtime is opt-in.** All Socket.IO code is isolated in `Apps/api/src/common/realtime/` behind one wiring point — `initRealtime()` in `realtime/index.ts`, called once from `server.ts` — and gated by the `WS_ENABLED` env var (frontend: `VITE_WS_ENABLED`). Leave both `false` to ship without realtime; set both `true` and fill the `EXTENSION POINT (realtime)` markers (in `realtime-gateway.ts`, `rooms.ts`, `socket.types.ts`, and `Apps/web/src/lib/realtime.ts`) to use it. To remove it entirely, follow the deletion recipe at the top of `realtime/index.ts`. See `realtime-rules.md`.

**Auth is a swappable baseline.** The backend `requireAuth({ roles?, checkDB? })` guard and the frontend guards are an authenticated-or-not skeleton with two extension axes: (a) **role-based** — `requireAuth({ roles: [UserRole.ADMIN] })` on the backend and `<RoleGuard allow={[...]}>` on the frontend; (b) **page/route-based** — access is declared by where a route sits in `Apps/web/src/App.tsx`'s config (nested under `ProtectedRoute` for any session, or `RoleGuard` for specific roles). This app's concrete roles are stripped to the placeholder `ADMIN | USER` in `Apps/contract/src/modules/user/user.enums.ts` and `Apps/api/prisma/schema.prisma`. Grep `EXTENSION POINT (auth)` for every swap site.

---

## 8. Full Mode vs Light Mode (right-sizing)

This pipeline is heavy on purpose, and it is overkill for small changes. Match the ceremony to the stakes:

- **Full mode** — new app, new module, or new page: run all three phases, the human gate, and the full test/conformance suite.
- **Light mode** — a small fix or tweak inside existing, contract-covered code: skip plan/sprints, make the change directly against the rules, and rely on `tsc` + the existing conformance tests. Don't write a sprint file for a one-line change.

The executable parts of this system (the contract schemas and the conformance tests) are the durable truth. The prose rules are scaffolding — keep them lean, and when the hand-wiring starts to feel like a tax, that's the signal to evaluate `ts-rest`/`tRPC` and delete some of it.

---

## 9. File Index

| Kind | Files |
| --- | --- |
| Overview | `workflow.md` (this file), `README.md` (template quickstart), `deploy-instruction.md` |
| Stage 0 (you author) | `schema.prisma` (extend the template's), `Module-Contracts/*.md` (+ `_TEMPLATE-module-contract.md`), `Pages-Requirements/*.md` (+ `_TEMPLATE-page-requirement.md`), `error-codes.md` |
| Stage 1 rules/prompts | `contract-rules.md`, `stage-01-prompts.md`, `stage-01-phase-0{1,2,3}-*.md` |
| Stage 2 rules/prompts | `back-end-rules.md`, `module-implementation-rules.md`, `test-rules.md`, `env-template.md`, `realtime-rules.md`, `stage-02-sub-0{1,2}-prompts.md`, `stage-02-sub-0{1,2}-phase-0{1,2,3}-*.md` |
| Stage 3 rules/prompts | `front-end-rules.md`, `front-end-best-practices.md`, `front-end-test-rules.md`, `stage-03-sub-0{1,2,3}-prompts.md`, `stage-03-sub-0{1,2,3}-phase-0{1,2,3}-*.md` |
