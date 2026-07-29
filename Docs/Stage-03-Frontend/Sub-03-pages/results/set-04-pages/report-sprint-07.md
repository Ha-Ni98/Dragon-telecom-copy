# Set-04 — Sprint 7 Report: Wiring — Web Clients, Client Detail, Users & Roles

Status: ✅ Done

## Web clients (ADM-12 list)

`AdminClients.tsx` wires `useClientDirectory(query)` (debounced search + status filter + page,
matching the `useDebouncedValue` convention already established for Suppliers/AdminProducts),
`useClientDirectoryStats()` (the A2 `newThisMonth` card now reads real data), and
`useUpdateClientDirectoryEntry` for the modify dialog.

**Real bug found and fixed:** `handleEdit(clientId)` opened the modify dialog
(`setIsModifyDialogOpen(true)`) but never called `setSelectedClient` — the dialog's own render
guard (`{selectedClient && <AdminClientModifyDialog .../>}`) meant clicking "Edit" was a
**complete no-op** the whole time this scaffold existed. Fixed by looking up the clicked row from
the live list data and setting it before opening.

**Architecture correction against the plan:** the plan described `useApproveClient`/
`useRejectClient` as List-page mutations. In practice, `AdminClients.tsx`'s Sprint-3/4 shell never
built a pending-row "approve" action or an `ApprovalDialog` import — approval is only reachable by
opening a pending client's detail page. Wired accordingly (see below); `plan.md` §Page 5 corrected.

## Client detail (ADM-12b, new)

`AdminClientDetail.tsx` wires `useClientDirectoryEntry(id)`, `useApproveClient`/`useRejectClient`
(with a 409 username-conflict inline banner — the mutation lives at the page level, outside
`ApprovalDialog`'s own form instance, so the error can't go through RHF's `setError`; added a new
`usernameError` prop to `ApprovalDialog` instead, mirroring `UserDialog`'s existing
`lastAdminGuardError` pattern), `useResetClientPassword` (no invalidation, matching the plan), and
`useClientActivity(id, {})` for the Browsing tab. `useClientActivity` has no per-tab `enabled`
option (unlike `useSales`/`useInvoices`) — harmless here since Browsing is the only tab that
consumes it; Overview/Orders/Invoices/Payments have no scoped hook in the contract and stay
`EmptyState` placeholders, matching the plan's resolve-first section (no gap flagged for them).

## Users & roles (ADM-16, new)

`AdminUsers.tsx` wires `useUsers`/`useRoles`/`usePages({scope: PageScope.STAFF})` and all six
mutations. Both tables take a bare array in their Sprint-4 props (no `PaginatedResult`, and
`useRoles()` itself is unpaginated) — fetched a single generous page (`{page:1, limit:100}`)
rather than adding new pagination UI in a wiring sprint, same scope call as Sprint 6's
supplier-invoices list. The last-admin guard surfaces via a 409 check on `useUpdateUser`, shown
through `UserDialog`'s existing `lastAdminGuardError` prop. Both dialogs get a
`key={\`user-${id ?? "new"}\`}`/`key={\`role-${id ?? "new"}\`}` remount fix (same
defaultValues-frozen-at-first-render issue `SupplierPaymentDialog` already needed) — first tried a
shared literal `"new"` key on both dialogs, which triggered a React duplicate-key warning since
they're sibling elements under the same parent; namespaced per-dialog instead.

**Real bug found and fixed:** `RoleDialog`'s create-mode submit called `onSaveCreate(values)`
with no `pageKeys` argument, while update-mode correctly passed `onSaveUpdate(values, pageKeys)`.
The permission matrix the admin had just checked was silently discarded on create — a brand-new
role could never be born with any pages, and there was no way for the page-level handler to
recover the selection afterward. Fixed by widening `onSaveCreate`'s signature to also carry
`pageKeys` and wiring `AdminUsers.tsx`'s `handleSaveCreateRole` to call `useSetRolePages` once
`useCreateRole`'s `onSuccess` returns the new role's id (skipped entirely when the matrix is
empty, to avoid a pointless PUT).

## The `FormLabel`-outside-`FormField` bug, four more times

Sprint 5 found this bug once (POS-client dialogs); Sprint 7 found it **four more times**, all in
components this sprint was the first to actually open with real data flowing through them:

- `approval-dialog.tsx`'s `categoryId` field — bare `<FormItem>`/`<FormLabel>` + `<Controller>`
  instead of `<FormField>`. Fixed the same way as Sprint 5 (wrapped in a proper `<FormField>` with
  `<FormControl>`).
- `user-dialog.tsx`'s create-mode `type` Select — identical pattern, identical fix.
- `user-dialog.tsx`'s "roles" section header (both create and update forms) and
  `role-dialog.tsx`'s `PermissionMatrix` "pages" section header — these two are **not** tied to a
  single RHF field at all (`roleIds`/`pageKeys` are set imperatively via `setValue`/local
  `useState`, not through a `FormField` render prop), so wrapping them in `FormField` isn't the
  right fix. Downgraded to a plain shadcn `Label` instead, which has no `useFormField()`
  dependency.

**Pattern now confirmed recurring, not a one-off:** any `FormLabel` rendered without an
enclosing `<FormField>` throws the instant the dialog actually mounts with data, and none of
these were ever caught before because Sprint 4's primitive tests only asserted `isLoading`/empty
states, never actually opened the dialog. Worth a deliberate grep (`FormLabel` not preceded by a
`FormField` render prop in the same file) before trusting any remaining unwired Sprint 3/4 form
scaffold in Sprints 8+.

## Second instance of the blank-email schema bug

`admin-client-modify-dialog.schema.ts`'s `email: z.email().optional()` had the exact same bug
Sprint 6 found in `supplier.schema.ts`: the dialog's `values: {email: client.email ?? ""}`
defaults to an empty string, which `.optional()` doesn't exempt from the format check. Fixed with
the same `z.union([z.literal(""), z.email(...)])` approach (not `z.preprocess`, which breaks
`zodResolver`'s input-type inference against `useForm<T>`). Two regression tests added.

## Second stale route-smoke expectation, different root cause

`admin-set-04-routes.smoke.test.tsx`'s `/admin/clients/:id` case still expected
`admin.clients.detail.notFound` (a Sprint-4 correction from the placeholder-body era). Sprint 7's
real `useClientDirectoryEntry` call goes through the **global MSW server** (started for every test
in `tests/fixtures/wrappers/setup.ts`, not something this smoke file opts into) — and
`clients.handlers.ts`'s `adminDetail` handler answers `GET .../admin/clients/:id` unconditionally
with `mockAdminClientPending`, regardless of the id in the URL. The placeholder uuid this smoke
test uses therefore resolves *successfully*, rendering the real detail body instead of
`NotFoundState`. Corrected the expectation to `admin.clients.detail.tabs.overview` (a tab-trigger
key present whenever any client loads, keeping the assertion decoupled from the specific fixture's
name). Initially misdiagnosed this as a slow/failing real network call and added a longer
`findByText` timeout before finding the actual cause — reverted that once the real explanation
was confirmed.

## Tests

Four new wiring-smoke files (23 new tests): `clients-wiring.test.tsx` (skeleton/error-retry/
live-render/edit-opens-with-real-data), `client-detail-wiring.test.tsx` (skeleton/404/live-render/
approve/username-409-banner/reset-password), `users-wiring.test.tsx` (skeleton/live-render/
edit-shows-effective-pages/last-admin-409-banner/create-user/create-role-with-matrix/
update-role-with-matrix), plus 2 new schema regression tests in
`admin-client-modify-dialog.schema.test.ts`. All follow the established `vi.mock()`-the-hook /
`renderWithRoutes` pattern; dialog-scoped assertions use `within(screen.getByRole("dialog"))`
where a translation key collides with same-page text elsewhere (e.g. "Approve" appearing on both
the header button and the dialog's submit button).

## Validation

- `tsc --noEmit` (both configs) — clean.
- `eslint --fix` — clean (prettier-only findings, auto-fixed).
- `vitest run` — **95 files / 607 tests**, all green (23 new). Two stray unhandled errors during
  the full run (the same pre-existing `vaul` pointer-up flake from every prior sprint's report,
  plus a `window is not defined` async-teardown timing race in `inventory-wiring.test.tsx` also
  already seen and dismissed in Sprint 5) — neither affects a real assertion.
- No inline strings introduced; no new i18n keys needed — Sprint 1's `admin.clients.*`/
  `admin.users.*` coverage was thorough enough (including previously-unused keys like
  `admin.clients.approval.usernameTaken` and `admin.users.form.lastAdminGuard`) to cover every
  state this sprint wired.

## Carried into later sprints

- Sprint 8 wires Statistics, Settings, Audit logs — grep every remaining unwired dialog for a
  standalone `FormLabel` before assuming it's safe; this bug class has now appeared in every
  sprint that actually opens a Sprint 3/4 dialog with live mutations for the first time.
- Sprint 9's polish pass should reconsider the Users/Roles tables' unpaginated 100-item fetch if
  either list grows past that in practice.
