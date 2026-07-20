import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import "../../../fixtures/wrappers/mockTranslation";
import { renderWithRoutes } from "../../../fixtures/wrappers/renderWithRouter";
import { mockInvoice, mockInvoicesPaginated } from "../../../fixtures/data/billing.mock";
import * as useBillingHook from "@/hooks/useBilling";
import MyInvoices from "@/pages/my-invoices/MyInvoices";
import InvoiceDetail from "@/pages/my-invoices/InvoiceDetail";

vi.mock("@/hooks/useBilling");

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyInvoices — list (PUB-10)", () => {
  it("shows a TableSkeleton while the invoices query is loading", () => {
    vi.mocked(useBillingHook.useMyInvoices).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithRoutes({ "/invoices": <MyInvoices /> }, "/invoices");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders number/date/source/total/paid/status for each invoice", () => {
    vi.mocked(useBillingHook.useMyInvoices).mockReturnValue({
      data: mockInvoicesPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/invoices": <MyInvoices /> }, "/invoices");

    // DataTable renders a desktop <table> row and a mobile stacked-card row for the same data
    // simultaneously (CSS media queries don't apply in jsdom) — assert presence via
    // getAllByText, not a single-match getByText.
    expect(screen.getAllByText(mockInvoice.number).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("invoices.source.sale").length).toBeGreaterThanOrEqual(1);
    // StatusPill prepends a "●" bullet inside the same text node as the label (order-form.test.tsx's
    // own precedent for this exact issue) — match by substring, not exact text.
    expect(screen.getAllByText(/invoices\.status\.paid/).length).toBeGreaterThanOrEqual(1);
    // totalAmount and paidAmount are both 6,000 in the fixture.
    expect(screen.getAllByText(/6,000/).length).toBeGreaterThanOrEqual(2);
  });

  it("shows EmptyState when there are no invoices", () => {
    vi.mocked(useBillingHook.useMyInvoices).mockReturnValue({
      data: { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithRoutes({ "/invoices": <MyInvoices /> }, "/invoices");
    expect(screen.getByText("invoices.empty")).toBeInTheDocument();
  });

  it("navigates to the invoice's detail route on row click", async () => {
    vi.mocked(useBillingHook.useMyInvoices).mockReturnValue({
      data: mockInvoicesPaginated,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    const user = userEvent.setup();
    renderWithRoutes(
      {
        "/invoices": <MyInvoices />,
        "/invoices/:number": <LocationProbe />,
      },
      "/invoices",
    );

    // Click the desktop row (first match — see the DataTable dual-render note above).
    await user.click(screen.getAllByText(mockInvoice.number)[0]);
    expect(await screen.findByTestId("location")).toHaveTextContent(
      `/invoices/${mockInvoice.number}`,
    );
  });
});

describe("InvoiceDetail (PUB-10)", () => {
  const pdfMutate = vi.fn();

  beforeEach(() => {
    vi.mocked(useBillingHook.useMyInvoicePdf).mockReturnValue({
      mutate: pdfMutate,
      isPending: false,
    } as never);
  });

  it("renders the invoice header and lines[] from the snapshot", () => {
    vi.mocked(useBillingHook.useMyInvoice).mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      isError: false,
    } as never);
    renderWithRoutes({ "/invoices/:number": <InvoiceDetail /> }, `/invoices/${mockInvoice.number}`);

    expect(screen.getByText(mockInvoice.number)).toBeInTheDocument();
    expect(screen.getByText(mockInvoice.lines[0].label)).toBeInTheDocument();
    expect(screen.getByText(mockInvoice.clientNameSnapshot)).toBeInTheDocument();
  });

  it("shows a local 404 for a foreign/unknown invoice number", () => {
    vi.mocked(useBillingHook.useMyInvoice).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderWithRoutes({ "/invoices/:number": <InvoiceDetail /> }, "/invoices/FOREIGN-0001");

    expect(screen.getByText("invoices.notFound")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /invoices\.backToList/ })).toHaveAttribute(
      "href",
      "/invoices",
    );
  });

  it("calls useMyInvoicePdf with the invoice number on download", async () => {
    vi.mocked(useBillingHook.useMyInvoice).mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      isError: false,
    } as never);
    const user = userEvent.setup();
    renderWithRoutes({ "/invoices/:number": <InvoiceDetail /> }, `/invoices/${mockInvoice.number}`);

    await user.click(screen.getByRole("button", { name: /invoices\.downloadPdf/ }));
    expect(pdfMutate).toHaveBeenCalledWith(mockInvoice.number, expect.anything());
  });
});
