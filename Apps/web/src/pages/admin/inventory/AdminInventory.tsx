import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, ClipboardList, Clock, Wrench } from "lucide-react";
import { StockLevelsTable } from "@/pages/admin/inventory/components/stock-levels-table";
import { MovementLedgerTable } from "@/pages/admin/inventory/components/movement-ledger-table";
import { ReservationsTable } from "@/pages/admin/inventory/components/reservations-table";
import {
  InventoryFilters,
  type MovementFiltersValue,
} from "@/pages/admin/inventory/components/inventory-filters";
import { AdjustmentForm } from "@/pages/admin/inventory/components/adjustment-form";
import type { AdjustmentFormValues } from "@/pages/admin/inventory/components/adjustment.schema";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-06 — page-local primitives assembled (Sprint 4, no data yet). Every tab's data is a
// static empty array; Sprint 5 wires `useStock`/`useMovements`/`useReservations`/
// `useCreateAdjustment`. The Adjustments tab only mounts its (heavier) form once activated —
// `forceMount` is never set, so `TabsContent` already lazy-mounts by default.
export default function AdminInventory() {
  const { t } = useTranslation();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [movementFilters, setMovementFilters] = useState<MovementFiltersValue>({});

  const handleAdjustmentSubmit = (_values: AdjustmentFormValues) => {};

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.inventory.title")} subtitle={t("admin.inventory.description")} />

      <Tabs defaultValue="stock">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="stock" className="gap-2">
            <Boxes className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.inventory.tabs.stock")}</span>
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.inventory.tabs.movements")}</span>
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.inventory.tabs.reservations")}</span>
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="gap-2">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.inventory.tabs.adjustments")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <StockLevelsTable
            data={[]}
            isLoading={false}
            lowStockOnly={lowStockOnly}
            onLowStockOnlyChange={setLowStockOnly}
          />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <InventoryFilters value={movementFilters} onChange={setMovementFilters} />
          <MovementLedgerTable data={[]} isLoading={false} />
        </TabsContent>

        <TabsContent value="reservations">
          <ReservationsTable data={[]} isLoading={false} />
        </TabsContent>

        <TabsContent value="adjustments">
          <AdjustmentForm
            productOptions={[]}
            systemQuantityByProductId={{}}
            onSubmit={handleAdjustmentSubmit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
