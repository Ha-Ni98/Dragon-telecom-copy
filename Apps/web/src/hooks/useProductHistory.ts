import { useQuery } from "@tanstack/react-query";
import { MovementDirection } from "@dragon-telecom/contract";
import type { MovementDto } from "@dragon-telecom/contract";
import * as purchasingService from "@/services/purchasing.service";
import * as inventoryService from "@/services/inventory.service";
import { qk } from "@/lib/query-keys";

// set-03 A4 — ADM-04's Supply history / Sales history tabs. No new endpoints: Supply history
// reuses `usePurchasingInvoices`' underlying service with the new `productId` filter (set-03
// A4, purchasing.query.ts), flattened to just this product's own line per invoice (an invoice
// can cover several products); Sales history reuses `useMovements`' underlying service,
// client-filtered to OUT rows via `select` (MovementsQuery has no direction filter server-side).

export interface ProductSupplyHistoryRow {
  invoiceId: string;
  invoiceReference: string;
  supplierName: string;
  date: string;
  quantity: number;
  unitCost: number;
  landedCost: number;
}

export function useProductSupplyHistory(productId: string) {
  return useQuery({
    queryKey: qk.purchasing.invoices.list({ productId, page: 1, limit: 20 }),
    queryFn: () => purchasingService.listSupplierInvoices({ productId, page: 1, limit: 20 }),
    select: (data): ProductSupplyHistoryRow[] =>
      data.items.flatMap((invoice) =>
        invoice.lines
          .filter((line) => line.productId === productId)
          .map((line) => ({
            invoiceId: invoice.id,
            invoiceReference: invoice.reference,
            supplierName: invoice.supplierName,
            date: invoice.invoiceDate,
            quantity: line.quantity,
            unitCost: line.unitCost,
            landedCost: line.landedUnitCost,
          })),
      ),
    enabled: !!productId,
  });
}

export function useProductSalesHistory(productId: string) {
  return useQuery({
    queryKey: qk.inventory.movements.list({ productId, page: 1, limit: 20 }),
    queryFn: () => inventoryService.listMovements({ productId, page: 1, limit: 20 }),
    select: (data): MovementDto[] =>
      data.items.filter((movement) => movement.direction === MovementDirection.OUT),
    enabled: !!productId,
  });
}
