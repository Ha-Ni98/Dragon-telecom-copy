# STF-02 — POS

## Layout
- Staff shell, desktop-first, two-pane. Route: `/staff/pos`. (Admin reuses this exact page at `/admin/pos`, unscoped.)

## UI
- Left: product search with **barcode-scanner focus** (`F2`) + family quick-pick grid.
- Right: the ticket — lines (name, qty stepper, resolved price shown beside the editable charged price, line total, serials field, remove), discount, total; POS-client attach zone; payment panel (`F4`): paid amount, change due / new credit preview; Confirm (`Enter`).
- "My drafts" drawer.

## Interactions
- Scan adds a line; re-scan increments; qty capped at available. Attach POS client (search name/phone, or quick-add dialog) ⇒ all lines re-resolve to his category price with the delta visible; detach reverts to default price.
- Per-line price override edits `unitPrice`; `resolvedPrice` stays displayed. Saving without confirming keeps a DRAFT (no stock, no money). Confirm runs the sale; then a receipt view (total · previous credit · grand total · paid · new credit) with print.

## Forms
- Draft: `SaleDraftCommand` (built incrementally; PATCH on change). Quick-add client: `CreatePosClientCommand` dialog (RHF + zodResolver). Confirm: `ConfirmSaleCommand { paidAmount }` — underpayment with no client attached surfaces `CREDIT_REQUIRES_CLIENT` on the client zone; stock shortfall surfaces `INSUFFICIENT_STOCK` on the named line.

## Data dependencies
- `useStaffProducts(search)` → `['staff','products',search]`; `usePosClientSearch(q)` → `['pos-clients','search',q]`; `useMyDrafts()` → `['sales','me','DRAFT']`.
- Mutations: `useCreateDraft` / `useUpdateDraft` / `useConfirmSale` — confirm invalidates `['sales','me']`, `['staff','products']`, `['staff','dashboard']`.

## Access
- Staff — `RoleGuard(STAFF_POS)` (grants STAFF_PRODUCTS implicitly); admin unrestricted.
