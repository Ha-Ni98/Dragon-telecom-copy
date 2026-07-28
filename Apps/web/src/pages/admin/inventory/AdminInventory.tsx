import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
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
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  useStock,
  useExportStockCsv,
  useMovements,
  useReservations,
  useCreateAdjustment,
} from "@/hooks/useInventory";
import { useAdminCatalogProducts } from "@/hooks/useCatalogProducts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";

// ADM-06 — Sprint 5 wiring. The product picker, the adjustment form's system-quantity map and its
// avgStockPrice map (S4, D10) all come from `useAdminCatalogProducts` (AdminProductDto carries
// `quantityOnHand` and `avgStockPrice`) rather than a second `useStock()` call — one fewer query,
// and it's the same "current on-hand" figure the Stock tab itself renders. Known limitation: that
// query is capped at `limit: 100`, so only the first 100 products are pickable/adjustable here.
export default function AdminInventory() {
  const { t } = useTranslation();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const debouncedStockSearch = useDebouncedValue(stockSearch, 300);
  const [movementFilters, setMovementFilters] = useState<MovementFiltersValue>({});
  const [movementSearch, setMovementSearch] = useState("");
  const debouncedMovementSearch = useDebouncedValue(movementSearch, 300);
  const [movementsPage, setMovementsPage] = useState(1);
  const [reservationsPage, setReservationsPage] = useState(1);

  const stockQuery = useMemo(
    () => ({ lowStockOnly, search: debouncedStockSearch.trim() || undefined }),
    [lowStockOnly, debouncedStockSearch],
  );
  const stock = useStock(stockQuery);
  const exportStockCsv = useExportStockCsv();

  const movementsQuery = useMemo(
    () => ({
      ...movementFilters,
      search: debouncedMovementSearch.trim() || undefined,
      page: movementsPage,
      limit: 20,
    }),
    [movementFilters, debouncedMovementSearch, movementsPage],
  );
  const movements = useMovements(movementsQuery);

  const reservationsQuery = useMemo(
    () => ({ page: reservationsPage, limit: 20 }),
    [reservationsPage],
  );
  const reservations = useReservations(reservationsQuery);

  const createAdjustment = useCreateAdjustment();

  const products = useAdminCatalogProducts({ page: 1, limit: 100 });
  const productOptions: AutocompleteOption[] = useMemo(
    () => (products.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
    [products.data],
  );
  const systemQuantityByProductId = useMemo(
    () => Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.quantityOnHand])),
    [products.data],
  );
  // D10 — the adjustment default and every margin read avgStockPrice (the quantity-weighted
  // figure), never avgPrice (which is supplier-invoice context only).
  const avgStockPriceByProductId = useMemo(
    () => Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.avgStockPrice])),
    [products.data],
  );

  const handleMovementFiltersChange = (value: MovementFiltersValue) => {
    setMovementFilters(value);
    setMovementsPage(1);
  };

  const handleMovementSearchChange = (value: string) => {
    setMovementSearch(value);
    setMovementsPage(1);
  };

  const handleExportCsv = () => {
    exportStockCsv.mutate(undefined, {
      onSuccess: (blob) => downloadBlob("stock.csv", blob),
    });
  };

  const handleAdjustmentSubmit = (values: AdjustmentFormValues) => {
    createAdjustment.mutate(values, {
      onSuccess: (result) => {
        toast.success(t("admin.inventory.adjustment.success", { reference: result.reference }));
      },
    });
  };

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
            data={stock.data ?? []}
            isLoading={stock.isLoading}
            isError={stock.isError}
            onRetry={() => stock.refetch()}
            search={stockSearch}
            onSearchChange={setStockSearch}
            lowStockOnly={lowStockOnly}
            onLowStockOnlyChange={setLowStockOnly}
            onExportCsv={handleExportCsv}
          />
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <InventoryFilters
            value={movementFilters}
            onChange={handleMovementFiltersChange}
            search={movementSearch}
            onSearchChange={handleMovementSearchChange}
          />
          <MovementLedgerTable
            data={movements.data?.items ?? []}
            isLoading={movements.isLoading}
            isError={movements.isError}
            onRetry={() => movements.refetch()}
          />
          {movements.data && (
            <SimplePagination
              page={movements.data.meta.page}
              totalPages={movements.data.meta.totalPages}
              onPageChange={setMovementsPage}
            />
          )}
        </TabsContent>

        <TabsContent value="reservations">
          <ReservationsTable
            data={reservations.data?.items ?? []}
            isLoading={reservations.isLoading}
            isError={reservations.isError}
            onRetry={() => reservations.refetch()}
          />
          {reservations.data && (
            <SimplePagination
              page={reservations.data.meta.page}
              totalPages={reservations.data.meta.totalPages}
              onPageChange={setReservationsPage}
            />
          )}
        </TabsContent>

        <TabsContent value="adjustments">
          <AdjustmentForm
            productOptions={productOptions}
            systemQuantityByProductId={systemQuantityByProductId}
            avgStockPriceByProductId={avgStockPriceByProductId}
            onSubmit={handleAdjustmentSubmit}
            isSubmitting={createAdjustment.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
