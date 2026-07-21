import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockPosClient, mockPosClientsPaginated } from "../../../fixtures/data/clients.mock";
import { mockSale, mockSalesPaginated } from "../../../fixtures/data/sales.mock";
import {
  mockClientPayment,
  mockClientPaymentsPaginated,
} from "../../../fixtures/data/billing.mock";
import { mockClientCategory } from "../../../fixtures/data/catalog.mock";
import * as usePosClientsHook from "@/hooks/usePosClients";
import * as useSalesHook from "@/hooks/useSales";
import * as useBillingHook from "@/hooks/useBilling";
import * as useClientCategoriesHook from "@/hooks/useClientCategories";
import AdminPosClients from "@/pages/admin/pos-clients/AdminPosClients";

vi.mock("@/hooks/usePosClients");
vi.mock("@/hooks/useSales");
vi.mock("@/hooks/useBilling");
vi.mock("@/hooks/useClientCategories");

const refetchClients = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();

function mockClients(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(usePosClientsHook.usePosClientsList).mockReturnValue({
    data: mockPosClientsPaginated,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchClients,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClients();
  vi.mocked(usePosClientsHook.useCreatePosClient).mockReturnValue({
    mutate: createMutate,
    isPending: false,
  } as never);
  vi.mocked(usePosClientsHook.useUpdatePosClient).mockReturnValue({
    mutate: updateMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientCategoriesHook.useCatalogClientCategories).mockReturnValue({
    data: [mockClientCategory],
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useSalesHook.useSales).mockReturnValue({
    data: mockSalesPaginated,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useBillingHook.useClientPayments).mockReturnValue({
    data: mockClientPaymentsPaginated,
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminPosClients (ADM-11) wiring", () => {
  it("shows the table skeleton while loading", () => {
    mockClients({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/pos-clients": <AdminPosClients /> },
      "/admin/pos-clients",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the list query errors, and retry re-fetches", async () => {
    mockClients({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/pos-clients": <AdminPosClients /> }, "/admin/pos-clients");

    expect(screen.getByText("admin.posClients.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchClients).toHaveBeenCalled();
  });

  it("renders POS client rows from the live hook", () => {
    renderWithRoutes({ "/admin/pos-clients": <AdminPosClients /> }, "/admin/pos-clients");
    expect(screen.getAllByText(mockPosClient.name).length).toBeGreaterThanOrEqual(1);
  });

  it("creates a POS client via the live mutation", async () => {
    createMutate.mockImplementation((_values, opts) => opts?.onSuccess?.(mockPosClient));
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/pos-clients": <AdminPosClients /> }, "/admin/pos-clients");

    await user.click(screen.getByText("admin.posClients.addClient"));
    await user.type(screen.getByLabelText("admin.posClients.form.name"), "New Client");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
  });

  it("opens the detail drawer with the credit-history tab merging sales + payments, newest first", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/pos-clients": <AdminPosClients /> }, "/admin/pos-clients");

    await user.click(screen.getAllByText("common.view")[0]);
    await user.click(screen.getByText("admin.posClients.detail.tabs.creditHistory"));

    // mockSale.soldAt = 2026-07-19T10:00, mockClientPayment.paidAt = 2026-07-19T11:00 — the
    // payment is later, so it must render first (newest-first). The drawer portals outside the
    // render container (Radix Sheet), so query the full document, and assert relative document
    // order rather than a brittle class selector (DataTable's own mobile-card labels share the
    // same "text-xs"/"text-muted-foreground" classes elsewhere on the page).
    const paymentDateEl = screen.getByText(mockClientPayment.paidAt);
    const saleDateEl = screen.getByText(mockSale.soldAt as string);
    expect(
      paymentDateEl.compareDocumentPosition(saleDateEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the edit dialog from the row action without opening the detail drawer", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/pos-clients": <AdminPosClients /> }, "/admin/pos-clients");

    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-pencil"));
    await user.click(editButtons[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("admin.posClients.detail.tabs.sales")).not.toBeInTheDocument();
  });
});
