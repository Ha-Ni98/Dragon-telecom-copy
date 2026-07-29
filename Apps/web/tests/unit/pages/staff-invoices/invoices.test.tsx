import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockInvoice, mockInvoicesPaginated } from "../../../fixtures/data/billing.mock";
import { InvoiceStatus } from "@dragon-telecom/contract";
import * as useBillingHook from "@/hooks/useBilling";
import * as usePurchasingInvoicesHook from "@/hooks/usePurchasingInvoices";
import * as usePurchasingPaymentsHook from "@/hooks/usePurchasingPayments";
import StaffInvoices from "@/pages/staff/invoices/StaffInvoices";

vi.mock("@/hooks/useBilling");
vi.mock("@/hooks/usePurchasingInvoices");
vi.mock("@/hooks/usePurchasingPayments");

const refetchMyInvoices = vi.fn();
const recordPaymentMutate = vi.fn();

function mockMyInvoices(
  data: typeof mockInvoicesPaginated | undefined,
  overrides: Partial<{ isLoading: boolean; isError: boolean }> = {},
) {
  vi.mocked(useBillingHook.useMyInvoices).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    refetch: refetchMyInvoices,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBillingHook.useInvoices).mockReturnValue({
    data: mockInvoicesPaginated,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useBillingHook.useMyInvoice).mockReturnValue({ data: mockInvoice } as never);
  vi.mocked(useBillingHook.useInvoice).mockReturnValue({ data: mockInvoice } as never);
  vi.mocked(useBillingHook.useMyInvoicePdf).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useBillingHook.useInvoicePdf).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useBillingHook.useCancelInvoice).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useBillingHook.useCreateClientPayment).mockReturnValue({
    mutate: recordPaymentMutate,
    isPending: false,
  } as never);
  vi.mocked(useBillingHook.useClientPayments).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
  vi.mocked(usePurchasingInvoicesHook.usePurchasingInvoices).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(usePurchasingPaymentsHook.usePurchasingPayments).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as never);
  vi.mocked(usePurchasingPaymentsHook.useCreatePurchasingPayment).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never);
});

describe("StaffInvoices (STF-06 / ADM-14)", () => {
  it("shows a TableSkeleton while the staff outgoing query is loading", () => {
    mockMyInvoices(undefined, { isLoading: true });
    const { container } = renderWithRoutes(
      { "/staff/invoices": <StaffInvoices /> },
      "/staff/invoices",
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows a retry fallback when the outgoing query errors, and retry re-fetches", async () => {
    mockMyInvoices(undefined, { isError: true });
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/invoices": <StaffInvoices /> }, "/staff/invoices");

    expect(screen.getByText("staff.invoices.table.error")).toBeInTheDocument();
    await user.click(screen.getByText("common.actions.tryAgain"));
    expect(refetchMyInvoices).toHaveBeenCalled();
  });

  it("shows EmptyState when there are no invoices", () => {
    mockMyInvoices({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    renderWithRoutes({ "/staff/invoices": <StaffInvoices /> }, "/staff/invoices");
    expect(screen.getByText("staff.invoices.table.empty")).toBeInTheDocument();
  });

  it("renders invoice rows on success (staff, single outgoing table)", () => {
    mockMyInvoices(mockInvoicesPaginated);
    renderWithRoutes({ "/staff/invoices": <StaffInvoices /> }, "/staff/invoices");
    expect(screen.getAllByText(mockInvoice.number).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("admin.invoices.tabs.incoming")).not.toBeInTheDocument();
  });

  it("admin scope shows three tabs and a cancel action on the outgoing snapshot", async () => {
    mockMyInvoices(mockInvoicesPaginated);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/invoices": <StaffInvoices scope="admin" /> }, "/staff/invoices");

    expect(screen.getByText("admin.invoices.tabs.outgoing")).toBeInTheDocument();
    expect(screen.getByText("admin.invoices.tabs.incoming")).toBeInTheDocument();
    expect(screen.getByText("admin.invoices.tabs.payments")).toBeInTheDocument();

    await user.click(screen.getAllByText(mockInvoice.number)[0]);
    expect(
      await screen.findByText("admin.invoices.outgoing.cancelDialog.title"),
    ).toBeInTheDocument();
  });

  it("staff scope never renders a cancel action on the outgoing snapshot", async () => {
    mockMyInvoices(mockInvoicesPaginated);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/invoices": <StaffInvoices scope="staff" /> }, "/staff/invoices");

    await user.click(screen.getAllByText(mockInvoice.number)[0]);
    await screen.findByText("staff.invoices.snapshot.pdf");
    expect(
      screen.queryByText("admin.invoices.outgoing.cancelDialog.title"),
    ).not.toBeInTheDocument();
  });

  it("record payment: an amount of zero surfaces a Zod error and never calls the mutation", async () => {
    mockMyInvoices(mockInvoicesPaginated);
    // mockInvoice's own status is PAID, which InvoiceSnapshotView deliberately hides the
    // record-payment button for (nothing left to collect) — override to an unpaid status so
    // the button this test means to exercise actually renders.
    vi.mocked(useBillingHook.useMyInvoice).mockReturnValue({
      data: { ...mockInvoice, status: InvoiceStatus.ISSUED },
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/staff/invoices": <StaffInvoices /> }, "/staff/invoices");

    await user.click(screen.getAllByText(mockInvoice.number)[0]);
    await user.click(await screen.findByText("staff.invoices.recordPayment.title"));
    const amountInput = screen.getByLabelText("staff.invoices.recordPayment.amountLabel");
    await user.clear(amountInput);
    await user.type(amountInput, "0");
    await user.click(screen.getByText("staff.invoices.recordPayment.submit"));

    await waitFor(() =>
      expect(screen.getByText("staff.invoices.recordPayment.amountInvalid")).toBeInTheDocument(),
    );
    expect(recordPaymentMutate).not.toHaveBeenCalled();
  });
});
