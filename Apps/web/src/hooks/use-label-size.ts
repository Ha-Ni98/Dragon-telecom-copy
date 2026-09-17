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

const readStoredSize = (storageKey: string): LabelSize => {
  try {
    const raw = localStorage.getItem(storageKey);
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
//
// S27.1 — parameterised by storage key rather than copy-pasted: the repair client label is a
// different physical stock on a different bench from the product/supplier labels, so it remembers
// its own size under REPAIR_LABEL_SIZE_STORAGE_KEY. The key is read once, on mount, so passing a
// different one per call site gives two independent preferences with one implementation.
export function useLabelSize(
  storageKey: string = LABEL_SIZE_STORAGE_KEY,
): [LabelSize, (next: LabelSize) => void] {
  const [size, setSize] = useState<LabelSize>(() => readStoredSize(storageKey));

  const update = useCallback(
    (next: LabelSize) => {
      setSize(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage disabled/full — the size still works for this session, it just won't persist.
      }
    },
    [storageKey],
  );

  return [size, update];
}
