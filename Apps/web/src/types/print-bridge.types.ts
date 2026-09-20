// S27.1 — the local print helper ("bridge"). Web-only, so this lives in `types/` and NOT in
// @dragon-telecom/contract: the bridge is a third-party process on the counter PC, not our
// backend. Nothing server-side reads any of this — same reasoning label-print.types.ts records.
//
// Why a bridge at all: a browser cannot write raw ZPL/ESC-POS bytes to a USB or network printer
// (no web API does this), and the API runs on Fly.io which cannot reach a printer behind the
// shop's NAT. A small helper on the counter PC, addressed over loopback HTTP, is the only path.
// WebUSB was considered and rejected: on Windows the vendor print driver claims the device and
// `claimInterface()` fails, and the usual Zadig/WinUSB workaround then breaks ordinary printing
// for the same printer — i.e. it would break the browser fallback this whole design depends on.

/** Where the helper listens. Read at runtime (see lib/print-bridge.ts's getBridgeBaseUrl) from
 *  localStorage first, then the build-time env var, so one Vercel build can serve counters whose
 *  helpers live on different hosts. */
export const PRINT_BRIDGE_URL_STORAGE_KEY = "dt_print_bridge_url";

/** Per-workstation Thermal/Browser preference. Same per-machine reasoning as the label size. */
export const PRINTER_MODE_STORAGE_KEY = "dt_printer_mode";

/** Availability probe. Must be short: it gates a dialog's status hint, and a hung helper must
 *  never make a Print button feel slow. */
export const PRINT_BRIDGE_PROBE_TIMEOUT_MS = 1500;

/** Print POST. This is an ACK timeout, not a "paper has stopped moving" timeout — the protocol
 *  requires the helper to answer as soon as the bytes are queued to the device. A helper that
 *  waits for physical completion will time out on a long receipt and cause a double print. */
export const PRINT_BRIDGE_PRINT_TIMEOUT_MS = 5000;

/** How long a probe result is trusted before being re-fetched. */
export const PRINT_BRIDGE_PROBE_TTL_MS = 30_000;

/** Fallback when the helper's /status does not report the label printer's resolution. 203 dpi is
 *  the common Zebra desktop default; 300 dpi models exist and report themselves. */
export const PRINT_BRIDGE_DEFAULT_LABEL_DPI = 203;

/** Fallback when the helper's /status does not report the label printer's language. ZPL is what
 *  every modern Zebra speaks and what the browser-fallback path assumes; an EPL2-only printer
 *  declares itself in the helper's own config. */
export const PRINT_BRIDGE_DEFAULT_LABEL_LANGUAGE = "ZPL";

export const PRINT_BRIDGE_PATH = {
  STATUS: "/status",
  PRINT: "/print",
} as const;

/** Per-workstation print preference. `thermal` is the default (owner decision D5) but it is only
 *  ever a *preference*: with no helper reachable, a thermal choice still prints via the browser. */
export type PrinterMode = "thermal" | "browser";

export type PrintTarget = "label" | "receipt";

/** ZPL or EPL drives the label printer; ESC/POS drives the 80 mm receipt printer. None of the
 *  three are interchangeable — a receipt printer does not understand ZPL, and a label printer
 *  given the wrong one of ZPL/EPL typically prints NOTHING AT ALL rather than erroring.
 *
 *  EPL2 is the older Eltron language still used by pre-"Plus" Zebra desktop units such as the
 *  shop's LP 2824, which has no ZPL interpreter whatsoever. Which one a label job is built in is
 *  therefore read per printer from the helper's /status rather than assumed — see
 *  use-print-bridge.ts's labelLanguage. */
export type PrintLanguage = "ZPL" | "EPL" | "ESCPOS";

export interface PrintJob {
  /** Client-generated, so the helper can de-duplicate a human double-click and correlate logs. */
  jobId: string;
  target: PrintTarget;
  language: PrintLanguage;
  /** Always base64 — one rule, no charset negotiation. ESC/POS payloads are arbitrary bytes
   *  (0x1B, 0x1D, code-page-encoded accents) that are not valid UTF-8 and cannot survive a JSON
   *  string; sending ZPL the same way keeps the helper's parsing uniform. */
  encoding: "base64";
  payload: string;
  /** Authoritative for ESC/POS (the helper writes the payload this many times). Redundant for ZPL,
   *  whose `^PQ` already carries it — the helper must send a ZPL payload exactly once. */
  copies: number;
  /** Protocol 1.1 addition (Sprint 6/7) — receipt jobs only. The store's print logo, so a helper
   *  can fetch and raster it server-side (no CORS constraint on the R2 bucket) rather than the
   *  browser having to draw it to canvas. Backward compatible both ways: an old helper ignores an
   *  unknown field, and omitting it here still prints — the web's own bold store-name line is the
   *  fallback the helper falls back to as well. */
  logoUrl?: string;
}

export interface BridgePrinterInfo {
  connected: boolean;
  language?: PrintLanguage;
  /** Label printer only — selects the mm→dots factor in lib/zpl.ts. */
  dpi?: number;
  /** Receipt printer only. */
  widthMm?: number;
}

export interface BridgeStatus {
  ok: true;
  version?: string;
  printers?: {
    label?: BridgePrinterInfo;
    receipt?: BridgePrinterInfo;
  };
}

/** What a print attempt actually did, so the caller can decide what (if anything) to tell the
 *  user. `bridge` = printed on the thermal hardware; `browser` = fell back to the print dialog. */
export type PrintOutcome = "bridge" | "browser";
