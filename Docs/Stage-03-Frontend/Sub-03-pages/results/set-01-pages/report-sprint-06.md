# Sprint 6 Report — Wiring: Auth & Account Cluster

**Set:** pub-pages · **Status:** ✅ Done · **Branch:** `pages-set-01`

---

## Summary

Login, Register, and My Account all moved onto the real hooks. `/staff` needed nothing new — it
was already complete from Sprints 2 and 4. The bulk of this sprint's surface was Register and My
Account, both fully rewired from Sub-01 stub hooks + local ad-hoc schemas onto the Sprint-1
contract-aligned schemas and Sub-02 real hooks. That rewiring cascaded into a substantial cleanup:
8 files deleted (2 of them orphaned since Sprint 3 and only found now), plus dead code trimmed
from `clients.service.ts` and a shared draft-types file. `tsc --noEmit` clean on both configs,
299/299 tests, no new lint-error classes.

## Files changed

**Rewired**
- `src/pages/LoginPage.tsx` — added the register `<Link>` (keys were prepared in Sprint 1).
- `src/pages/Register.tsx` — full rewire: `register.schema.ts` (RHF+Zod), `useWilayas()` (dropped `WilayaProvider`), `useValidatePhone()` on blur, `useRegisterClient()`.
- `src/pages/MyAccount.tsx` — full rewire: `useClientMe()`, `useUpdateClientMe()` (profile RHF), `useChangeClientPassword()` (new inline password RHF), `MoneyStatusCard` fed directly, added My Invoices shortcut.

**Schema fixes (RHF + Zod `.transform()` interaction)**
- `src/pages/register/register.schema.ts`, `src/pages/my-account/update-me.schema.ts` — added `RegisterInput`/`UpdateMeInput` exports (see Corrections).

**Cleanup (`clients.service.ts`, `query-keys.ts`, `useClientPortal.ts`, `draft-types/client.types.ts`)**
- Removed now-dead stub functions, an orphaned query key, a stale comment, and two unused draft-type interfaces — see Corrections for the full chain.

**Deleted**
- `src/hooks/use-my-account.ts`, `use-registration.ts`, `use-wilaya.ts`, `use-delivery-fees.ts`.
- `src/components/providers/wilaya-provider.tsx`.
- `src/components/shared/PasswordResetForm.tsx`, `PasswordResetForm.schema.ts`.
- `src/services/checkout-delivery.service.ts`.

## Corrections & real gaps found this sprint

Same transparent pattern as every prior sprint in this set:

1. **Phone validation is a plain `onBlur` handler, not debounced.** `sprints.md` (my own planning
   doc) said "blur, debounced via `useDebouncedValue`" — but PUB-07's actual requirement text just
   says "async-validated on blur," nothing about debouncing. A blur event already fires at most
   once per focus change, not per keystroke; layering a debounce on top solves a problem that
   doesn't exist here. Implemented as a direct `onBlur` call.
2. **RHF's `values` option replaces a manual `useEffect` for form seeding.** The Sub-01
   `MyAccount.tsx` (and my own plan.md) assumed a `useEffect` syncing fetched data into local
   form state — the pattern the *old* page already used. RHF 7.x's `useForm({ values })` does this
   natively: the form's current values re-sync whenever the referenced object changes by
   reference, including after `useUpdateClientMe`'s own cache invalidation triggers a refetch. No
   effect needed.
3. **Zod `.transform()` on `email` requires RHF's 3-generic `useForm` form.** `register.schema.ts`
   and `update-me.schema.ts` both transform an empty-string `email` to `undefined`, which makes
   the schema's *input* shape (what the form fields use) differ from its *output* shape (what
   `onSubmit` receives). `useForm<T>`'s single-generic form assumes input and output are the same
   type; TS correctly rejected that mismatch. Fixed by exporting the input type
   (`z.input<...>`) alongside the existing output type from each schema file, and using
   `useForm<Input, unknown, Output>()` — the standard RHF+Zod pattern for schemas with transforms.
4. **A large, two-sprints-deep orphaned-file chain.** Rewiring Register/MyAccount directly
   orphaned `use-my-account.ts`, `use-registration.ts`, `use-wilaya.ts`, `wilaya-provider.tsx`,
   and `PasswordResetForm.tsx`/`.schema.ts` (`PasswordResetForm`'s old schema had no
   `currentPassword` field, so it couldn't drive the real `ChangeMyPasswordCommand` — folded into
   a new inline form instead, same "fold into the one real consumer" precedent as Sprint 3's
   `DeliveryForm`). Checking that chain surfaced two files — `use-delivery-fees.ts` and
   `checkout-delivery.service.ts` — that had actually been orphaned since **Sprint 3**, when
   `DeliveryForm.tsx` (their only consumer) was deleted, and were simply missed at the time.
   Cleaned up now. Every deletion in this report was grep-verified for zero remaining consumers
   before removal.
5. **"My Invoices" shortcut links to a route this build doesn't have.** PUB-08 requires the
   shortcut, and the contract does define a real endpoint for it (`MY_INVOICES` in
   `billing.routes.ts`), but no frontend page exists for it in this page set. Same scope-
   confinement precedent as Sprint 2's `/staff`: plan and link the shortcut, don't build the
   destination — it belongs to a later page set.

## Validation

| Check | Result |
|---|---|
| `tsc --noEmit` (both configs) | ✅ clean |
| `vitest run` | ✅ 299/299 passed, 35/35 files, no regressions (`LoginPage.test.tsx` unaffected by the added register link) |
| `UpdateMeCommand` never contains `phone` | ✅ confirmed — phone is a plain, never-`register()`ed `<Input>` |
| `ChangeMyPasswordCommand` never contains `confirmPassword` | ✅ confirmed — destructured out before `.mutate()` |
| My-Account never renders category | ✅ unchanged from Sprint 4 |
| Authenticated clients bounce to `/my-account` | ✅ via `PublicOnlyRoute` (Sprint 2, untouched); Register's own redundant redirect effect removed rather than duplicated |
| `eslint` before/after, all 9 touched files | ✅ 2 improved (`Register.tsx` 68→38, `clients.service.ts` 5→3), 1 (`MyAccount.tsx`) +27 confirmed 100% `prettier/prettier` via rule-class breakdown, rest flat |

## Next

Sprint 7 — Polish: responsive pass (mobile-first check across all seven pages), targeted
`useMemo`/`useCallback` review, beacon-timing double-check, and a full i18n sweep for any
remaining inline strings.
