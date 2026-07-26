import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockSupplierInvoiceDraft,
  mockSupplierInvoicesPaginated,
} from "../../../fixtures/data/purchasing.mock";
import * as usePurchasingInvoicesHook from "@/hooks/usePurchasingInvoices";
import AdminSupplierInvoices from "@/pages/admin/supplier-invoices/AdminSupplierInvoices";

vi.mock("@/hooks/usePurchasingInvoices");

const refetchInvoices = vi.fn();

function mockInvoices(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(usePurchasingInvoicesHook.usePurchasingInvoices).mockReturnValue({
    data: mockSupplierInvoicesPaginated,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchInvoices,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoices();
});

describe("AdminSupplierInvoices (ADM-08 list) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockInvoices({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/supplier-invoices": <AdminSupplierInvoices /> },
      "/admin/supplier-invoices",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the query errors, and retry re-fetches", async () => {
    mockInvoices({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes(
      { "/admin/supplier-invoices": <AdminSupplierInvoices /> },
      "/admin/supplier-invoices",
    );

    expect(screen.getByText("admin.supplierInvoices.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchInvoices).toHaveBeenCalled();
  });

  it("renders invoice rows from the live hook with a link to the editor", () => {
    renderWithRoutes(
      { "/admin/supplier-invoices": <AdminSupplierInvoices /> },
      "/admin/supplier-invoices",
    );
    const link = screen.getAllByRole("link", { name: mockSupplierInvoiceDraft.reference })[0];
    expect(link).toHaveAttribute("href", `/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);
  });
});
