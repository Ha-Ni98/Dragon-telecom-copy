import { useCallback } from "react";
import { toast } from "sonner";
import { usePrintBridgeStatus } from "@/hooks/use-print-bridge";
import { useTranslation } from "@/hooks/useTranslation";
import { printReceipt } from "@/lib/print";
import { bytesToBase64, newJobId, printOrFallback } from "@/lib/print-bridge";

// The single receipt-printing path, shared by the POS, the repair ticket and the sales drawer.
// Previously each screen carried its own copy of this decision; the sales drawer had no copy at
// all and just called window.print(), printing the whole page instead of a receipt.
//
// DELIBERATELY IGNORES usePrinterMode. That preference is the Thermal/Browser radio in the three
// LABEL dialogs, and receipts used to read it too — so choosing "Browser" to print one barcode
// silently switched every POS and repair receipt to browser printing as well, with nothing on the
// receipt screens to show why or to switch back. A receipt now decides purely on whether the
// helper can reach a receipt printer.
//
// `receiptConnected === false` matters because the helper acknowledges a job when it is QUEUED,
// not when paper moves: a receipt sent to a printer the helper cannot see returns ok and produces
// nothing, with no fallback. An absent value still means "go ahead" — silence is not a negative.
export function useReceiptPrint() {
  const { t } = useTranslation();
  const { available, receiptConnected } = usePrintBridgeStatus();

  const canPrintThermally = available === true && receiptConnected !== false;

  // `buildBytes` is a callback rather than a ready-made array so the ESC/POS render only happens
  // on the thermal path — the browser path never pays for it.
  //
  // GESTURE-SAFETY: everything up to the first `await` runs synchronously inside the click
  // handler, so the browser-fallback branch reaches window.print() without leaving the user
  // gesture task. Do not add an `await` above that early return — `window.print()` called from a
  // later microtask is blocked or ignored by some browsers.
  const print = useCallback(
    async (buildBytes: () => Uint8Array, logoUrl?: string): Promise<void> => {
      if (!canPrintThermally) {
        printReceipt();
        return;
      }

      const outcome = await printOrFallback(
        {
          jobId: newJobId(),
          target: "receipt",
          language: "ESCPOS",
          encoding: "base64",
          payload: bytesToBase64(buildBytes()),
          copies: 1,
          ...(logoUrl != null && logoUrl !== "" ? { logoUrl } : {}),
        },
        printReceipt,
      );

      // Nothing visible happens on the thermal path, so silence would read as a dead button and
      // invite a second press — i.e. a real double print.
      if (outcome === "bridge") toast.success(t("common.print.bridge.sent"));
      else toast.warning(t("common.print.bridge.fallback"));
    },
    [canPrintThermally, t],
  );

  return { canPrintThermally, print };
}
