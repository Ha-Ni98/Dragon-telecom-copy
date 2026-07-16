# Module Specification: Delivery Company

> **TEMPLATE BASELINE / REFERENCE MODULE:** already implemented end-to-end
> (`Apps/contract/src/modules/delivery-company`, `Apps/api/src/modules/delivery-company`,
> and the frontend service/hook/page). This is the worked example — mirror its shape when you
> author a new module. The "Consumed by: Order module" note below is from the original app;
> the template has no Order module.

## 1. Context [CONTRACT]
- Prisma Entity: `DeliveryCompany`
- Depends on: `common` (`ApiResponse`, `ErrorCode`)

## 2. API Interface [CONTRACT]
`DELIVERY_COMPANY_ROUTES` (`BASE: '/delivery-companies'`). All routes Admin-only.

- Route Constant: `DELIVERY_COMPANY_ROUTES.GET_ALL` (GET `/delivery-companies`)
  - Access: Admin
  - Input (body): none
  - Input (query/params): `GetDeliveryCompaniesQuery` { active? } — when `active=true`, only enabled companies (for the order picker); omitted returns all (for management)
  - Output: `DeliveryCompanyDTO[]` (unpaginated — small managed list)

- Route Constant: `DELIVERY_COMPANY_ROUTES.CREATE` (POST `/delivery-companies`)
  - Access: Admin
  - Input (body): `CreateDeliveryCompanyCommand` { name, registeredName }
  - Input (query/params): none
  - Output: `DeliveryCompanyDTO`

- Route Constant: `DELIVERY_COMPANY_ROUTES.UPDATE` (PATCH `/delivery-companies/:id`)
  - Access: Admin
  - Input (body): `UpdateDeliveryCompanyCommand` { name?, registeredName? }
  - Input (query/params): `DeliveryCompanyIdParams` { id }
  - Output: `DeliveryCompanyDTO`

- Route Constant: `DELIVERY_COMPANY_ROUTES.TOGGLE` (POST `/delivery-companies/:id/toggle`)
  - Access: Admin
  - Input (body): none
  - Input (query/params): `DeliveryCompanyIdParams`
  - Output: `DeliveryCompanyDTO`

`DeliveryCompanyDTO` = { id, name, registeredName, isActive }.

> No `DELETE` route by design: delivery companies are referenced by historical `Order` rows, so they are **deactivated** (toggle `isActive` → false), which removes them from the order picker while preserving past orders. Deactivation is the only retirement path.

## 3. Events [CONTRACT]
(none)

## 4. Business Logic (Service) [BACKEND]
- **getAll:** require admin → query `DeliveryCompany`, apply the `active` filter when present → order by `name` → map.
- **create:** require admin → validate command → create the row (`isActive` defaults true) → return.
- **update:** require admin → load by id or `RESOURCE_NOT_FOUND` → apply the provided fields → return.
- **toggle:** require admin → load by id or `RESOURCE_NOT_FOUND` → flip `isActive` → return.

## 5. Data Mapping [BACKEND]
- **toDTO:** pass through { id, name, registeredName, isActive }. No sensitive fields; no date fields on this entity, so no ISO conversion needed.
- **toPersistence:** trim `name` and `registeredName`.

## 6. Technical Constraints [BACKEND]
- These changes write **no `Log` row** — there is no matching `LogActionType` value, and the "logs limited to the enum" rule applies. Retirement is via deactivation only (no hard delete). `name` is not enforced unique at the schema level; the service may reject an exact duplicate name with `RESOURCE_CONFLICT` if you want that guard (off by default).

## 7. Test Scenarios [BACKEND]
- 200 — list all (admin); 200 — list with `active=true` returns only enabled companies; 403 `AUTH_FORBIDDEN` for a non-admin principal.
- 201/200 — create returns the new `DeliveryCompanyDTO` with `isActive=true`.
- 200 — update changes name/registeredName; 404 `RESOURCE_NOT_FOUND` for an unknown id.
- 200 — toggle flips `isActive`; toggling again restores it; 404 for an unknown id.
