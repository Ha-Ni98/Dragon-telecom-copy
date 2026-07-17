# Stage 02 · Sub-02 — Prompts (Module Endpoint)

Run once per module. Replace `[module]` with the module name. Standing rules: rules govern HOW, phase files WHAT/WHEN, the contract WHICH; resolve HOW conflicts toward the rules and note them; stop and ask only on a genuine conflict; before declaring any type/enum/route, confirm it doesn't already exist in `@dragon-telecom/contract`.

---

## Phase 1 — Plan

Plan the `[module]` module.

Read and follow strictly:
- **Phase file:** stage-02-sub-02-phase-01-plan.md
- **Spec:** module-contracts/
- **Rules:** module-implementation-rules.md
- **Contract:** @dragon-telecom/contract

Constraints: no code; output only /Docs/stage-02-backend/sub-02-module/results/plan-[module].md.

---

## Phase 2 — Sprints

Produce the sprint plan for `[module]`.

Read and follow strictly:
- **Phase file:** stage-02-sub-02-phase-02-sprints.md
- **Plan:** /Docs/stage-02-backend/sub-02-module/results/plan-
- **Rules:** module-implementation-rules.md

Constraints: no code; foundation (mapper/interface) → logic (service) → API (controller/wiring); every sprint has a Validation block covering compilation and tests; output only Docs/stage-02-backend/sub-02-module/results/sprints-[module]-[setnumber].md.

---

## Phase 3 — Execute

Begin executing the `[module]` sprints.

Read and follow strictly:
- **Phase file:** stage-02-sub-02-phase-03-execute.md
- **Sprints:** stage-02-backend/sub-02-module/sprints-[module].md
- **Rules:** module-implementation-rules.md
- **Contract & spec:** `@dragon-telecom/contract`, module-contracts/

Instructions: follow the Context Protocol; take the **first sprint not marked ✅**; test-first; validate (`tsc`, `test:unit` incl. conformance, `test:int` once wired); write the report; mark ✅; commit on green; stop and wait for `next`.
