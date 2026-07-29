import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { billingErrorHandlers } from "../../fixtures/msw/billing.handlers";
import {
  mockInvoice,
  mockInvoicesPaginated,
  mockClientPayment,
  mockClientPaymentsPaginated,
} from "../../fixtures/data/billing.mock";
import * as billingService from "@/services/billing.service";

describe("billing.service — my invoices (client)", () => {
  it("getMyInvoices returns the unwrapped paginated result (not a bare array)", async () => {
    expect(await billingService.getMyInvoices({ page: 1, limit: 20 })).toEqual(
      mockInvoicesPaginated,
    );
  });

  it("getMyInvoice is keyed by number (string), not id", async () => {
    expect(await billingService.getMyInvoice(mockInvoice.number)).toEqual(mockInvoice);
  });

  it("getMyInvoicePdf returns a raw Blob, bypassing the envelope entirely", async () => {
    const result = await billingService.getMyInvoicePdf(mockInvoice.number);
    expect(result).toBeInstanceOf(Blob);
    expect(result.size).toBeGreaterThan(0);
  });
});

describe("billing.service — invoices (scope-parameterized)", () => {
  it("listInvoices / getInvoice / getInvoicePdf resolve for both scopes", async () => {
    expect(await billingService.listInvoices("staff", { page: 1, limit: 20 })).toEqual(
      mockInvoicesPaginated,
    );
    expect(await billingService.listInvoices("admin", { page: 1, limit: 20 })).toEqual(
      mockInvoicesPaginated,
    );
    expect(await billingService.getInvoice("staff", mockInvoice.number)).toEqual(mockInvoice);
    const pdf = await billingService.getInvoicePdf("admin", mockInvoice.number);
    expect(pdf).toBeInstanceOf(Blob);
  });

  it("getInvoice throws on a 404", async () => {
    server.use(billingErrorHandlers.invoiceNotFound());
    await expect(billingService.getInvoice("staff", "INV-9999")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe("billing.service — cancel & client payments", () => {
  it("cancelInvoice returns the unwrapped DTO", async () => {
    expect(await billingService.cancelInvoice(mockInvoice.number, {})).toEqual(mockInvoice);
  });

  it("cancelInvoice throws on a state-guard conflict", async () => {
    server.use(billingErrorHandlers.cancelConflict());
    await expect(billingService.cancelInvoice(mockInvoice.number, {})).rejects.toMatchObject({
      response: { status: 409 },
    });
  });

  it("createClientPayment resolves for both scopes against distinct URLs", async () => {
    const staffResult = await billingService.createClientPayment("staff", {
      posClientId: "50000000-0000-4000-8000-000000000002",
      amount: 2_000,
    });
    expect(staffResult).toEqual(mockClientPayment);

    const adminResult = await billingService.createClientPayment("admin", {
      posClientId: "50000000-0000-4000-8000-000000000002",
      amount: 2_000,
    });
    expect(adminResult).toEqual(mockClientPayment);
  });

  it("createClientPayment throws on a validation error", async () => {
    server.use(billingErrorHandlers.createClientPaymentValidationError());
    await expect(
      billingService.createClientPayment("staff", {
        posClientId: "50000000-0000-4000-8000-000000000002",
        amount: -1,
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("listClientPayments returns the unwrapped paginated result", async () => {
    expect(await billingService.listClientPayments({ page: 1, limit: 20 })).toEqual(
      mockClientPaymentsPaginated,
    );
  });
});
