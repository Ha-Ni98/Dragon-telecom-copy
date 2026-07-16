# ADM-17 — Settings

## Layout
- Admin shell, desktop-first, tabbed. Route: `/admin/settings`.

## UI
- **Store**: name, address, phone, logo — feeds the **invoice header only** (helper text: the storefront footer is front-end static).
- **Invoicing**: per-DocType prefix + next sequence (decrease rejected with an inline 409 message), invoice footer note.
- **Categories**: client categories table — **name only**, enable/disable; member count + priced-product count columns as warnings.
- **Hierarchy**: three sub-panels — Families (name, icon upload, parent?, featured ≤ 6) / Brands (name, logo) / Models (brand, name; **families multi-select** = the many-to-many). Inline create everywhere; **disable only** (disabling hides from storefront filters and pickers; products keep references).
- **Delivery fees**: one row per wilaya (frName/arName, home fee, office fee); each row expands to its **explicit commune overrides** (add only where needed); Excel import (row-level validation report) + export buttons; default fees fields.
- **Storefront**: featured products picker, delivery companies list.
- No localisation tab.

## Interactions
- Import shows a dry-run validation report before applying (all-or-nothing). Every change audit-logged.

## Forms
- Per-tab forms (RHF + zodResolver): settings subsets, `CreateClientCategoryCommand`, taxonomy commands, `UpsertFeesCommand`.

## Data dependencies
- `useSettings()` → `['settings']`; `useDeliveryFees()` → `['delivery-fees','admin']`; taxonomy + category hooks.
- Mutations invalidate their own keys (+ `['wilayas']` public cache for fee changes).

## Access
- Admin only.
