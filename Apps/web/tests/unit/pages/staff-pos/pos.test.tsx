import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockStaffProduct,
  mockStaffProductsPaginated,
  mockClientCategory,
  mockFamilyWithCount,
} from "../../../fixtures/data/catalog.mock";
import { mockPosClient } from "../../../fixtures/data/clients.mock";
import { mockSale, mockReceipt } from "../../../fixtures/data/sales.mock";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as usePosClientsHook from "@/hooks/usePosClients";
import * as useSalesHook from "@/hooks/useSales";
import * as useObservabilityHook from "@/hooks/useObservability";
import StaffPos from "@/pages/staff/pos/StaffPos";

vi.mock("@/hooks/useCatalogProducts");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/usePosClients");
vi.mock("@/hooks/useSales");
vi.mock("@/hooks/useObservability");

const refetchProducts = vi.fn();
const createDraftMutate = vi.fn();
const updateDraftMutate = vi.fn();
const confirmSaleMutate = vi.fn();
const quickCreateClientMutate = vi.fn();

function mockProducts(
  data: typeof mockStaffProductsPaginated | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useCatalogProductsHook.useStaffProducts).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchProducts,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProducts(mockStaffProductsPaginated);
  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamilyWithCount],
  } as never);
  vi.mocked(usePosClientsHook.usePosClientSearch).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
  vi.mocked(usePosClientsHook.useQuickCreatePosClient).mockReturnValue({
    mutate: quickCreateClientMutate,
    isPending: false,
  } as never);
  vi.mocked(useSalesHook.useCreateDraft).mockReturnValue({
    mutate: createDraftMutate,
    isPending: false,
  } as never);
  vi.mocked(useSalesHook.useUpdateDraft).mockReturnValue({
    mutate: updateDraftMutate,
    isPending: false,
  } as never);
  vi.mocked(useSalesHook.useConfirmSale).mockReturnValue({
    mutate: confirmSaleMutate,
    isPending: false,
  } as never);
  vi.mocked(useSalesHook.useSales).mockReturnValue({
    data: { items: [mockSale], meta: { page: 1, limit: 50, total: 1, totalPages: 1 } },
    isLoading: false,
  } as never);
  vi.mocked(useObservabilityHook.useSendStaffSearch).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe("StaffPos (STF-02 / ADM-05)", () => {
  it("shows an inline product-search skeleton while loading", () => {
    mockProducts(undefined, { isLoading: true });
    const { container } = renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows EmptyState when the product search has no results", () => {
    mockProducts({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");
    expect(screen.getByText("staff.pos.search.empty")).toBeInTheDocument();
  });

  it("scanning a product adds a line; scanning again increments its quantity (capped at available)", async () => {
    const scarceProduct = { ...mockStaffProduct, availableQuantity: 1 };
    mockProducts({ items: [scarceProduct], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");

    await user.click(screen.getAllByText(scarceProduct.name)[0]);
    // The product name now appears twice — once in the search result row, once in the new
    // ticket line — and the ticket's "+" stepper is already disabled (qty 1 === available 1).
    expect(screen.getAllByText(scarceProduct.name)).toHaveLength(2);
    const increaseButton = screen.getByRole("button", { name: "common.actions.increase" });
    expect(increaseButton).toBeDisabled();

    // Re-adding the same product from search increments qty via handleSelectProduct, capped by
    // availableQuantity (1) — no second ticket line is created and the stepper stays disabled.
    await user.click(screen.getAllByText(scarceProduct.name)[0]);
    expect(screen.getAllByText(scarceProduct.name)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "common.actions.increase" })).toBeDisabled();
  });

  it("attaching a POS client re-resolves the line to the client's category price", async () => {
    const categorizedClient = {
      ...mockPosClient,
      categoryId: mockClientCategory.id,
      categoryName: mockClientCategory.name,
    };
    vi.mocked(usePosClientsHook.usePosClientSearch).mockReturnValue({
      data: [categorizedClient],
      isLoading: false,
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");

    await user.click(screen.getByText(mockStaffProduct.name));
    // Before attach: resolved price is the product's plain defaultSalePrice (4500).
    expect(screen.getByDisplayValue("4500")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("staff.pos.clientZone.searchPlaceholder"),
      categorizedClient.name,
    );
    await user.click(await screen.findByText(categorizedClient.name));

    // After attach: re-resolved to the category price (4200, from the fixture's categoryPrices).
    await waitFor(() => expect(screen.getByDisplayValue("4200")).toBeInTheDocument());
  });

  it("confirming an underpaid ticket with no client attached surfaces CREDIT_REQUIRES_CLIENT", async () => {
    createDraftMutate.mockImplementation((_command, opts) => opts.onSuccess(mockSale));
    confirmSaleMutate.mockImplementation((_vars, opts) =>
      opts.onError({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            error: { code: "VALIDATION_ERROR", message: "CREDIT_REQUIRES_CLIENT" },
          },
        },
      }),
    );
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");

    await user.click(screen.getByText(mockStaffProduct.name));
    await user.click(screen.getByText("staff.pos.payment.confirm"));

    await waitFor(() =>
      expect(screen.getByText("staff.pos.clientZone.creditRequiresClient")).toBeInTheDocument(),
    );
  });

  it("adding a line to the ticket never calls confirmSale (draft save is not confirm)", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");
    await user.click(screen.getByText(mockStaffProduct.name));
    expect(confirmSaleMutate).not.toHaveBeenCalled();
  });

  it("renders the receipt view after a successful confirm", async () => {
    createDraftMutate.mockImplementation((_command, opts) => opts.onSuccess(mockSale));
    confirmSaleMutate.mockImplementation((_vars, opts) => opts.onSuccess(mockReceipt));
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");

    await user.click(screen.getByText(mockStaffProduct.name));
    await user.click(screen.getByText("staff.pos.payment.confirm"));

    expect(await screen.findByText("staff.pos.receipt.title")).toBeInTheDocument();
    expect(screen.queryByText("staff.pos.search.placeholder")).not.toBeInTheDocument();
  });

  it("quick-add client: an empty name surfaces a Zod error and never calls the mutation", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/pos": <StaffPos /> }, "/staff/pos");

    await user.click(screen.getByText("staff.pos.clientZone.quickAdd"));
    await user.click(screen.getByText("staff.pos.quickAddClient.submit"));

    await waitFor(() =>
      expect(screen.getByText("staff.pos.quickAddClient.nameRequired")).toBeInTheDocument(),
    );
    expect(quickCreateClientMutate).not.toHaveBeenCalled();
  });

  it("admin drafts drawer groups drafts by staff; staff drawer does not", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithRoutes(
      { "/staff/pos": <StaffPos scope="staff" /> },
      "/staff/pos",
    );
    await user.click(screen.getByText("staff.pos.drafts.title"));
    expect(screen.queryByText(mockSale.staffName)).not.toBeInTheDocument();
    unmount();

    renderWithRoutes({ "/staff/pos": <StaffPos scope="admin" /> }, "/staff/pos");
    await user.click(screen.getByText("admin.pos.drafts.title"));
    expect(await screen.findByText(mockSale.staffName)).toBeInTheDocument();
  });
});
