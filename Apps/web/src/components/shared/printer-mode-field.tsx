import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslation } from "@/hooks/useTranslation";
import type { PrinterMode } from "@/types/print-bridge.types";

interface PrinterModeFieldProps {
  value: PrinterMode;
  onChange: (mode: PrinterMode) => void;
  /** `true` = helper reachable, `false` = configured but unreachable, `undefined` = not
   *  configured or still probing. Only the two definite states show a hint. */
  bridgeAvailable: boolean | undefined;
}

// S27.1 — Thermal vs Browser, shared by all three label dialogs so they cannot drift.
//
// This is a PREFERENCE, never a gate: choosing Thermal with no helper reachable still prints, via
// the browser, with the hint below already explaining why. That is exactly the owner's "use the
// helper if it exists, otherwise use browser printing", while leaving an explicit escape hatch for
// a counter that wants a plain browser print even when the helper is up.
//
// A RadioGroup rather than a Select: two mutually exclusive options read better inline, and both
// are visible without opening anything — which matters because the hint underneath changes the
// meaning of the choice.
export function PrinterModeField({ value, onChange, bridgeAvailable }: PrinterModeFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <Label>{t("common.print.mode.label")}</Label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as PrinterMode)}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="thermal" id="printer-mode-thermal" />
          <Label htmlFor="printer-mode-thermal" className="font-normal">
            {t("common.print.mode.thermal")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="browser" id="printer-mode-browser" />
          <Label htmlFor="printer-mode-browser" className="font-normal">
            {t("common.print.mode.browser")}
          </Label>
        </div>
      </RadioGroup>

      {bridgeAvailable === true && (
        <p className="text-xs text-muted-foreground">{t("common.print.bridge.detected")}</p>
      )}
      {bridgeAvailable === false && (
        <p className="text-xs text-muted-foreground">{t("common.print.bridge.missing")}</p>
      )}
    </div>
  );
}
