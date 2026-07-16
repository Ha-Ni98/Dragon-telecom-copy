# ADM-03 — Add product

## Layout
- Admin shell, desktop-first, single column of cards. Route: `/admin/products/add`.

## UI
- Card 1 **Basic info**: barcode (+ auto-generate button), name (auto-filled "family brand model", editable), family/brand/model comboboxes with **inline create**, description.
- Card 2 **Initial stock**: initialQuantity (default 0); when > 0 an initialUnitCost field appears (required) and Card 3 unlocks.
- Card 3 **Pricing** (locked at qty 0 with an explanatory note): guestPrice (helper text: empty ⇒ hidden from guests and guest ordering blocked), defaultSalePrice*, the three category price fields each showing live margin % vs the entered cost, reorderThreshold.
- Card 4 **Images**: uploader (front-end max 3), primary flag, drag-to-reorder.
- `ConfirmationDialog` recapping everything before submit.

## Interactions
- Inline taxonomy create posts to the taxonomy endpoints and selects the new entity. Auto-name recomputes until manually edited.

## Forms
- `CreateProductCommand` via RHF + zodResolver with refines: initialUnitCost required iff initialQuantity > 0; pricing fields forbidden iff initialQuantity = 0 (mirrors the server's PRICING_REQUIRES_STOCK). Multipart submit → POST /api/admin/products; SKU/barcode uniqueness errors land on their fields; success → ADM-04 of the new product.

## Data dependencies
- `useFamilies()`, `useBrands()`, `useModels(brandId)`, `useClientCategories()`.
- Mutation: `useCreateProduct()` invalidates `['admin','products']` + stats.

## Access
- Admin only.
