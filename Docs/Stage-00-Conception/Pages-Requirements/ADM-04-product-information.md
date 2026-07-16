# ADM-04 — Product information

## Layout
- Admin shell, desktop-first, edit-mode section pattern (one header Edit/Save/Cancel spanning all cards). Route: `/admin/products/:id`.

## UI
- Header: name + barcode, back, edit toggle.
- Cards: details (name, description, taxonomy, barcode) · images · pricing (guest + default + 3 category prices, margin % vs avg cost) · **stock card** (on hand, reserved, available, avg cost, stock value, threshold).
- Tabs: **Movements** (IN rows show the layer's remaining qty; OUT rows show cost of goods + profit; each row links to its source document) · Supply history (supplier, qty, unit cost, landed cost, date) · Sales history (date, document, qty, resolved vs charged, profit).

## Interactions
- Edit mode turns cards into forms; Save patches core + pricing separately; Cancel restores. Tab tables paginate independently.

## Forms
- Details: subset of `CreateProductCommand` → PATCH /api/admin/products/:id.
- Pricing: `UpdatePricingCommand` → PATCH /api/admin/products/:id/pricing.

## Data dependencies
- `useAdminProduct(id)` → `['admin','products',id]`; `useProductMovements(id)` / `useProductSupplies(id)` / `useProductSales(id)` — each own key, lazy per tab.
- Mutations invalidate `['admin','products',id]` and the list key.

## Access
- Admin only.
