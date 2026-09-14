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
import { StockAdjustDialog } from "@/pages/admin/inventory/components/stock-adjust-dialog";
import {
  type AdjustmentFormValues,
  toCreateAdjustmentCommand,
} from "@/pages/admin/inventory/components/adjustment.schema";
import type { StockRowDto } from "@dragon-telecom/contract";
import {
  useStock,
  useExportStock,
  useMovements,
  useExportMovements,
  useReservations,
  useCreateAdjustment,
} from "@/hooks/useInventory";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBlob } from "@/lib/utils";

// ADM-06 — Sprint 5 wiring. S28 — the Stock tab is now server-paginated (20/page) and the
// Adjustments tab's product picker searches the whole catalogue server-side
// (use-adjustment-products.ts), so this page no longer loads a single capped
// `useAdminCatalogProducts({ page: 1, limit: 100 })` for both surfaces.
export default function AdminInventory() {
  const { t } = useTranslation();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const debouncedStockSearch = useDebouncedValue(stockSearch, 300);
  const [stockPage, setStockPage] = useState(1);
  const [movementFilters, setMovementFilters] = useState<MovementFiltersValue>({});
  const [movementSearch, setMovementSearch] = useState("");
  const debouncedMovementSearch = useDebouncedValue(movementSearch, 300);
  const [movementsPage, setMovementsPage] = useState(1);
  const [reservationsPage, setReservationsPage] = useState(1);
  const [adjustRow, setAdjustRow] = useState<StockRowDto | null>(null);

  // Same filters the stock table is rendered from, minus page/limit — the export is the whole
  // filtered stock table (S25/S28), never the visible page.
  const stockExportQuery = useMemo(
    () => ({ lowStockOnly, search: debouncedStockSearch.trim() || undefined }),
    [lowStockOnly, debouncedStockSearch],
  );
  const stockQuery = useMemo(
    () => ({ ...stockExportQuery, page: stockPage, limit: 20 }),
    [stockExportQuery, stockPage],
  );
  const stock = useStock(stockQuery);
  const exportStock = useExportStock();

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
  // Same filters the ledger table is rendered from, minus page/limit — the export is the whole
  // filtered result set (S25), never the visible page.
  const movementsExportQuery = useMemo(
    () => ({ ...movementFilters, search: debouncedMovementSearch.trim() || undefined }),
    [movementFilters, debouncedMovementSearch],
  );
  const exportMovements = useExportMovements();

  const reservationsQuery = useMemo(
    () => ({ page: reservationsPage, limit: 20 }),
    [reservationsPage],
  );
  const reservations = useReservations(reservationsQuery);

  const createAdjustment = useCreateAdjustment();

  const handleStockSearchChange = (value: string) => {
    setStockSearch(value);
    setStockPage(1);
  };

  const handleLowStockOnlyChange = (value: boolean) => {
    setLowStockOnly(value);
    setStockPage(1);
  };

  const handleMovementFiltersChange = (value: MovementFiltersValue) => {
    setMovementFilters(value);
    setMovementsPage(1);
  };

  const handleMovementSearchChange = (value: string) => {
    setMovementSearch(value);
    setMovementsPage(1);
  };

  const handleExportStock = (format: "csv" | "pdf") => {
    exportStock.mutate(
      { query: stockExportQuery, format },
      { onSuccess: (blob) => downloadBlob(`stock.${format}`, blob) },
    );
  };

  const handleExportMovements = (format: "csv" | "pdf") => {
    exportMovements.mutate(
      { query: movementsExportQuery, format },
      { onSuccess: (blob) => downloadBlob(`movements.${format}`, blob) },
    );
  };

  const handleAdjustmentSubmit = (values: AdjustmentFormValues) => {
    createAdjustment.mutate(toCreateAdjustmentCommand(values), {
      onSuccess: (result) => {
        toast.success(t("admin.inventory.adjustment.success", { reference: result.reference }));
        setAdjustRow(null);
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

        <TabsContent value="stock" className="space-y-4">
          <StockLevelsTable
            data={stock.data?.items ?? []}
            isLoading={stock.isLoading}
            isError={stock.isError}
            onRetry={() => stock.refetch()}
            search={stockSearch}
            onSearchChange={handleStockSearchChange}
            lowStockOnly={lowStockOnly}
            onLowStockOnlyChange={handleLowStockOnlyChange}
            onExport={handleExportStock}
            isExporting={exportStock.isPending}
            onAdjust={setAdjustRow}
          />
          {stock.data && (
            <SimplePagination
              page={stock.data.meta.page}
              totalPages={stock.data.meta.totalPages}
              onPageChange={setStockPage}
            />
          )}
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
            onExport={handleExportMovements}
            isExporting={exportMovements.isPending}
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
            onSubmit={handleAdjustmentSubmit}
            isSubmitting={createAdjustment.isPending}
          />
        </TabsContent>
      </Tabs>

      <StockAdjustDialog
        row={adjustRow}
        open={adjustRow != null}
        onOpenChange={(open) => {
          if (!open) setAdjustRow(null);
        }}
        onSubmit={handleAdjustmentSubmit}
        isSubmitting={createAdjustment.isPending}
      />
    </div>
  );
}
