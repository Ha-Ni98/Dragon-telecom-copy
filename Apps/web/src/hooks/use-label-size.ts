import { useCallback, useState } from "react";
import {
  DEFAULT_LABEL_SIZE,
  LABEL_CUSTOM_MAX_MM,
  LABEL_CUSTOM_MIN_MM,
  LABEL_SIZE_STORAGE_KEY,
  type LabelSize,
} from "@/types/label-print.types";

const isValidSize = (value: unknown): value is LabelSize =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as LabelSize).widthMm === "number" &&
  typeof (value as LabelSize).heightMm === "number" &&
  Number.isFinite((value as LabelSize).widthMm) &&
  Number.isFinite((value as LabelSize).heightMm) &&
  (value as LabelSize).widthMm >= LABEL_CUSTOM_MIN_MM &&
  (value as LabelSize).widthMm <= LABEL_CUSTOM_MAX_MM &&
  (value as LabelSize).heightMm >= LABEL_CUSTOM_MIN_MM &&
  (value as LabelSize).heightMm <= LABEL_CUSTOM_MAX_MM;

const readStoredSize = (): LabelSize => {
  try {
    const raw = localStorage.getItem(LABEL_SIZE_STORAGE_KEY);
    if (!raw) return DEFAULT_LABEL_SIZE;
    const parsed: unknown = JSON.parse(raw);
    return isValidSize(parsed) ? parsed : DEFAULT_LABEL_SIZE;
  } catch {
    return DEFAULT_LABEL_SIZE;
  }
};

// S27 — "Remember the last chosen size so the counter isn't re-picking it every time."
// localStorage, not a server setting: this is a per-workstation property (the label printer
// loaded at that counter), not a store-wide one. Same try/catch-around-read shape as
// hooks/use-search.ts, because a browser with storage disabled must not crash the dialog.
export function useLabelSize(): [LabelSize, (next: LabelSize) => void] {
  const [size, setSize] = useState<LabelSize>(readStoredSize);

  const update = useCallback((next: LabelSize) => {
    setSize(next);
    try {
      localStorage.setItem(LABEL_SIZE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage disabled/full — the size still works for this session, it just won't persist.
    }
  }, []);

  return [size, update];
}
