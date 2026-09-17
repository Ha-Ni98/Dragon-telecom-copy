import {
  PRINT_BRIDGE_PATH,
  PRINT_BRIDGE_PRINT_TIMEOUT_MS,
  PRINT_BRIDGE_PROBE_TIMEOUT_MS,
  PRINT_BRIDGE_URL_STORAGE_KEY,
  type BridgeStatus,
  type PrintJob,
  type PrintOutcome,
} from "@/types/print-bridge.types";

// S27.1 — transport for the local print helper. Pure plumbing: no React, no toasts, no domain
// logic. The caller owns all UI feedback, exactly as lib/axios.ts's own header rule requires of
// the API client.
//
// WHY THIS USES `fetch` AND NOT THE SHARED AXIOS INSTANCE
// lib/axios.ts carries an explicit "exactly one axios instance (rules §3A)" rule. That rule is
// about the *backend API* — it exists so the auth-refresh and 401-redirect interceptors cannot be
// bypassed. Routing the bridge through `api` would be actively harmful, in two concrete ways:
//   1. the request interceptor attaches the user's Bearer access token — sending our session
//      credential to a third-party process running on the counter PC;
//   2. the response interceptor treats ANY 401 as an expired session, so a helper that answered
//      401 for its own reasons would silently LOG THE USER OUT of the app.
// A second axios instance would break §3A's letter for no benefit. A bare `fetch` with
// `credentials: "omit"` and no auth header is the correct client here.

function normaliseBaseUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

/** localStorage first, then the build-time env var. The app ships as ONE Vercel build serving
 *  every counter, so a build-time variable alone cannot describe a shop whose helper is not on
 *  the default host — the override is the same per-workstation reasoning use-label-size.ts
 *  records. `null` means "no helper configured": the feature is entirely off and every path is
 *  today's browser printing. */
export function getBridgeBaseUrl(): string | null {
  try {
    const stored = normaliseBaseUrl(localStorage.getItem(PRINT_BRIDGE_URL_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage disabled — fall through to the env var.
  }
  return normaliseBaseUrl(import.meta.env.VITE_PRINT_BRIDGE_URL as string | undefined);
}

/** Resolves `null` on ANY failure (not configured, unreachable, timeout, bad body) rather than
 *  rejecting — callers treat "no helper" as a normal state, not an error. Deliberately never
 *  throws, so a query using it cannot trip the global error toast. */
export async function probeBridge(): Promise<BridgeStatus | null> {
  const base = getBridgeBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}${PRINT_BRIDGE_PATH.STATUS}`, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
      signal: AbortSignal.timeout(PRINT_BRIDGE_PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && (body as BridgeStatus).ok === true) {
      return body as BridgeStatus;
    }
    return null;
  } catch {
    return null;
  }
}

/** Throws on any non-success so `printOrFallback` has a single catch. Success is narrow on
 *  purpose: HTTP 2xx AND `ok === true` in the body. Anything else — network error, timeout,
 *  non-2xx, `ok: false`, unparseable body — is a failure and must fall back. */
export async function sendToBridge(job: PrintJob): Promise<void> {
  const base = getBridgeBaseUrl();
  if (!base) throw new Error("print bridge not configured");

  const res = await fetch(`${base}${PRINT_BRIDGE_PATH.PRINT}`, {
    method: "POST",
    credentials: "omit",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(PRINT_BRIDGE_PRINT_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`print bridge returned ${res.status}`);

  const body: unknown = await res.json().catch(() => null);
  if (typeof body !== "object" || body === null || (body as { ok?: unknown }).ok !== true) {
    throw new Error("print bridge did not acknowledge the job");
  }
}

/** Chunked so a large ESC/POS payload cannot blow the argument limit on String.fromCharCode. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function newJobId(): string {
  return crypto.randomUUID();
}

/** The single entry point every print button uses. Never throws, never double-prints: the browser
 *  fallback runs if and only if the bridge attempt definitely failed.
 *
 *  The web deliberately does NOT retry a failed print — a retry is what turns a lost response
 *  into two pieces of paper. The helper de-duplicates on `jobId` if a human retries. */
export async function printOrFallback(
  job: PrintJob,
  browserFallback: () => void,
): Promise<PrintOutcome> {
  try {
    await sendToBridge(job);
    return "bridge";
  } catch {
    browserFallback();
    return "browser";
  }
}
