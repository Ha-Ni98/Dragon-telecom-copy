import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockSettings, mockAdminFees } from "../../../fixtures/data/platform.mock";
import {
  mockFamily,
  mockBrand,
  mockClientCategory,
  mockAdminProductsPaginated,
  mockAdminProduct,
} from "../../../fixtures/data/catalog.mock";
import * as usePlatformHook from "@/hooks/usePlatform";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useClientCategoriesHook from "@/hooks/useClientCategories";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import AdminSettings from "@/pages/admin/settings/AdminSettings";

vi.mock("@/hooks/usePlatform");
vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useClientCategories");
vi.mock("@/hooks/useCatalogProducts");

const updateSettingsMutate = vi.fn();
const importFeesMutate = vi.fn();
const exportFeesMutate = vi.fn();
const createCategoryMutate = vi.fn();
const updateCategoryMutate = vi.fn();

function mockCategoriesQuery(overrides: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  vi.mocked(useClientCategoriesHook.useCatalogClientCategories).mockReturnValue({
    data: overrides.isError ? undefined : [mockClientCategory],
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePlatformHook.usePlatformSettings).mockReturnValue({
    data: mockSettings,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(usePlatformHook.useUpdatePlatformSettings).mockReturnValue({
    mutate: updateSettingsMutate,
    isPending: false,
  } as never);
  vi.mocked(usePlatformHook.useAdminDeliveryFees).mockReturnValue({
    data: mockAdminFees,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(usePlatformHook.useImportAdminDeliveryFees).mockReturnValue({
    mutate: importFeesMutate,
    isPending: false,
  } as never);
  vi.mocked(usePlatformHook.useExportAdminDeliveryFees).mockReturnValue({
    mutate: exportFeesMutate,
    isPending: false,
  } as never);

  mockCategoriesQuery();
  vi.mocked(useClientCategoriesHook.useCreateCatalogClientCategory).mockReturnValue({
    mutate: createCategoryMutate,
    isPending: false,
  } as never);
  vi.mocked(useClientCategoriesHook.useUpdateCatalogClientCategory).mockReturnValue({
    mutate: updateCategoryMutate,
    isPending: false,
  } as never);

  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamily],
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
    data: [mockBrand],
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogModels).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCreateCatalogFamily).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCreateCatalogBrand).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCreateCatalogModel).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useUpdateCatalogFamily).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useUpdateCatalogBrand).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useUpdateCatalogModel).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useSetModelFamilies).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);

  vi.mocked(useCatalogProductsHook.useAdminCatalogProducts).mockReturnValue({
    data: mockAdminProductsPaginated,
    isLoading: false,
    isError: false,
  } as never);
});

describe("AdminSettings (ADM-17) wiring", () => {
  it("shows the categories table skeleton while loading", () => {
    mockCategoriesQuery({ isLoading: true });
    const { container } = renderWithRoutes(
      { "/admin/settings": <AdminSettings /> },
      "/admin/settings",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the categories query errors", async () => {
    mockCategoriesQuery({ isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");

    expect(screen.getByText("admin.clients.categories.loadError")).toBeInTheDocument();
    await user.click(screen.getByText("common.retry"));
  });

  it("renders category rows from the live hook", () => {
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");
    // DataTable renders desktop + mobile rows simultaneously in jsdom (set-02 note).
    expect(screen.getAllByText(mockClientCategory.name).length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces the sequence-decrease 409 banner when saving Invoicing settings fails", async () => {
    updateSettingsMutate.mockImplementation((vars, opts) => {
      if (vars.invoicing) {
        opts?.onError?.(
          Object.assign(new Error("Conflict"), { isAxiosError: true, response: { status: 409 } }),
        );
      }
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");

    await user.click(screen.getByText("admin.settings.tabs.invoicing"));
    await user.click(screen.getByText("common.save"));

    expect(
      await screen.findByText("admin.settings.invoicing.sequenceDecreaseError"),
    ).toBeInTheDocument();
  });

  it("imports delivery fees via the live mutation and shows the real imported count", async () => {
    importFeesMutate.mockImplementation((_file, opts) => {
      opts?.onSuccess?.({ imported: 3 });
    });
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");

    await user.click(screen.getByText("admin.settings.delivery"));
    await user.click(screen.getByText("admin.settings.delivery.importExcel"));

    const file = new File(["dummy"], "fees.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    // The Dialog portals its content onto document.body, outside the render container.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(importFeesMutate).toHaveBeenCalledWith(file, expect.anything());
    expect(await screen.findByText("admin.settings.delivery.importedBody")).toBeInTheDocument();
  });

  it("exports delivery fees via the live mutation", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");

    await user.click(screen.getByText("admin.settings.delivery"));
    await user.click(screen.getByText("admin.settings.delivery.exportExcel"));

    expect(exportFeesMutate).toHaveBeenCalled();
  });

  it("removes a featured product on the Storefront tab via the live mutation", async () => {
    vi.mocked(usePlatformHook.usePlatformSettings).mockReturnValue({
      data: {
        ...mockSettings,
        storefront: { featuredProductIds: [mockAdminProduct.id] },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/settings": <AdminSettings /> }, "/admin/settings");

    await user.click(screen.getByText("admin.settings.tabs.storefront"));
    expect(screen.getByText(mockAdminProduct.name)).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button");
    const chipRemoveButton = removeButtons.find((b) => b.querySelector("svg.lucide-x"));
    await user.click(chipRemoveButton!);

    expect(updateSettingsMutate).toHaveBeenCalledWith({ storefront: { featuredProductIds: [] } });
  });
});
