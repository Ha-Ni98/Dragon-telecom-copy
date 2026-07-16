# [PAGE-ID] — [Page Name]

> One requirement file per page. Stage 3 Sub-03 consumes one of these per page. Copy this
> file to `Pages-Requirements/[page].md` and fill it in.

## Layout
- Which shell/layout this page uses (Admin = desktop-first, Public = mobile-first) and its route path.

## UI
- The sections/regions of the page and what each shows. Reference shared components where they apply
  (PageHeader, DataTable, StatCard, EmptyState, …).

## Interactions
- What the user can do: buttons, filters, navigation, modals/dialogs, and the result of each.

## Forms
- Each form: its fields, the contract Command/Query schema that validates it, and submit behavior
  (RHF + Zod resolver, success/error states).

## Data dependencies
- Which hooks/queries the page reads, the loading/error/empty states for each, and any mutations
  it triggers (plus the query keys they invalidate).

## Access
- Who can reach this page (public / any authenticated / specific roles) — declared in the router
  (nesting under ProtectedRoute or RoleGuard).
