# Sprint 4 Report — Clients & POS Clients

**Status:** ✅ Done · **Branch:** `stage-03-sub-02-integration` · **Scope:** `/src/services`, `/src/hooks`,
`/tests` — no `/src/components` or `/src/pages` touched.

---

## What shipped

- **`src/services/clients.service.ts`** — 20 real, contract-typed functions appended (web identity, cart, admin
  client pipeline, POS clients), clearly separated from the untouched Sub-01 stub section.
- **3 new hook files**: `src/hooks/useClientPortal.ts` (8 hooks), `useClientDirectory.ts` (7 hooks),
  `usePosClients.ts` (5 hooks) — all named to avoid any collision with the 10 existing stub hook exports.
- **`tests/fixtures/data/clients.mock.ts`** (new, reuses `catalog.mock.ts`'s `mockProductWithPricing` for the
  cart item) + **`tests/fixtures/msw/clients.handlers.ts`** (new, 20 handlers + 5 error overrides) + registered
  in `server.ts`.
- **27 new tests**: `tests/integration/services/clients.service.test.ts` (21) +
  `tests/integration/hooks/clients.test.tsx` (6).
- **Retroactive fix to Sprint 2**: `auth.handlers.ts`'s `logout` handler corrected from `noContent()` (204,
  wrong) to `ok(null, 200)` (matches the real `identity.controller.ts`).

## Same "check consumers first" discipline as Sprint 3

`MyAccount.tsx`, `Register.tsx`, and `AdminClients.tsx` import the Sub-01 stub clients hooks directly (10 hook
exports across `use-my-account.ts`, `use-registration.ts`, `use-admin-clients.ts`,
`use-admin-clients-stats.ts`, `use-modify-client.ts`). Kept every one of those untouched; the real hooks live in
3 new files with deliberately distinct names (`useClientMe` not `useMyAccount`, `useClientDirectory` not
`useAdminClients`, etc.). No `qkLegacy` additions were needed this time — those 4 stub-consuming hook files use
their own local, inline query-key objects (`adminClientsQueryKeys`, `adminClientsStatsQueryKeys`), never the
central `qk` registry, so nothing broke incidentally.

## Resolved 3 of plan.md §6's open `*(confirm)*` items by reading the real backend interface

`Apps/api/src/modules/clients/clients.interface.ts` (`IClientsService`) settled every previously-unconfirmed
return shape directly, rather than guessing from the DTO list:
- `register()` returns `{ id: string }` — **not** a session/`ClientMeDto`. Registration does not log the client
  in; approval (a separate admin action) is what provisions real credentials.
- `addCartItem`, `changeMyPassword`, `resetClientPassword` all return `void` — no echoed DTO.
- **`POS_CLIENT_ROUTES.ADMIN_BY_ID` is PATCH-only.** There is no GET-by-id POS-client route in the real backend
  router at all. The plan's implied `getPosClient(id)` (for naming symmetry with `getAdminClient`) was correctly
  *not* implemented — it would have no route to call. Final function count is 20, not the plan's 21.

## Cross-cutting finding: the MSW harness's `noContent()` premise was inverted

A `removeFromCart` test crash (`Cannot read properties of undefined (reading 'message')`) led to tracing the
real backend's only 204 response (`clients.controller.ts`'s `removeCartItem`, via `sendSuccess(res, null, 204)`)
down to its actual wire behavior:

- `sendSuccess()` always calls `.json(body)`, regardless of the status code passed to it — so the backend
  *source code* looks like it sends `{success:true,data:null}` even at 204.
- But the **WHATWG Fetch spec forbids a response body on a null-body status** (204/205/304). msw/undici enforce
  this in this test environment, and any real browser's fetch/XHR implementation would too — meaning that body,
  however earnestly `sendSuccess` tries to attach it, cannot reliably reach the client.

**Fixed forward:** `removeFromCart` now does a bare `await api.delete(...)` with no body read at all — the same
pattern `auth.service.ts`'s `logout()` already used (axios rejects automatically on non-2xx; no body check is
needed or safe to rely on). `clients.handlers.ts` uses the harness's `noContent()` helper correctly.

**Fixed retroactively:** this prompted re-checking Sprint 2's `logout` fixture, which used `noContent()` (204,
bodyless) — but `identity.controller.ts` shows the real `logout` is `sendSuccess(res, null, 200)`: a genuine 200
**with** a real envelope (200 is not a null-body status, so this one *does* survive the wire intact). Both the
status code and body shape were wrong in the Sprint 2 fixture; it was silently masked because
`auth.service.ts`'s `logout()` never reads the response body regardless. Corrected to `ok(null, 200)`.

`envelope.ts`'s `noContent()` doc comment is rewritten to state the confirmed rule (only one true 204 exists in
this entire backend, and even it can't carry a body) and point at the right service-side pattern for any future
sprint that finds a genuine bodyless response.

## Validation

```
npm run check
```
Clean, whole project, zero errors.

```
npx vitest run
```
**15/15 files, 142/142 tests passing** (up from 115/115 at Sprint 3 close — 27 new, all clients/POS).

Lint: fully-new files auto-fixed directly. `clients.service.ts` (mixed old stub + new real section)
reconstructed from the original committed stub + the fixed new section, same technique as Sprint 3 — confirmed
via `eslint` that only the pre-existing 5 debt lines remain flagged.

## Commit

`fe: integration sprint 4 — clients` on `stage-03-sub-02-integration`.

## Handoff to Sprint 5 (Platform & Orders)

- Apply the "check page/component consumers before touching a stub hook, then confirm return shapes against the
  real backend interface (not just the DTO list)" discipline from the start — it resolved every open question
  this sprint without a single guess.
- If Sprint 5 (or any later sprint) reaches for `noContent()`, read its now-corrected comment first — most
  "204" endpoints in this backend are not actually bodyless.
- `ClientStatsDto` and `AdminClientDto` fixtures are now available in `clients.mock.ts` if orders/billing need to
  reference client credit or status.
