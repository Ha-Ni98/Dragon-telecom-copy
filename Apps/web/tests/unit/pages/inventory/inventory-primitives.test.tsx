import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StockLevelsTable } from "@/pages/admin/inventory/components/stock-levels-table";
import { MovementLedgerTable } from "@/pages/admin/inventory/components/movement-ledger-table";
import { ReservationsTable } from "@/pages/admin/inventory/components/reservations-table";

// Sprint 4 (set-04) — render each new page-local primitive in isolation with static props;
// assert the loading skeleton and the empty state both render (no data-fetching involved yet).
describe("Inventory page-local primitives", () => {
  it("StockLevelsTable shows a skeleton while loading", () => {
    const { container } = render(
      <StockLevelsTable data={[]} isLoading lowStockOnly={false} onLowStockOnlyChange={vi.fn()} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("StockLevelsTable shows the empty state with no rows", () => {
    render(
      <StockLevelsTable
        data={[]}
        isLoading={false}
        lowStockOnly={false}
        onLowStockOnlyChange={vi.fn()}
      />,
    );
    expect(screen.getByText("admin.inventory.stock.empty")).toBeInTheDocument();
  });

  it("MovementLedgerTable shows a skeleton while loading", () => {
    const { container } = render(<MovementLedgerTable data={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("MovementLedgerTable shows the empty state with no rows", () => {
    render(<MovementLedgerTable data={[]} isLoading={false} />);
    expect(screen.getByText("admin.inventory.movements.empty")).toBeInTheDocument();
  });

  it("ReservationsTable shows a skeleton while loading", () => {
    const { container } = render(<ReservationsTable data={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("ReservationsTable shows the empty state with no rows", () => {
    render(<ReservationsTable data={[]} isLoading={false} />);
    expect(screen.getByText("admin.inventory.reservations.empty")).toBeInTheDocument();
  });
});
