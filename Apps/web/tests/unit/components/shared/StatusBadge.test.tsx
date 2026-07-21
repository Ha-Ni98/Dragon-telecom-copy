import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupplierInvoiceStatus, ClientStatus } from "@dragon-telecom/contract";
import { SupplierInvoiceStatusBadge, ClientStatusBadge } from "@/components/shared/StatusBadge";

// set-04 ADM-07/08/12 additions to the shared StatusBadge extension point — each renders the
// translated label key for its enum value (mockTranslation returns the key itself).
describe("SupplierInvoiceStatusBadge", () => {
  it.each([
    [SupplierInvoiceStatus.DRAFT, "admin.supplierInvoices.status.draft"],
    [SupplierInvoiceStatus.CONFIRMED, "admin.supplierInvoices.status.confirmed"],
    [SupplierInvoiceStatus.CANCELLED, "admin.supplierInvoices.status.cancelled"],
  ])("renders the label for %s", (status, labelKey) => {
    render(<SupplierInvoiceStatusBadge status={status} />);
    expect(screen.getByText(new RegExp(labelKey))).toBeInTheDocument();
  });
});

describe("ClientStatusBadge", () => {
  it.each([
    [ClientStatus.PENDING, "admin.clients.statusPending"],
    [ClientStatus.APPROVED, "admin.clients.statusActive"],
    [ClientStatus.REJECTED, "admin.clients.statusRefused"],
  ])("renders the label for %s", (status, labelKey) => {
    render(<ClientStatusBadge status={status} />);
    expect(screen.getByText(new RegExp(labelKey))).toBeInTheDocument();
  });
});
