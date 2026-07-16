# ADM-13 — Repairs

## Layout
- Admin shell, desktop-first. Route: `/admin/repairs`. No public surface exists.

## UI
- **Board**: kanban columns INTAKE → PROCESSING → COMPLETED → PICKED_UP (+ CANCELLED lane); cards show reference, customer, device, technician, age, unpaid badge; technician filter.
- `IntakeDialog`: customer name + phone (or attach POS client → prefill), brand + model selects with free-text fallback, IMEI?, **reported issues multi-select** (charging, display, battery, camera, speaker, microphone, water-damage, software, other → free-text field), technician select; prints the claim slip on create.
- Ticket detail: device/customer block · diagnosis (editable in PROCESSING) · **parts editor** (product picker, qty, price charged, serials? — adding reserves; availability checked live) · labour price · totals (labour + parts, paid) · status timeline.

## Interactions
- Drag between columns = status transition, validated server-side (a rejected drag snaps back with the error). PROCESSING requires a technician; COMPLETED consumes the parts (shortfall 409 names the product); PICKED_UP opens the payment dialog (cash amount) and records the repair sale; CANCELLED asks optionally for a reason and, if parts were consumed, shows the explicit per-part restock choices.

## Forms
- `CreateRepairCommand`, `AddRepairPartCommand`, `RepairStatusCommand` — all RHF + zodResolver; conditional requirements as refines (technician for PROCESSING, paidAmount for PICKED_UP, consumedPartReturns for post-consumption cancel).

## Data dependencies
- `useRepairs(filters)` → `['repairs',filters]`; `useRepair(id)`; `useTechnicians()` → `['technicians']`.
- Mutations: create/update/parts/status — invalidate `['repairs']`, `['inventory','*']`; PICKED_UP also `['sales','admin']`.

## Access
- Admin (staff variant STF-07 scoped to own tickets).
