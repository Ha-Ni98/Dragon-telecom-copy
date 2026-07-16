# ADM-05 — Admin POS

## Layout
- Admin shell, desktop-first. Route: `/admin/pos`.

## UI / Interactions / Forms
- The exact STF-02 component, mounted unscoped: the admin sees and can open/confirm **everyone's** drafts, and the drafts drawer groups by staff member. See STF-02 for the full spec.

## Data dependencies
- Same hooks pointed at the admin variants (`['sales','admin',...]`).

## Access
- Admin only.
