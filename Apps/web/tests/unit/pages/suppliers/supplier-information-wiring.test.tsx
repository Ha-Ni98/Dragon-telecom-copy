import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockSupplierDetail } from "../../../fixtures/data/purchasing.mock";
import * as usePurchasingSuppliersHook from "@/hooks/usePurchasingSuppliers";
import AdminSupplierInformation from "@/pages/admin/suppliers/AdminSupplierInformation";

vi.mock("@/hooks/usePurchasingSuppliers");

const refetchDetail = vi.fn();
const updateMutate = vi.fn();

function mockDetail(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(usePurchasingSuppliersHook.usePurchasingSupplierDetail).mockReturnValue({
    data: mockSupplierDetail,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchDetail,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDetail();
  vi.mocked(usePurchasingSuppliersHook.useUpdatePurchasingSupplier).mockReturnValue({
    mutateAsync: updateMutate,
    isPending: false,
  } as never);
});

function renderDetail() {
  return renderWithRoutes(
    { "/admin/suppliers/:idSupplier": <AdminSupplierInformation /> },
    `/admin/suppliers/${mockSupplierDetail.supplier.id}`,
  );
}

describe("AdminSupplierInformation (ADM-07 detail) wiring", () => {
  it("shows a skeleton while loading", () => {
    mockDetail({ isLoading: true });
    const { container } = renderDetail();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows NotFoundState when the detail query errors", () => {
    mockDetail({ isError: true });
    renderDetail();
    expect(screen.getByText("admin.suppliers.notFound")).toBeInTheDocument();
  });

  it("renders the supplier's real name and invoices from the live hook", () => {
    renderDetail();
    expect(screen.getAllByText(mockSupplierDetail.supplier.name).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(mockSupplierDetail.invoices[0].reference).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
