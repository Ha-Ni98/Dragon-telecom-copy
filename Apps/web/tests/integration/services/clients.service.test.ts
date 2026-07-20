import { describe, it, expect } from "vitest";
import { server } from "../../fixtures/msw/server";
import { clientsErrorHandlers } from "../../fixtures/msw/clients.handlers";
import {
  mockPhoneAvailable,
  mockClientMe,
  mockCart,
  mockAdminClientsPaginated,
  mockAdminClientPending,
  mockClientStats,
  mockPosClient,
  mockPosClientsPaginated,
} from "../../fixtures/data/clients.mock";
import * as clientsService from "@/services/clients.service";

describe("clients.service — web identity (public + client)", () => {
  it("validatePhone returns the unwrapped result DTO", async () => {
    const result = await clientsService.validatePhone({ phone: "0550000001" });
    expect(result).toEqual(mockPhoneAvailable);
  });

  it("register returns just the new id (no session/tokens)", async () => {
    const result = await clientsService.register({
      firstName: "Amine",
      lastName: "Belkacem",
      phone: "0550000001",
      wilayaId: mockClientMe.wilayaId,
      communeId: mockClientMe.communeId,
    });
    expect(result).toEqual({ id: mockAdminClientPending.id });
  });

  it("register throws on a duplicate-phone conflict", async () => {
    server.use(clientsErrorHandlers.registerConflict());
    await expect(
      clientsService.register({
        firstName: "X",
        lastName: "Y",
        phone: "0550000001",
        wilayaId: mockClientMe.wilayaId,
        communeId: mockClientMe.communeId,
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it("getMe / updateMe return the unwrapped DTO", async () => {
    expect(await clientsService.getMe()).toEqual(mockClientMe);
    expect(await clientsService.updateMe({ storeName: "New Store" })).toEqual(mockClientMe);
  });

  it("updateMe throws on a validation error (.strict() extra key)", async () => {
    server.use(clientsErrorHandlers.updateMeValidationError());
    await expect(clientsService.updateMe({} as never)).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it("changeMyPassword resolves void on success", async () => {
    await expect(
      clientsService.changeMyPassword({ currentPassword: "old", newPassword: "newpass1" }),
    ).resolves.toBeUndefined();
  });
});

describe("clients.service — cart", () => {
  it("getCart returns the unwrapped item list", async () => {
    const result = await clientsService.getCart();
    expect(result).toEqual(mockCart);
  });

  it("addToCart / removeFromCart resolve void", async () => {
    await expect(
      clientsService.addToCart({ productId: mockCart[0].productId }),
    ).resolves.toBeUndefined();
    await expect(clientsService.removeFromCart(mockCart[0].productId)).resolves.toBeUndefined();
  });
});

describe("clients.service — admin client pipeline", () => {
  it("listAdminClients returns the unwrapped paginated DTO", async () => {
    const result = await clientsService.listAdminClients({ page: 1, limit: 10 });
    expect(result).toEqual(mockAdminClientsPaginated);
  });

  it("adminClientStats returns the unwrapped DTO", async () => {
    const result = await clientsService.adminClientStats();
    expect(result).toEqual(mockClientStats);
  });

  it("getAdminClient returns the unwrapped DTO", async () => {
    const result = await clientsService.getAdminClient(mockAdminClientPending.id);
    expect(result).toEqual(mockAdminClientPending);
  });

  it("getAdminClient throws on 404", async () => {
    server.use(clientsErrorHandlers.adminClientNotFound());
    await expect(clientsService.getAdminClient("missing")).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it("approveClient / rejectClient return the unwrapped DTO", async () => {
    expect(
      await clientsService.approveClient(mockAdminClientPending.id, {
        username: "amine.b",
        password: "secret123",
        categoryId: "ca000000-0000-4000-8000-000000000001",
      }),
    ).toEqual(mockAdminClientPending);
    expect(
      await clientsService.rejectClient(mockAdminClientPending.id, { reason: "duplicate" }),
    ).toEqual(mockAdminClientPending);
  });

  it("approveClient throws on a conflict (already approved)", async () => {
    server.use(clientsErrorHandlers.approveConflict());
    await expect(
      clientsService.approveClient(mockAdminClientPending.id, {
        username: "x",
        password: "password1",
        categoryId: "ca000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it("resetClientPassword resolves void", async () => {
    await expect(
      clientsService.resetClientPassword(mockAdminClientPending.id, { newPassword: "newpass1" }),
    ).resolves.toBeUndefined();
  });

  it("updateAdminClient returns the unwrapped DTO", async () => {
    const result = await clientsService.updateAdminClient(mockAdminClientPending.id, {
      isEnabled: false,
    });
    expect(result).toEqual(mockAdminClientPending);
  });
});

describe("clients.service — POS clients", () => {
  it("searchPosClients returns the unwrapped array", async () => {
    const result = await clientsService.searchPosClients({ q: "Walk" });
    expect(result).toEqual([mockPosClient]);
  });

  it("quickCreatePosClient / createPosClient return the unwrapped DTO", async () => {
    expect(await clientsService.quickCreatePosClient({ name: "New POS Client" })).toEqual(
      mockPosClient,
    );
    expect(await clientsService.createPosClient({ name: "New POS Client" })).toEqual(mockPosClient);
  });

  it("listPosClients returns the unwrapped paginated DTO", async () => {
    const result = await clientsService.listPosClients({ page: 1, limit: 10 });
    expect(result).toEqual(mockPosClientsPaginated);
  });

  it("updatePosClient returns the unwrapped DTO", async () => {
    const result = await clientsService.updatePosClient(mockPosClient.id, { name: "Renamed" });
    expect(result).toEqual(mockPosClient);
  });

  it("updatePosClient throws on 404", async () => {
    server.use(clientsErrorHandlers.posClientNotFound());
    await expect(clientsService.updatePosClient("missing", { name: "X" })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});
