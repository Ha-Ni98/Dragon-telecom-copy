import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import {
  mockSupplierInvoiceDraft,
  mockSupplierInvoiceConfirmed,
  mockConfirmResult,
  mockSuppliersPaginated,
} from "../../../fixtures/data/purchasing.mock";
import { mockAdminProduct, mockAdminProductsPaginated } from "../../../fixtures/data/catalog.mock";
import * as usePurchasingInvoicesHook from "@/hooks/usePurchasingInvoices";
import * as usePurchasingSuppliersHook from "@/hooks/usePurchasingSuppliers";
import * as usePurchasingPaymentsHook from "@/hooks/usePurchasingPayments";
import * as useCatalogProductsHook from "@/hooks/useCatalogProducts";
import AdminSupplierInvoiceEditor from "@/pages/admin/supplier-invoices/AdminSupplierInvoiceEditor";

vi.mock("@/hooks/usePurchasingInvoices");
vi.mock("@/hooks/usePurchasingSuppliers");
vi.mock("@/hooks/usePurchasingPayments");
vi.mock("@/hooks/useCatalogProducts");

const refetchDetail = vi.fn();
const createInvoiceMutate = vi.fn();
const updateInvoiceMutate = vi.fn();
const confirmInvoiceMutate = vi.fn();
const cancelInvoiceMutate = vi.fn();
const createPaymentMutate = vi.fn();
const createProductMutate = vi.fn();
const updatePricingMutate = vi.fn();

function mockDetail(
  data: typeof mockSupplierInvoiceDraft | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(usePurchasingInvoicesHook.usePurchasingInvoiceDetail).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchDetail,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDetail(mockSupplierInvoiceDraft);
  vi.mocked(usePurchasingInvoicesHook.useCreatePurchasingInvoice).mockReturnValue({
    mutate: createInvoiceMutate,
    isPending: false,
  } as never);
  vi.mocked(usePurchasingInvoicesHook.useUpdatePurchasingInvoice).mockReturnValue({
    mutate: updateInvoiceMutate,
    isPending: false,
  } as never);
  vi.mocked(usePurchasingInvoicesHook.useConfirmPurchasingInvoice).mockReturnValue({
    mutate: confirmInvoiceMutate,
    isPending: false,
  } as never);
  vi.mocked(usePurchasingInvoicesHook.useCancelPurchasingInvoice).mockReturnValue({
    mutate: cancelInvoiceMutate,
    isPending: false,
  } as never);
  vi.mocked(usePurchasingSuppliersHook.usePurchasingSuppliers).mockReturnValue({
    data: mockSuppliersPaginated,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(usePurchasingPaymentsHook.useCreatePurchasingPayment).mockReturnValue({
    mutate: createPaymentMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useAdminCatalogProducts).mockReturnValue({
    data: mockAdminProductsPaginated,
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useCreateProduct).mockReturnValue({
    mutate: createProductMutate,
    isPending: false,
  } as never);
  vi.mocked(useCatalogProductsHook.useUpdatePricing).mockReturnValue({
    mutate: updatePricingMutate,
    isPending: false,
  } as never);
});

function renderEditor(initial: string) {
  return renderWithRoutes(
    { "/admin/supplier-invoices/:id": <AdminSupplierInvoiceEditor /> },
    initial,
  );
}

describe("AdminSupplierInvoiceEditor (ADM-08 editor) wiring", () => {
  it("shows a skeleton while the detail query loads (edit mode)", () => {
    mockDetail(undefined, { isLoading: true });
    const { container } = renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows NotFoundState when the detail query errors", () => {
    mockDetail(undefined, { isError: true });
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);
    expect(screen.getByText("admin.supplierInvoices.editor.notFound")).toBeInTheDocument();
  });

  it("populates the form from the live DRAFT invoice", () => {
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);
    expect(screen.getByDisplayValue(mockSupplierInvoiceDraft.invoiceDate)).toBeInTheDocument();
  });

  it("recomputes the footer subtotal live as a line's quantity changes", async () => {
    const user = userEvent.setup();
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);

    // Starting line: qty 10 * unitCost 3000 = 30,000 (subtotal and total both show it, since
    // shippingCost is 0).
    expect(screen.getAllByText(/30,000/).length).toBeGreaterThanOrEqual(1);

    const quantityInput = screen.getByPlaceholderText("admin.supplierInvoices.editor.quantity");
    await user.clear(quantityInput);
    await user.type(quantityInput, "20");

    expect((await screen.findAllByText(/60,000/)).length).toBeGreaterThanOrEqual(1);
  });

  it("creates a new product inline from the line editor's product picker", async () => {
    createProductMutate.mockImplementation((_values, opts) => opts?.onSuccess?.(mockAdminProduct));
    const user = userEvent.setup();
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);

    const productInput = screen.getByPlaceholderText("admin.supplierInvoices.editor.product");
    await user.type(productInput, "Brand New Widget");
    const createNewOptions = screen.getAllByText(/common.createNew/);
    await user.click(createNewOptions[createNewOptions.length - 1]);

    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("admin.suppliers.productName"),
      "Brand New Widget",
    );
    await user.type(
      within(dialog).getByLabelText("admin.settings.hierarchy.tabs.families"),
      "Accessories",
    );
    await user.type(
      within(dialog).getByLabelText("admin.settings.hierarchy.tabs.brands"),
      "Generic",
    );
    await user.click(within(dialog).getByText("common.save"));

    await waitFor(() => expect(createProductMutate).toHaveBeenCalled());
  });

  it("creates a new DRAFT invoice via the live mutation and navigates to its editor", async () => {
    createInvoiceMutate.mockImplementation((_values, opts) => {
      opts?.onSuccess?.(mockSupplierInvoiceDraft);
    });
    const user = userEvent.setup();
    renderEditor("/admin/supplier-invoices/new");

    // Pick a supplier + a product so the create command validates.
    const supplierInput = screen.getByText("admin.supplierInvoices.editor.supplier").parentElement!;
    const supplierAutocomplete = supplierInput.querySelector("input")!;
    await user.type(supplierAutocomplete, mockSuppliersPaginated.items[0].id);

    const productInput = screen.getByPlaceholderText("admin.supplierInvoices.editor.product");
    await user.type(productInput, mockAdminProduct.id);

    await user.click(screen.getByText("admin.supplierInvoices.editor.save"));

    await waitFor(() => expect(createInvoiceMutate).toHaveBeenCalled());
  });

  it("confirming a DRAFT invoice reveals the reprice prompt from the confirm result", async () => {
    confirmInvoiceMutate.mockImplementation((_id, opts) => {
      opts?.onSuccess?.(mockConfirmResult);
    });
    const user = userEvent.setup();
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);

    await user.click(screen.getByText("admin.supplierInvoices.editor.confirm"));

    expect(confirmInvoiceMutate).toHaveBeenCalledWith(
      mockSupplierInvoiceDraft.id,
      expect.anything(),
    );
    expect(
      screen.getByText(new RegExp(mockConfirmResult.repriceCandidates[0].name)),
    ).toBeInTheDocument();
  });

  it("shows the already-confirmed 409 banner when a DRAFT save PATCH lands after confirm", async () => {
    updateInvoiceMutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(
        Object.assign(new Error("Conflict"), { isAxiosError: true, response: { status: 409 } }),
      );
    });
    const user = userEvent.setup();
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceDraft.id}`);

    await user.click(screen.getByText("admin.supplierInvoices.editor.save"));

    expect(screen.getByText("admin.supplierInvoices.editor.alreadyConfirmed")).toBeInTheDocument();
  });

  it("locks the fields and hides Save/Confirm for a CONFIRMED invoice, but shows Record payment", () => {
    mockDetail(mockSupplierInvoiceConfirmed);
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceConfirmed.id}`);

    expect(screen.queryByText("admin.supplierInvoices.editor.save")).not.toBeInTheDocument();
    expect(screen.queryByText("admin.supplierInvoices.editor.confirm")).not.toBeInTheDocument();
    expect(screen.getByText("admin.supplierInvoices.payment.title")).toBeInTheDocument();
  });

  it("records a supplier payment on a CONFIRMED invoice via the live mutation", async () => {
    mockDetail(mockSupplierInvoiceConfirmed);
    createPaymentMutate.mockImplementation((_values, opts) => opts?.onSuccess?.());
    const user = userEvent.setup();
    renderEditor(`/admin/supplier-invoices/${mockSupplierInvoiceConfirmed.id}`);

    await user.click(screen.getByText("admin.supplierInvoices.payment.title"));
    // The dialog previews the credit movement (CreditMovementPreview) before submit.
    expect(screen.getByText("invoices.detail.previousCredit")).toBeInTheDocument();
    expect(screen.getByText("invoices.detail.newCredit")).toBeInTheDocument();

    const amountInput = screen.getByLabelText("admin.invoices.recordSupplierPayment.amountLabel");
    await user.clear(amountInput);
    await user.type(amountInput, "5000");
    await user.click(screen.getByText("admin.invoices.recordSupplierPayment.submit"));

    await waitFor(() => expect(createPaymentMutate).toHaveBeenCalled());
  });
});
