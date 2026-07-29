import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockFamilyWithCount,
  mockBrand,
  mockModel,
  mockClientCategory,
} from "../../../fixtures/data/catalog.mock";
import * as useCatalogTaxonomyHook from "@/hooks/useCatalogTaxonomy";
import * as useClientCategoriesHook from "@/hooks/useClientCategories";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import AdminProductsAdd from "@/pages/admin/products/AdminProductsAdd";

vi.mock("@/hooks/useCatalogTaxonomy");
vi.mock("@/hooks/useClientCategories");
vi.mock("@/hooks/useCatalogProducts");

const createFamilyMutate = vi.fn();
const createProductMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCatalogTaxonomyHook.useCatalogFamilies).mockReturnValue({
    data: [mockFamilyWithCount],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogBrands).mockReturnValue({
    data: [mockBrand],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCatalogModels).mockReturnValue({
    data: [mockModel],
  } as never);
  vi.mocked(useCatalogTaxonomyHook.useCreateCatalogFamily).mockReturnValue({
    mutate: createFamilyMutate,
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
  vi.mocked(useClientCategoriesHook.useCatalogClientCategories).mockReturnValue({
    data: [mockClientCategory],
  } as never);
  vi.mocked(useCatalogProductsHook.useCreateProduct).mockReturnValue({
    mutate: createProductMutate,
    isPending: false,
  } as never);
});

describe("AdminProductsAdd (ADM-03)", () => {
  it("locks the pricing card until initialQuantity > 0", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/products/add": <AdminProductsAdd /> }, "/admin/products/add");
    expect(screen.getByText("admin.productsAdd.card.pricingLocked")).toBeInTheDocument();
    expect(screen.queryByLabelText("admin.productsAdd.guestPriceLabel")).not.toBeInTheDocument();

    const qtyInput = screen.getByLabelText("admin.productsAdd.initialQuantityLabel");
    await user.clear(qtyInput);
    await user.type(qtyInput, "5");

    expect(screen.queryByText("admin.productsAdd.card.pricingLocked")).not.toBeInTheDocument();
    expect(screen.getByLabelText("admin.productsAdd.guestPriceLabel")).toBeInTheDocument();
  });

  it("requires an initial unit cost once quantity > 0", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/products/add": <AdminProductsAdd /> }, "/admin/products/add");

    await user.type(screen.getByLabelText("admin.productsAdd.nameLabel"), "Test Product");
    const qtyInput = screen.getByLabelText("admin.productsAdd.initialQuantityLabel");
    await user.clear(qtyInput);
    await user.type(qtyInput, "5");

    // fireEvent.submit rather than user.click — jsdom's realistic submit-button click path
    // doesn't reliably reach React's onSubmit in this multi-card form (unrelated to the
    // native-`max`-attribute issue found in the sales return-dialog test); dispatching the
    // submit event directly is the reliable way to exercise the Zod refine here.
    fireEvent.submit(screen.getByText("common.actions.save").closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("admin.productsAdd.initialUnitCostRequired")).toBeInTheDocument(),
    );
    expect(createProductMutate).not.toHaveBeenCalled();
  });

  it("inline family create: typing a new name and confirming calls useCreateCatalogFamily", async () => {
    const user = userEvent.setup();
    renderWithRoutes({ "/admin/products/add": <AdminProductsAdd /> }, "/admin/products/add");

    const familyInput = screen.getAllByRole("combobox")[0];
    await user.click(familyInput);
    await user.type(familyInput, "Accessories");
    await user.click(
      screen.getByText((_, el) => el?.textContent === 'common.createNew "Accessories"'),
    );

    expect(createFamilyMutate).toHaveBeenCalledWith({ name: "Accessories" }, expect.anything());
  });
});
