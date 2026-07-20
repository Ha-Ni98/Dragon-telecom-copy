import { HttpResponse } from "msw";
import type { ApiResponse, ErrorCode } from "@dragon-telecom/contract";

// Mirrors Apps/api's sendSuccess()/globalErrorHandler exactly (test-rules §3) so a handler
// can never drift from what the live API actually sends.
export function ok<T>(data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  return HttpResponse.json(body, { status });
}

export function fail(code: ErrorCode, message: string, status: number, details?: unknown) {
  const body: ApiResponse<never> = { success: false, error: { code, message, details } };
  return HttpResponse.json(body, { status });
}

// CONFIRMED (integration Sprint 4): every `sendSuccess(res, null, 204)` call in this backend
// (there's exactly one — clients' removeCartItem) still calls `.json(body)` in its own source,
// but the WHATWG Fetch spec forbids a body on a null-body status (204/205/304) — msw/undici
// enforce this, and a real browser's fetch/XHR would too, so that body cannot reliably survive
// the wire regardless of backend intent. Use this helper (not `ok(null, 204)`) for any 204
// endpoint; the matching service function must not read `res.data` at all — mirror
// auth.service.ts's logout() / clients.service.ts's removeFromCart(): bare `await api.x(...)`,
// let axios's automatic non-2xx rejection carry errors instead of a body check.
export function noContent() {
  return new HttpResponse(null, { status: 204 });
}
