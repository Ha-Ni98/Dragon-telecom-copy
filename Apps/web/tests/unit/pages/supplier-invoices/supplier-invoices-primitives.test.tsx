import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupplierInvoicesTable } from "@/pages/admin/supplier-invoices/components/supplier-invoices-table";
import { RepricePrompt } from "@/pages/admin/supplier-invoices/components/reprice-prompt";

describe("Supplier invoices page-local primitives", () => {
  it("SupplierInvoicesTable shows a skeleton while loading", () => {
    const { container } = render(
      <SupplierInvoicesTable data={undefined} isLoading onPageChange={vi.fn()} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("SupplierInvoicesTable shows the empty state with no rows", () => {
    render(<SupplierInvoicesTable data={undefined} isLoading={false} onPageChange={vi.fn()} />);
    expect(screen.getByText("admin.supplierInvoices.empty")).toBeInTheDocument();
  });

  it("RepricePrompt renders nothing with no candidates", () => {
    const { container } = render(
      <RepricePrompt candidates={[]} onApply={vi.fn()} onSkip={vi.fn()} onSkipAll={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
