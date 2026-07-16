# Module: clients
Merges: client (web identity, registration, approval, self profile) + pos-client (commercial identity, credit/totalPaid/totalSold, carts).

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `CLIENT_ROUTES.VALIDATE_PHONE` | POST `/api/auth/validate-phone` | public | |
| `CLIENT_ROUTES.REGISTER` | POST `/api/auth/register` | public | no password; PENDING |
| `CLIENT_ROUTES.ME` | GET/PATCH `/api/clients/me` | client | phone read-only |
| `CLIENT_ROUTES.ME_PASSWORD` | POST `/api/clients/me/password` | client | |
| `CLIENT_ROUTES.CART` | GET/POST/DELETE `/api/clients/me/cart(/:productId)` | client | favorites, no qty |
| `CLIENT_ROUTES.ADMIN_LIST` | GET `/api/admin/clients` | admin | + stats route |
| `CLIENT_ROUTES.ADMIN_DETAIL` | GET `/api/admin/clients/:id` | admin | + `/activity` (observability read) |
| `CLIENT_ROUTES.APPROVE` | POST `/api/admin/clients/:id/approve` | admin | |
| `CLIENT_ROUTES.REJECT` | POST `/api/admin/clients/:id/reject` | admin | reason optional |
| `CLIENT_ROUTES.RESET_PASSWORD` | POST `/api/admin/clients/:id/reset-password` | admin | **sets a new password** |
| `CLIENT_ROUTES.ADMIN_UPDATE` | PATCH `/api/admin/clients/:id` | admin | contact, isEnabled |
| `POS_CLIENT_ROUTES.SEARCH` | GET `/api/staff/pos-clients/search?q=` | staff(STAFF_POS or STAFF_POS_CLIENTS)\|admin | name/phone |
| `POS_CLIENT_ROUTES.QUICK_CREATE` | POST `/api/staff/pos-clients` | staff(STAFF_POS_CLIENTS)\|admin | counter add |
| `POS_CLIENT_ROUTES.ADMIN` | GET/POST/PATCH `/api/admin/pos-clients(/:id)` | admin | the only manual client creation |

```
ValidatePhoneResultDto { isValid; status: 'available'|'registered'|'pending' }
RegisterClientCommand { firstName; lastName; phone; email?; storeName?; wilayaId; communeId }
ClientMeDto { id; firstName; lastName; phone; email?; storeName?; wilayaId; communeId; address?;
              createdAt; credit; totalPaid; totalSold }     // NO category, NO raw status
UpdateMeCommand { email?; storeName?; wilayaId?; communeId?; address? }
ApproveClientCommand { username; password; categoryId }
ResetClientPasswordCommand { newPassword: string.min(6) }
AdminClientDto { id; code; fullName; storeName?; username?; phone; email?; wilayaFr; communeFr;
                 categoryName?; status; isEnabled; totalOrders; totalSpent; lastOrderDate?; posClientId? }
PosClientDto { id; code; name; phone?; categoryId?; categoryName?; credit; totalPaid; totalSold;
               linkedClientId?; isEnabled }
CreatePosClientCommand { name; phone?; categoryId?; initialCredit? }
CartItemDto { productId; addedAt; product: ProductWithPricingDto }
```

## Events [CONTRACT]
- Emits `client.registered`, `client.approved { clientId; posClientSeed {name; phone; categoryId} }`, `client.rejected`, `client.passwordReset`, `posClient.creditChanged { posClientId; previousCredit; newCredit; cause }` (audit).
- Listens `client.approved` → (own listener) creates the linked PosClient + writes `Client.posClientId`, idempotent by clientId.
- Listens `sale.confirmed` → apply the event's credit snapshot; `totalPaid += paidAmount`; `totalSold += totalAmount`.
- Listens `order.confirmed` → `totalSold += totalAmount` (for the linked POS client, when any).
- Listens `payment.clientRecorded` → credit ↓ / totalPaid ↑ per snapshot.
- Listens `return.created` → apply refund effect per payload.

## Business Logic [BACKEND]
1. Phone check: match Client.phone → APPROVED ⇒ `registered`; PENDING ⇒ `pending`; none ⇒ `available`. Register re-runs it server-side; PENDING row, **no User row** — cannot authenticate.
2. **Approve (one transaction):** injected `UserService.createUser(type CLIENT)` → status APPROVED, approvedBy/At, userId → commit → emit; the PosClient listener runs after commit, idempotently. **Reset password:** injected `UserService.resetPassword` (revokes refresh tokens) + emit.
3. Me: phone immutable (400); profile edits never rewrite document snapshots; money figures proxied from the linked PosClient. Cart: PK (client, product), no quantity — the order form sets quantity.
4. PosClient caches (`credit`, `totalPaid`, `totalSold`) are event-maintained snapshots, idempotent by document id, and must equal ledger recomputation (conformance check). Category change affects future documents only. No category ⇒ POS default price.
5. Guests never create Client rows.

## Test Scenarios [BACKEND]
Phone three states; duplicate register 409 status-specific. Approve atomicity + replay ⇒ one PosClient. Reset password logs the client out everywhere. Me PATCH phone → 400. totalSold accrues from sales and orders exactly once each. Disabled PosClient not attachable at POS. Cache = ledger property test.
