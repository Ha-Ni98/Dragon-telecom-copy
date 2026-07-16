# Error Codes Reference

The single, shared set of error codes for the whole monorepo. The **enum** is a `[CONTRACT]` artifact (`Apps/contract/src/common/errors.ts`) consumed by both backend and frontend; the **code → HTTP status** mapping is owned by the backend error handler `[BACKEND]`. Every failed response uses the one envelope:

```
{ success: false, error: { code: ErrorCode, message: string, details?: unknown } }
```

`message` is human-readable; `details` is optional (e.g. field-level validation issues). The frontend switches on `code`, never on `message`.

---

## Codes (the baseline set)

| Error Code | HTTP | Description |
|------------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | **401** | Login failed. Always generic — never reveals which part was wrong. |
| `AUTH_UNAUTHORIZED` | **401** | Not authenticated, or the credential/token is missing, expired, or invalid. |
| `AUTH_FORBIDDEN` | **403** | Authenticated, but the principal lacks permission for this action (wrong role, or a self-action guard). |
| `VALIDATION_ERROR` | **400** | Input failed schema or business validation. `details` carries the field issues. |
| `RESOURCE_NOT_FOUND` | **404** | The referenced entity does not exist. |
| `RESOURCE_CONFLICT` | **409** | The request conflicts with current state or a uniqueness rule (duplicate key, illegal state transition). |
| `RATE_LIMITED` | **429** | Too many requests in the window (e.g. the failed-login lockout). |
| `INTERNAL_SERVER_ERROR` | **500** | Unexpected, unhandled failure. The fallback when nothing more specific applies. |

> EXTENSION POINT: this is the baseline. If a new module needs a code not covered here, add it
> to `ErrorCode` in the contract and map its HTTP status in the backend error handler — never
> switch on `message`.

---

## Enum (`Apps/contract/src/common/errors.ts`)

```typescript
export enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS', // 401
  AUTH_UNAUTHORIZED        = 'AUTH_UNAUTHORIZED',        // 401
  AUTH_FORBIDDEN           = 'AUTH_FORBIDDEN',           // 403
  VALIDATION_ERROR         = 'VALIDATION_ERROR',         // 400
  RESOURCE_NOT_FOUND       = 'RESOURCE_NOT_FOUND',       // 404
  RESOURCE_CONFLICT        = 'RESOURCE_CONFLICT',        // 409
  RATE_LIMITED             = 'RATE_LIMITED',             // 429
  INTERNAL_SERVER_ERROR    = 'INTERNAL_SERVER_ERROR',    // 500
}
```

---

## Conventions

- **401 vs 403:** `AUTH_UNAUTHORIZED` = *not authenticated* (no/invalid token); `AUTH_FORBIDDEN` = *authenticated but not allowed* (wrong role or a self-action guard).
- **Generic auth message:** all login failure modes return the same `AUTH_INVALID_CREDENTIALS` message — the server never discloses whether the username existed or the account was disabled.
- **Validation details:** `VALIDATION_ERROR` should populate `details` with the offending fields so the frontend can map errors to inputs.
- **No leaking internals:** `INTERNAL_SERVER_ERROR` carries a generic message; the real cause is logged server-side, never returned.
- **Mapping ownership:** the HTTP column is implemented once in the backend error handler (Stage 2 Sub-01); services throw typed errors carrying an `ErrorCode`, and the handler translates code → status + envelope.
