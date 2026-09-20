import { buildEplBatch, buildEplLabel } from "@/lib/epl";
import { buildZplBatch, buildZplLabel } from "@/lib/zpl";
import type { LabelInput } from "@/types/label-print.types";
import type { PrintLanguage } from "@/types/print-bridge.types";

// One place that decides which label language a job is built in, rather than the same ternary
// copied into every label dialog. Three copies of that branch is precisely the drift the shared
// LabelInput type exists to prevent — a fourth label screen should not be able to forget EPL.
//
// The language comes from the helper's /status (see use-print-bridge.ts's labelLanguage), because
// a label printer handed the language it does not speak prints nothing at all — no error, no LED,
// no paper. Anything other than EPL falls through to ZPL: it is what every modern Zebra speaks and
// what the browser-fallback path assumes, so it is the safe default for an unexpected value.
// "ESCPOS" is in PrintLanguage for the receipt printer and is never a label language.

export function buildLabel(language: PrintLanguage, input: LabelInput): string {
  return language === "EPL" ? buildEplLabel(input) : buildZplLabel(input);
}

export function buildLabelBatch(language: PrintLanguage, inputs: LabelInput[]): string {
  return language === "EPL" ? buildEplBatch(inputs) : buildZplBatch(inputs);
}
