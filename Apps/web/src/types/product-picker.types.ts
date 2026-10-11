import type { ReactNode } from "react";

// S31 — the shared product-picker dialog (components/shared/product-picker-dialog.tsx) is generic
// over its row type; each consumer supplies the columns its context needs (repairs: available
// quantity + the four sale prices; supplier invoices: on-hand + avgPrice/avgStockPrice).
export interface ProductPickerRow {
  id: string;
  name: string;
  barcode?: string;
}

export interface ProductPickerColumn<T extends ProductPickerRow> {
  id: string;
  /** Already translated by the consumer (or data, e.g. a client-category name). */
  header: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}
