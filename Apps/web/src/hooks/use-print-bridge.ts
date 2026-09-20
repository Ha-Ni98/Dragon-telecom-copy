import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBridgeBaseUrl, probeBridge } from "@/lib/print-bridge";
import { qk } from "@/lib/query-keys";
import {
  PRINT_BRIDGE_DEFAULT_LABEL_DPI,
  PRINT_BRIDGE_DEFAULT_LABEL_LANGUAGE,
  PRINTER_MODE_STORAGE_KEY,
  PRINT_BRIDGE_PROBE_TTL_MS,
  type PrinterMode,
  type PrintLanguage,
} from "@/types/print-bridge.types";

// S27.1 — is the local print helper reachable?
//
// A query rather than a mount effect: the rules forbid effect-fetching, and a shared query key
// dedupes the probe between a label dialog and the receipt button living on the same screen.
//
// `enabled` on a configured URL is load-bearing beyond tidiness. The test setup runs MSW with
// `onUnhandledRequest: "error"`, and the repairs page test renders <StaffRepairs /> (which owns
// RepairTicketDetail, which mounts this hook). With VITE_PRINT_BRIDGE_URL left EMPTY in
// .env.test, getBridgeBaseUrl() is null, the query never runs, and no unmocked request can reach
// MSW. Do not "simplify" this to always-enabled.
//
// probeBridge() resolves null rather than rejecting, so this can never trip query-client.ts's
// global error toast.
export function usePrintBridgeStatus() {
  const configured = getBridgeBaseUrl() != null;

  const query = useQuery({
    queryKey: qk.printBridge.status(),
    queryFn: probeBridge,
    enabled: configured,
    retry: false,
    staleTime: PRINT_BRIDGE_PROBE_TTL_MS,
    refetchOnWindowFocus: false,
  });

  return {
    /** `true` = helper answered; `false` = configured but unreachable; `undefined` = not
     *  configured, or still probing. The UI shows a hint only for the two definite states. */
    available: configured ? (query.isPending ? undefined : query.data != null) : undefined,
    status: query.data ?? null,
    configured,
    /** The label printer's actual dpi if the helper reported one via /status, else the documented
     *  fallback. Every label dialog reads this instead of PRINT_BRIDGE_DEFAULT_LABEL_DPI directly,
     *  so a 300 dpi Zebra is a helper-config change, not a web rebuild — see
     *  print-bridge-plan-v1.md's G1. */
    labelDpi: query.data?.printers?.label?.dpi ?? PRINT_BRIDGE_DEFAULT_LABEL_DPI,
    /** Which language to build label jobs in, read from the same /status the dpi comes from.
     *
     *  This is not cosmetic: a Zebra sent the language it does not speak prints nothing at all —
     *  no error, no LED, no paper — which is exactly how the LP 2824 presented. Defaults to ZPL
     *  because that is what every modern Zebra speaks and what the browser-fallback path assumes;
     *  an EPL2-only printer declares itself in the helper's config and is picked up here. */
    labelLanguage: (query.data?.printers?.label?.language ??
      PRINT_BRIDGE_DEFAULT_LABEL_LANGUAGE) as PrintLanguage,
  };
}

const readStoredMode = (): PrinterMode => {
  try {
    const raw = localStorage.getItem(PRINTER_MODE_STORAGE_KEY);
    return raw === "browser" || raw === "thermal" ? raw : "thermal";
  } catch {
    return "thermal";
  }
};

// Per-workstation Thermal/Browser preference, defaulting to thermal (owner decision D5). Same
// try/catch-around-localStorage shape as use-label-size.ts — a browser with storage disabled must
// not crash a dialog. One preference per counter, so a counter that chose Browser gets browser
// printing for labels and receipts alike.
export function usePrinterMode(): [PrinterMode, (next: PrinterMode) => void] {
  const [mode, setMode] = useState<PrinterMode>(readStoredMode);

  const update = useCallback((next: PrinterMode) => {
    setMode(next);
    try {
      localStorage.setItem(PRINTER_MODE_STORAGE_KEY, next);
    } catch {
      // Storage disabled — the choice still holds for this session.
    }
  }, []);

  return [mode, update];
}
