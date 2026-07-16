# PUB-07 — Register

## Layout
- Public shell, mobile-first. Route: `/register`.

## UI
- Registration card (no password fields), `RegistrationConfirmationDialog` (recap), success panel.

## Interactions
- Fill → phone async check → recap dialog → confirm → success: "Thank you for registering — please wait for the admin's approval."
- Phone conflicts (from the async check): `registered` → "This phone number is already registered."; `pending` → "Your request is pending / being processed."

## Forms
- `RegisterClientCommand` via RHF + zodResolver: firstName*, lastName*, phone* (async-validated on blur via POST /api/auth/validate-phone), email?, storeName?, wilaya* → commune* (cascading). Submit → POST /api/auth/register; field-level errors; the dialog is the real submit gate.

## Data dependencies
- `useWilayas()`; `useValidatePhone()` (mutation, debounced); `useRegister()` — no cache invalidation needed.

## Access
- Public; authenticated clients redirected to `/my-account`.
