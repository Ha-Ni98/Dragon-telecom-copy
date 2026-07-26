import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PosClientsTable } from "@/pages/admin/pos-clients/components/pos-clients-table";
import { PosClientDetailDrawer } from "@/pages/admin/pos-clients/components/pos-client-detail-drawer";

describe("POS clients page-local primitives", () => {
  it("PosClientsTable shows a skeleton while loading", () => {
    const { container } = render(
      <PosClientsTable data={undefined} isLoading onRowClick={vi.fn()} onPageChange={vi.fn()} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("PosClientsTable shows the empty state with no rows", () => {
    render(
      <PosClientsTable
        data={undefined}
        isLoading={false}
        onRowClick={vi.fn()}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText("admin.posClients.empty")).toBeInTheDocument();
  });

  it("PosClientDetailDrawer renders nothing with no client selected", () => {
    const { container } = render(
      <PosClientDetailDrawer open={false} onOpenChange={vi.fn()} client={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
