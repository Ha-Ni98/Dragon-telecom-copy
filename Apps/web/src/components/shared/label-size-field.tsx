import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import {
  LABEL_CUSTOM_MAX_MM,
  LABEL_CUSTOM_MIN_MM,
  LABEL_SIZE_PRESETS,
  BARCODE_MIN_MODULE_MM,
  type LabelSize,
} from "@/types/label-print.types";

interface LabelSizeFieldProps {
  value: LabelSize;
  onChange: (size: LabelSize) => void;
  /** Millimetres per barcode module at the current size, when known — drives the scan warning. */
  moduleMm?: number;
}

const CUSTOM_VALUE = "custom";

const presetKey = (size: LabelSize): string => `${size.widthMm}x${size.heightMm}`;

const clampCustomMm = (raw: number): number =>
  Number.isFinite(raw)
    ? Math.min(Math.max(raw, LABEL_CUSTOM_MIN_MM), LABEL_CUSTOM_MAX_MM)
    : LABEL_CUSTOM_MIN_MM;

// S27 — shared by both label dialogs (products and supplier invoices) so they cannot offer
// different sizes. Presets come from LABEL_SIZE_PRESETS (types/label-print.types.ts); the last
// entry is always "custom", a free width x height pair clamped to the same bounds every dialog
// disables Print past. Persistence ("remember the last chosen size") lives in the caller's
// useLabelSize() hook, not here — this component only renders the current value.
export function LabelSizeField({ value, onChange, moduleMm }: LabelSizeFieldProps) {
  const { t } = useTranslation();

  const matchedPresetKey = useMemo(
    () =>
      LABEL_SIZE_PRESETS.find((p) => p.widthMm === value.widthMm && p.heightMm === value.heightMm)
        ? presetKey(value)
        : CUSTOM_VALUE,
    [value],
  );
  // Tracks an explicit "Custom" pick that hasn't diverged from a preset's numbers yet — without
  // this, picking Custom while the value still equals a preset (e.g. the 50x25 default) would
  // have matchedPresetKey snap straight back to that preset and the width/height inputs would
  // never appear.
  const [manualCustom, setManualCustom] = useState(false);
  const isCustom = manualCustom || matchedPresetKey === CUSTOM_VALUE;
  const selectValue = isCustom ? CUSTOM_VALUE : matchedPresetKey;

  const handleSelect = (selected: string) => {
    if (selected === CUSTOM_VALUE) {
      setManualCustom(true);
      return;
    }
    setManualCustom(false);
    const preset = LABEL_SIZE_PRESETS.find((p) => presetKey(p) === selected);
    if (preset) onChange(preset);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor="label-size-select">{t("admin.labelSize.label")}</Label>
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger id="label-size-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LABEL_SIZE_PRESETS.map((preset) => (
            <SelectItem key={presetKey(preset)} value={presetKey(preset)}>
              {preset.widthMm} × {preset.heightMm} mm
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>{t("admin.labelSize.custom")}</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="flex gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Label htmlFor="label-size-width" className="text-xs text-muted-foreground">
              {t("admin.labelSize.width")}
            </Label>
            <Input
              id="label-size-width"
              type="number"
              min={LABEL_CUSTOM_MIN_MM}
              max={LABEL_CUSTOM_MAX_MM}
              step={5}
              value={value.widthMm}
              onChange={(event) =>
                onChange({ ...value, widthMm: clampCustomMm(Number(event.target.value)) })
              }
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="label-size-height" className="text-xs text-muted-foreground">
              {t("admin.labelSize.height")}
            </Label>
            <Input
              id="label-size-height"
              type="number"
              min={LABEL_CUSTOM_MIN_MM}
              max={LABEL_CUSTOM_MAX_MM}
              step={5}
              value={value.heightMm}
              onChange={(event) =>
                onChange({ ...value, heightMm: clampCustomMm(Number(event.target.value)) })
              }
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("admin.labelSize.helper")}</p>

      {/* Warn only — never disable Print. The owner may knowingly print a dense label for a
          short barcode. */}
      {moduleMm != null && moduleMm < BARCODE_MIN_MODULE_MM && (
        <p className="text-xs text-destructive">
          {t("admin.labelSize.tooNarrow", { min: BARCODE_MIN_MODULE_MM })}
        </p>
      )}
    </div>
  );
}
